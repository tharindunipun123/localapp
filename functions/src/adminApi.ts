import * as adminSdk from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db, isAdmin } from "./helpers";

const REGION = "us-central1";

function mapDoc(id: string, data: FirebaseFirestore.DocumentData) {
  return { id, ...data };
}

/** Check custom claim (fast) then fall back to Firestore role */
async function requireAdmin(
  uid: string | undefined,
  token?: Record<string, unknown>
): Promise<void> {
  if (!uid) throw new HttpsError("unauthenticated", "Must be signed in");
  // Fast path — custom claim set by claimAdminRole
  if (token?.admin === true) return;
  // Fallback — Firestore role check
  if (!(await isAdmin(uid))) throw new HttpsError("permission-denied", "Admin only");
}

/** Admin: vendors list, pending applications, pool top-up queue (enriched with owner KYC status) */
export const getAdminVendorData = onCall({ region: REGION }, async (request) => {
  await requireAdmin(request.auth?.uid, request.auth?.token as Record<string, unknown>);

  const [pendingSnap, allSnap, poolSnap] = await Promise.all([
    db.collection("vendors").where("status", "==", "pending").orderBy("createdAt", "desc").limit(100).get(),
    db.collection("vendors").orderBy("createdAt", "desc").limit(200).get(),
    db.collection("poolTopUpRequests").where("status", "==", "pending").orderBy("createdAt", "desc").limit(100).get(),
  ]);

  async function enrichWithOwnerKyc(docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
    return Promise.all(
      docs.map(async (d) => {
        const data = d.data();
        const ownerUid: string = data.ownerId ?? d.id;
        try {
          const userSnap = await db.doc(`users/${ownerUid}`).get();
          const ownerKycStatus = userSnap.data()?.kycStatus ?? "none";
          return mapDoc(d.id, { ...data, ownerKycStatus });
        } catch {
          return mapDoc(d.id, data);
        }
      })
    );
  }

  const [pending, all] = await Promise.all([
    enrichWithOwnerKyc(pendingSnap.docs),
    enrichWithOwnerKyc(allSnap.docs),
  ]);

  return {
    pending,
    all,
    poolTopUpRequests: poolSnap.docs.map((d) => mapDoc(d.id, d.data())),
  };
});

/** Admin: pending KYC submissions */
export const getAdminKycQueue = onCall({ region: REGION }, async (request) => {
  await requireAdmin(request.auth?.uid, request.auth?.token as Record<string, unknown>);

  const snap = await db
    .collection("kycSubmissions")
    .where("status", "==", "pending")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  return snap.docs.map((d) => mapDoc(d.id, d.data()));
});

/** Admin: dashboard stats (SRS 3.10.1) */
export const getAdminDashboardStats = onCall({ region: REGION }, async (request) => {
  await requireAdmin(request.auth?.uid, request.auth?.token as Record<string, unknown>);

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const [pending, approved, users, reported, kyc, vendors, withdrawals, lotteries, txSnap] =
    await Promise.all([
      db.collection("events").where("status", "==", "pending").get(),
      db.collection("events").where("status", "==", "approved").limit(500).get(),
      db.collection("users").limit(500).get(),
      db.collection("reviews").where("status", "==", "reported").get(),
      db.collection("kycSubmissions").where("status", "==", "pending").get(),
      db.collection("vendors").where("status", "==", "pending").get(),
      db.collection("withdrawalRequests").where("status", "==", "pending").get(),
      db.collection("lotteries").where("status", "==", "active").get(),
      db.collection("transactions").orderBy("createdAt", "desc").limit(400).get().catch(() => null),
    ]);

  let kycApproved = 0;
  let emailVerified = 0;
  users.forEach((d) => {
    const u = d.data();
    if (u.kycStatus === "approved") kycApproved += 1;
    if (u.emailVerified) emailVerified += 1;
  });

  let deposit7d = 0;
  let spend7d = 0;
  let p2p7d = 0;
  txSnap?.docs.forEach((d) => {
    const t = d.data();
    const created = t.createdAt?.toMillis?.() ?? 0;
    if (created < sevenDaysAgo) return;
    const amount = Number(t.amount ?? 0);
    if (t.type === "deposit") deposit7d += amount;
    if (t.type === "ticket_purchase" || t.type === "spend") spend7d += amount;
    if (t.type === "transfer" || t.type === "p2p_transfer") p2p7d += amount;
  });

  let lotteryTickets = 0;
  let lotteryPool = 0;
  lotteries.forEach((d) => {
    const l = d.data();
    lotteryTickets += Number(l.entryCount ?? 0);
    lotteryPool += Number(l.pointsCost ?? 0) * Number(l.entryCount ?? 0);
  });

  return {
    pendingEvents: pending.size,
    approvedEvents: approved.size,
    totalUsers: users.size,
    reportedReviews: reported.size,
    pendingKyc: kyc.size,
    pendingVendors: vendors.size,
    pendingWithdrawals: withdrawals.size,
    kycApproved,
    emailVerified,
    activeLotteries: lotteries.size,
    lotteryTickets,
    lotteryPool,
    deposit7d,
    spend7d,
    p2p7d,
    vendorCount: vendors.size,
  };
});

/** REQ-AUTH-008 / REQ-AUTH-011: disable user, revoke sessions, sync custom claims */
export const adminManageUser = onCall({ region: REGION }, async (request) => {
  await requireAdmin(request.auth?.uid, request.auth?.token as Record<string, unknown>);
  const { userId, action, role } = request.data as {
    userId: string;
    action: "disable" | "enable" | "force_logout" | "set_role";
    role?: string;
  };
  if (!userId || !action) throw new HttpsError("invalid-argument", "userId and action required");

  const ref = db.doc(`users/${userId}`);
  if (action === "disable") {
    await adminSdk.auth().updateUser(userId, { disabled: true }).catch(() => undefined);
    await ref.update({ disabled: true, forceLogoutAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  } else if (action === "enable") {
    await adminSdk.auth().updateUser(userId, { disabled: false }).catch(() => undefined);
    await ref.update({ disabled: false, updatedAt: FieldValue.serverTimestamp() });
  } else if (action === "force_logout") {
    await adminSdk.auth().revokeRefreshTokens(userId).catch(() => undefined);
    await ref.update({ forceLogoutAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  } else if (action === "set_role") {
    if (!role || !["user", "vendor", "admin"].includes(role)) {
      throw new HttpsError("invalid-argument", "Invalid role");
    }
    await ref.update({ role, updatedAt: FieldValue.serverTimestamp() });
    await adminSdk.auth().setCustomUserClaims(userId, { admin: role === "admin" });
  } else {
    throw new HttpsError("invalid-argument", "Invalid action");
  }

  return { success: true };
});

/** System-wide notification broadcast (SRS 3.10.2) */
export const broadcastNotification = onCall({ region: REGION }, async (request) => {
  await requireAdmin(request.auth?.uid, request.auth?.token as Record<string, unknown>);
  const { title, body } = request.data as { title?: string; body?: string };
  if (!title || !body) throw new HttpsError("invalid-argument", "title and body required");

  const users = await db.collection("users").limit(500).get();
  const batchSize = 400;
  let sent = 0;
  let batch = db.batch();
  let count = 0;
  for (const docSnap of users.docs) {
    const nref = db.collection("notifications").doc();
    batch.set(nref, {
      userId: docSnap.id,
      title,
      body,
      type: "broadcast",
      read: false,
      data: {},
      createdAt: FieldValue.serverTimestamp(),
    });
    count += 1;
    sent += 1;
    if (count >= batchSize) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
  return { success: true, sent };
});

/** Admin: all users for management table */
export const getAdminUsersList = onCall({ region: REGION }, async (request) => {
  await requireAdmin(request.auth?.uid, request.auth?.token as Record<string, unknown>);

  const snap = await db.collection("users").orderBy("createdAt", "desc").limit(200).get();
  return snap.docs.map((d) => mapDoc(d.id, { uid: d.id, ...d.data() }));
});

/** Admin: pending chat message reports */
export const getAdminChatReports = onCall({ region: REGION }, async (request) => {
  await requireAdmin(request.auth?.uid, request.auth?.token as Record<string, unknown>);

  const snap = await db
    .collection("chatMessageReports")
    .where("status", "==", "pending")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  return snap.docs.map((d) => mapDoc(d.id, d.data()));
});

/**
 * Bootstrap / repair admin role.
 * - If user's Firestore doc already says "admin" (any case) → set custom claim.
 * - If no admin exists yet → set role + custom claim.
 * - Otherwise → refuse.
 */
export const claimAdminRole = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;
  const email = request.auth.token?.email ?? "";

  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const currentRole: string = (userSnap.data()?.role ?? "").toString();
  const alreadyAdminInDb = currentRole.toLowerCase() === "admin";

  if (!alreadyAdminInDb) {
    // Check if any other admin already exists
    const adminSnap = await db.collection("users").where("role", "==", "admin").limit(2).get();
    const otherAdmins = adminSnap.docs.filter((d) => d.id !== uid);
    if (otherAdmins.length > 0) {
      return {
        uid,
        email,
        currentRole,
        promoted: false,
        message: `Another admin already exists. Your current role is "${currentRole}". Ask that admin to promote you via the Users page.`,
      };
    }
  }

  // Write role to Firestore
  if (!userSnap.exists) {
    await userRef.set({
      uid,
      email,
      role: "admin",
      kycStatus: "none",
      vendorStatus: "none",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await userRef.update({ role: "admin", updatedAt: FieldValue.serverTimestamp() });
  }

  // Set Firebase Auth custom claim — no more Firestore reads needed for admin check
  await adminSdk.auth().setCustomUserClaims(uid, { admin: true });

  return {
    uid,
    email,
    currentRole: "admin",
    promoted: true,
    message: "Admin role set. The page will reload with full access.",
  };
});
