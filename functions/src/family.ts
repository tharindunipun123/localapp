import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  db,
  requireKycApproved,
  resolveUserByLookup,
  cashBalance,
  recordTransaction,
  createNotification,
  FieldValue,
} from "./helpers";

const REGION = "us-central1";

type FamilyAccount = {
  id: string;
  name?: string;
  ownerId?: string;
  memberIds?: string[];
  cashBalance?: number;
};

async function getOwnedFamily(uid: string): Promise<FamilyAccount | null> {
  const snap = await db.collection("familyAccounts").where("ownerId", "==", uid).limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function getMemberFamily(uid: string): Promise<FamilyAccount | null> {
  const snap = await db.collection("familyAccounts").where("memberIds", "array-contains", uid).limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export const createFamilyAccount = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;
  try {
    await requireKycApproved(uid);
  } catch {
    throw new HttpsError("permission-denied", "KYC verification required", { code: "KYC_REQUIRED" });
  }

  const { name } = request.data as { name?: string };
  const existing = await getMemberFamily(uid);
  if (existing) throw new HttpsError("already-exists", "You already belong to a family account");

  const ref = await db.collection("familyAccounts").add({
    name: (name ?? "Family").trim().slice(0, 80),
    ownerId: uid,
    memberIds: [uid],
    cashBalance: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.doc(`users/${uid}`).update({
    familyId: ref.id,
    familyRole: "owner",
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { familyId: ref.id };
});

export const inviteFamilyMember = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;
  const { lookup } = request.data as { lookup: string };
  if (!lookup?.trim()) throw new HttpsError("invalid-argument", "Member lookup required");

  const family = await getOwnedFamily(uid);
  if (!family) throw new HttpsError("failed-precondition", "Create a family account first");

  const targetId = await resolveUserByLookup(lookup.trim());
  if (!targetId) throw new HttpsError("not-found", "User not found");
  if (targetId === uid) throw new HttpsError("invalid-argument", "Cannot invite yourself");

  const members: string[] = family.memberIds ?? [];
  if (members.includes(targetId)) throw new HttpsError("already-exists", "Already a member");
  if (members.length >= 8) throw new HttpsError("resource-exhausted", "Family accounts support up to 8 members");

  const alreadyIn = await getMemberFamily(targetId);
  if (alreadyIn) throw new HttpsError("failed-precondition", "That user already belongs to a family");

  await db.collection("familyInvites").add({
    familyId: family.id,
    familyName: family.name,
    fromUserId: uid,
    toUserId: targetId,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  });

  await createNotification(
    targetId,
    "Family invitation",
    `You've been invited to join "${family.name}".`,
    "family_invite",
    { familyId: family.id }
  );

  return { success: true };
});

export const respondFamilyInvite = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;
  const { inviteId, action } = request.data as { inviteId: string; action: "accept" | "decline" };
  if (!inviteId || !["accept", "decline"].includes(action)) {
    throw new HttpsError("invalid-argument", "inviteId and action required");
  }

  const inviteRef = db.doc(`familyInvites/${inviteId}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) throw new HttpsError("not-found", "Invite not found");
  const invite = inviteSnap.data()!;
  if (invite.toUserId !== uid) throw new HttpsError("permission-denied", "Not your invitation");
  if (invite.status !== "pending") throw new HttpsError("failed-precondition", "Invite already handled");

  if (action === "decline") {
    await inviteRef.update({ status: "declined", updatedAt: FieldValue.serverTimestamp() });
    return { success: true };
  }

  const already = await getMemberFamily(uid);
  if (already) throw new HttpsError("failed-precondition", "You already belong to a family");

  await db.doc(`familyAccounts/${invite.familyId}`).update({
    memberIds: FieldValue.arrayUnion(uid),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await db.doc(`users/${uid}`).update({
    familyId: invite.familyId,
    familyRole: "member",
    updatedAt: FieldValue.serverTimestamp(),
  });
  await inviteRef.update({ status: "accepted", updatedAt: FieldValue.serverTimestamp() });
  return { success: true };
});

export const familyTransfer = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;
  try {
    await requireKycApproved(uid);
  } catch {
    throw new HttpsError("permission-denied", "KYC verification required", { code: "KYC_REQUIRED" });
  }

  const { toUserId, amount } = request.data as { toUserId: string; amount: number };
  if (!toUserId || !amount || amount < 1) throw new HttpsError("invalid-argument", "Member and amount required");

  const family = await getOwnedFamily(uid);
  if (!family) throw new HttpsError("permission-denied", "Only the family owner can send allowances");
  const members: string[] = family.memberIds ?? [];
  if (!members.includes(toUserId)) throw new HttpsError("failed-precondition", "User is not a family member");
  if (toUserId === uid) throw new HttpsError("invalid-argument", "Cannot send allowance to yourself");

  await db.runTransaction(async (tx) => {
    const fromRef = db.doc(`wallets/${uid}`);
    const toRef = db.doc(`wallets/${toUserId}`);
    const [fromSnap, toSnap] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);
    const fromBal = cashBalance(fromSnap.data());
    if (fromBal < amount) throw new Error("INSUFFICIENT_BALANCE");
    const toData = toSnap.data() ?? {};
    const familyBalance = (toData.familyBalance ?? 0) + amount;

    tx.set(
      fromRef,
      { cashBalance: fromBal - amount, balance: fromBal - amount, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    tx.set(
      toRef,
      { familyBalance, currency: "LKR", updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    recordTransaction(tx, {
      userId: uid,
      fromWalletId: `wallets/${uid}`,
      toWalletId: `wallets/${toUserId}`,
      amount,
      currency: "LKR",
      type: "family_allowance",
      description: "Family allowance",
      metadata: { familyId: family.id, toUserId },
    });
  }).catch((err: Error) => {
    if (err.message === "INSUFFICIENT_BALANCE") {
      throw new HttpsError("failed-precondition", "Insufficient cash balance");
    }
    throw err;
  });

  await createNotification(
    toUserId,
    "Family allowance received",
    `LKR ${amount.toLocaleString()} was added to your family balance.`,
    "family_allowance"
  );

  return { success: true };
});

export const getMyFamily = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;
  const family = await getMemberFamily(uid);
  const invitesSnap = await db
    .collection("familyInvites")
    .where("toUserId", "==", uid)
    .where("status", "==", "pending")
    .limit(20)
    .get();

  const invites = invitesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!family) return { family: null, members: [], invites };

  const memberIds: string[] = family.memberIds ?? [];
  const members = await Promise.all(
    memberIds.map(async (id) => {
      const [userSnap, walletSnap] = await Promise.all([
        db.doc(`users/${id}`).get(),
        db.doc(`wallets/${id}`).get(),
      ]);
      return {
        userId: id,
        displayName: userSnap.data()?.displayName ?? "Member",
        email: userSnap.data()?.email ?? "",
        role: id === family.ownerId ? "owner" : "member",
        familyBalance: walletSnap.data()?.familyBalance ?? 0,
      };
    })
  );

  return { family, members, invites };
});
