"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyFamily = exports.familyTransfer = exports.respondFamilyInvite = exports.inviteFamilyMember = exports.createFamilyAccount = void 0;
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
const REGION = "us-central1";
async function getOwnedFamily(uid) {
    const snap = await helpers_1.db.collection("familyAccounts").where("ownerId", "==", uid).limit(1).get();
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}
async function getMemberFamily(uid) {
    const snap = await helpers_1.db.collection("familyAccounts").where("memberIds", "array-contains", uid).limit(1).get();
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}
exports.createFamilyAccount = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    try {
        await (0, helpers_1.requireKycApproved)(uid);
    }
    catch (_a) {
        throw new https_1.HttpsError("permission-denied", "KYC verification required", { code: "KYC_REQUIRED" });
    }
    const { name } = request.data;
    const existing = await getMemberFamily(uid);
    if (existing)
        throw new https_1.HttpsError("already-exists", "You already belong to a family account");
    const ref = await helpers_1.db.collection("familyAccounts").add({
        name: (name !== null && name !== void 0 ? name : "Family").trim().slice(0, 80),
        ownerId: uid,
        memberIds: [uid],
        cashBalance: 0,
        createdAt: helpers_1.FieldValue.serverTimestamp(),
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    });
    await helpers_1.db.doc(`users/${uid}`).update({
        familyId: ref.id,
        familyRole: "owner",
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    });
    return { familyId: ref.id };
});
exports.inviteFamilyMember = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const { lookup } = request.data;
    if (!(lookup === null || lookup === void 0 ? void 0 : lookup.trim()))
        throw new https_1.HttpsError("invalid-argument", "Member lookup required");
    const family = await getOwnedFamily(uid);
    if (!family)
        throw new https_1.HttpsError("failed-precondition", "Create a family account first");
    const targetId = await (0, helpers_1.resolveUserByLookup)(lookup.trim());
    if (!targetId)
        throw new https_1.HttpsError("not-found", "User not found");
    if (targetId === uid)
        throw new https_1.HttpsError("invalid-argument", "Cannot invite yourself");
    const members = (_a = family.memberIds) !== null && _a !== void 0 ? _a : [];
    if (members.includes(targetId))
        throw new https_1.HttpsError("already-exists", "Already a member");
    if (members.length >= 8)
        throw new https_1.HttpsError("resource-exhausted", "Family accounts support up to 8 members");
    const alreadyIn = await getMemberFamily(targetId);
    if (alreadyIn)
        throw new https_1.HttpsError("failed-precondition", "That user already belongs to a family");
    await helpers_1.db.collection("familyInvites").add({
        familyId: family.id,
        familyName: family.name,
        fromUserId: uid,
        toUserId: targetId,
        status: "pending",
        createdAt: helpers_1.FieldValue.serverTimestamp(),
    });
    await (0, helpers_1.createNotification)(targetId, "Family invitation", `You've been invited to join "${family.name}".`, "family_invite", { familyId: family.id });
    return { success: true };
});
exports.respondFamilyInvite = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const { inviteId, action } = request.data;
    if (!inviteId || !["accept", "decline"].includes(action)) {
        throw new https_1.HttpsError("invalid-argument", "inviteId and action required");
    }
    const inviteRef = helpers_1.db.doc(`familyInvites/${inviteId}`);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists)
        throw new https_1.HttpsError("not-found", "Invite not found");
    const invite = inviteSnap.data();
    if (invite.toUserId !== uid)
        throw new https_1.HttpsError("permission-denied", "Not your invitation");
    if (invite.status !== "pending")
        throw new https_1.HttpsError("failed-precondition", "Invite already handled");
    if (action === "decline") {
        await inviteRef.update({ status: "declined", updatedAt: helpers_1.FieldValue.serverTimestamp() });
        return { success: true };
    }
    const already = await getMemberFamily(uid);
    if (already)
        throw new https_1.HttpsError("failed-precondition", "You already belong to a family");
    await helpers_1.db.doc(`familyAccounts/${invite.familyId}`).update({
        memberIds: helpers_1.FieldValue.arrayUnion(uid),
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    });
    await helpers_1.db.doc(`users/${uid}`).update({
        familyId: invite.familyId,
        familyRole: "member",
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    });
    await inviteRef.update({ status: "accepted", updatedAt: helpers_1.FieldValue.serverTimestamp() });
    return { success: true };
});
exports.familyTransfer = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    try {
        await (0, helpers_1.requireKycApproved)(uid);
    }
    catch (_b) {
        throw new https_1.HttpsError("permission-denied", "KYC verification required", { code: "KYC_REQUIRED" });
    }
    const { toUserId, amount } = request.data;
    if (!toUserId || !amount || amount < 1)
        throw new https_1.HttpsError("invalid-argument", "Member and amount required");
    const family = await getOwnedFamily(uid);
    if (!family)
        throw new https_1.HttpsError("permission-denied", "Only the family owner can send allowances");
    const members = (_a = family.memberIds) !== null && _a !== void 0 ? _a : [];
    if (!members.includes(toUserId))
        throw new https_1.HttpsError("failed-precondition", "User is not a family member");
    if (toUserId === uid)
        throw new https_1.HttpsError("invalid-argument", "Cannot send allowance to yourself");
    await helpers_1.db.runTransaction(async (tx) => {
        var _a, _b;
        const fromRef = helpers_1.db.doc(`wallets/${uid}`);
        const toRef = helpers_1.db.doc(`wallets/${toUserId}`);
        const [fromSnap, toSnap] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);
        const fromBal = (0, helpers_1.cashBalance)(fromSnap.data());
        if (fromBal < amount)
            throw new Error("INSUFFICIENT_BALANCE");
        const toData = (_a = toSnap.data()) !== null && _a !== void 0 ? _a : {};
        const familyBalance = ((_b = toData.familyBalance) !== null && _b !== void 0 ? _b : 0) + amount;
        tx.set(fromRef, { cashBalance: fromBal - amount, balance: fromBal - amount, updatedAt: helpers_1.FieldValue.serverTimestamp() }, { merge: true });
        tx.set(toRef, { familyBalance, currency: "LKR", updatedAt: helpers_1.FieldValue.serverTimestamp() }, { merge: true });
        (0, helpers_1.recordTransaction)(tx, {
            userId: uid,
            fromWalletId: `wallets/${uid}`,
            toWalletId: `wallets/${toUserId}`,
            amount,
            currency: "LKR",
            type: "family_allowance",
            description: "Family allowance",
            metadata: { familyId: family.id, toUserId },
        });
    }).catch((err) => {
        if (err.message === "INSUFFICIENT_BALANCE") {
            throw new https_1.HttpsError("failed-precondition", "Insufficient cash balance");
        }
        throw err;
    });
    await (0, helpers_1.createNotification)(toUserId, "Family allowance received", `LKR ${amount.toLocaleString()} was added to your family balance.`, "family_allowance");
    return { success: true };
});
exports.getMyFamily = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const family = await getMemberFamily(uid);
    const invitesSnap = await helpers_1.db
        .collection("familyInvites")
        .where("toUserId", "==", uid)
        .where("status", "==", "pending")
        .limit(20)
        .get();
    const invites = invitesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!family)
        return { family: null, members: [], invites };
    const memberIds = (_a = family.memberIds) !== null && _a !== void 0 ? _a : [];
    const members = await Promise.all(memberIds.map(async (id) => {
        var _a, _b, _c, _d, _e, _f;
        const [userSnap, walletSnap] = await Promise.all([
            helpers_1.db.doc(`users/${id}`).get(),
            helpers_1.db.doc(`wallets/${id}`).get(),
        ]);
        return {
            userId: id,
            displayName: (_b = (_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.displayName) !== null && _b !== void 0 ? _b : "Member",
            email: (_d = (_c = userSnap.data()) === null || _c === void 0 ? void 0 : _c.email) !== null && _d !== void 0 ? _d : "",
            role: id === family.ownerId ? "owner" : "member",
            familyBalance: (_f = (_e = walletSnap.data()) === null || _e === void 0 ? void 0 : _e.familyBalance) !== null && _f !== void 0 ? _f : 0,
        };
    }));
    return { family, members, invites };
});
//# sourceMappingURL=family.js.map