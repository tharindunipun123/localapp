"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSpendingLimits = exports.lookupUserForTransfer = exports.generateWebhookApiKey = exports.confirmCorporateBinding = exports.corporateTopUpUser = exports.setVendorCorporate = exports.redeemPromoAtPos = exports.checkInEvent = exports.redeemLoyaltyPoints = exports.approvePointsPoolTopUp = exports.requestPointsPoolTopUp = void 0;
const https_1 = require("firebase-functions/v2/https");
const crypto_1 = require("crypto");
const helpers_1 = require("./helpers");
const REGION = "us-central1";
function mapErr(err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "KYC_REQUIRED")
        throw new https_1.HttpsError("permission-denied", "KYC verification required", { code: "KYC_REQUIRED" });
    if (msg === "INSUFFICIENT_BALANCE")
        throw new https_1.HttpsError("failed-precondition", "Insufficient balance");
    if (msg === "INSUFFICIENT_POINTS")
        throw new https_1.HttpsError("failed-precondition", "Insufficient loyalty points");
    if (msg === "DAILY_LIMIT_EXCEEDED")
        throw new https_1.HttpsError("resource-exhausted", "Daily spending limit exceeded");
    if (msg === "MONTHLY_LIMIT_EXCEEDED")
        throw new https_1.HttpsError("resource-exhausted", "Monthly spending limit exceeded");
    if (msg.startsWith("PROMO_"))
        throw new https_1.HttpsError("invalid-argument", "Invalid promo code");
    throw err instanceof https_1.HttpsError ? err : new https_1.HttpsError("internal", msg);
}
/** REQ-VND-005: Vendor requests pool top-up — pending admin approval */
exports.requestPointsPoolTopUp = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isApprovedVendor)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Vendor only");
    const vendorId = request.auth.uid;
    const { pointsAmount, lkrAmount } = request.data;
    if (!pointsAmount || !lkrAmount || pointsAmount < 1 || lkrAmount < 1) {
        throw new https_1.HttpsError("invalid-argument", "Invalid amounts");
    }
    const vwSnap = await helpers_1.db.doc(`vendorWallets/${vendorId}`).get();
    const cash = (_b = (_a = vwSnap.data()) === null || _a === void 0 ? void 0 : _a.cashBalance) !== null && _b !== void 0 ? _b : 0;
    if (cash < lkrAmount)
        throw new https_1.HttpsError("failed-precondition", "Insufficient vendor cash balance");
    const ref = await helpers_1.db.collection("poolTopUpRequests").add({
        vendorId,
        pointsAmount,
        lkrAmount,
        status: "pending",
        createdAt: helpers_1.FieldValue.serverTimestamp(),
    });
    return { requestId: ref.id };
});
/** Admin approves points pool top-up */
exports.approvePointsPoolTopUp = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isAdmin)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Admin only");
    const { requestId, action } = request.data;
    const reqRef = helpers_1.db.doc(`poolTopUpRequests/${requestId}`);
    const snap = await reqRef.get();
    if (!snap.exists)
        throw new https_1.HttpsError("not-found", "Request not found");
    const req = snap.data();
    if (req.status !== "pending")
        throw new https_1.HttpsError("failed-precondition", "Already processed");
    if (action === "approve") {
        await helpers_1.db.runTransaction(async (tx) => {
            var _a, _b, _c, _d;
            const vwRef = helpers_1.db.doc(`vendorWallets/${req.vendorId}`);
            const vwSnap = await tx.get(vwRef);
            const cash = (_b = (_a = vwSnap.data()) === null || _a === void 0 ? void 0 : _a.cashBalance) !== null && _b !== void 0 ? _b : 0;
            if (cash < req.lkrAmount)
                throw new Error("INSUFFICIENT_BALANCE");
            const pool = (_d = (_c = vwSnap.data()) === null || _c === void 0 ? void 0 : _c.pointsPool) !== null && _d !== void 0 ? _d : 0;
            tx.update(vwRef, {
                cashBalance: cash - req.lkrAmount,
                pointsPool: pool + req.pointsAmount,
                updatedAt: helpers_1.FieldValue.serverTimestamp(),
            });
            tx.update(reqRef, { status: "approved", processedBy: request.auth.uid, processedAt: helpers_1.FieldValue.serverTimestamp() });
            (0, helpers_1.recordTransaction)(tx, {
                vendorId: req.vendorId,
                fromWalletId: `vendorWallets/${req.vendorId}`,
                toWalletId: `vendorWallets/${req.vendorId}`,
                amount: req.pointsAmount,
                currency: "POINTS",
                type: "points_pool_topup",
                description: `Pool top-up: LKR ${req.lkrAmount} → ${req.pointsAmount} pts`,
                metadata: { requestId, lkrAmount: req.lkrAmount },
            });
        });
        await (0, helpers_1.createNotification)(req.vendorId, "Points Pool Topped Up", `${req.pointsAmount} points added to your pool.`, "pool_topup");
    }
    else {
        await reqRef.update({ status: "rejected", processedBy: request.auth.uid, processedAt: helpers_1.FieldValue.serverTimestamp() });
    }
    await (0, helpers_1.createAuditLog)(request.auth.uid, action, "pool_topup", requestId);
    return { success: true };
});
/** REQ-VND-004: Redeem loyalty points at vendor */
exports.redeemLoyaltyPoints = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b, _c;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const { qrValue, programId, vendorId: targetVendorId } = request.data;
    const vendorId = targetVendorId !== null && targetVendorId !== void 0 ? targetVendorId : request.auth.uid;
    const isVendorCaller = await (0, helpers_1.isApprovedVendor)(request.auth.uid);
    if (!isVendorCaller && request.auth.uid !== vendorId) {
        throw new https_1.HttpsError("permission-denied", "Vendor only");
    }
    let userId;
    if (qrValue) {
        const parsed = await (0, helpers_1.parseAndValidateQrStrict)(qrValue);
        if (!parsed)
            throw new https_1.HttpsError("invalid-argument", "Invalid QR code");
        userId = parsed.userId;
    }
    else {
        userId = request.auth.uid;
    }
    // REQ-WAL-008: KYC required before any financial operation
    try {
        await (0, helpers_1.requireKycApproved)(userId);
    }
    catch (_d) {
        throw new https_1.HttpsError("permission-denied", "User KYC verification required", { code: "KYC_REQUIRED" });
    }
    const programSnap = await helpers_1.db.doc(`loyaltyPrograms/${programId}`).get();
    if (!programSnap.exists || ((_a = programSnap.data()) === null || _a === void 0 ? void 0 : _a.vendorId) !== vendorId) {
        throw new https_1.HttpsError("not-found", "Program not found");
    }
    const program = programSnap.data();
    const pointsRequired = (_c = (_b = program.redeemRule) === null || _b === void 0 ? void 0 : _b.pointsRequired) !== null && _c !== void 0 ? _c : 0;
    if (pointsRequired <= 0)
        throw new https_1.HttpsError("invalid-argument", "Invalid redeem rule");
    try {
        await helpers_1.db.runTransaction(async (tx) => {
            var _a, _b, _c, _d;
            const uwRef = helpers_1.db.doc(`wallets/${userId}`);
            const uwSnap = await tx.get(uwRef);
            const loyalty = (_b = (_a = uwSnap.data()) === null || _a === void 0 ? void 0 : _a.loyaltyPoints) !== null && _b !== void 0 ? _b : 0;
            if (loyalty < pointsRequired)
                throw new Error("INSUFFICIENT_POINTS");
            tx.update(uwRef, {
                loyaltyPoints: loyalty - pointsRequired,
                updatedAt: helpers_1.FieldValue.serverTimestamp(),
            });
            (0, helpers_1.recordTransaction)(tx, {
                userId,
                vendorId,
                fromWalletId: `wallets/${userId}`,
                toWalletId: `vendorWallets/${vendorId}`,
                amount: pointsRequired,
                currency: "POINTS",
                type: "loyalty_redeem",
                description: (_d = (_c = program.redeemRule) === null || _c === void 0 ? void 0 : _c.rewardDescription) !== null && _d !== void 0 ? _d : "Loyalty redemption",
                metadata: { programId, companyId: vendorId },
            });
        });
    }
    catch (err) {
        mapErr(err);
    }
    await (0, helpers_1.createNotification)(userId, "Points Redeemed", `You redeemed ${pointsRequired} loyalty points.`, "loyalty_redeem");
    return { success: true, pointsRedeemed: pointsRequired };
});
/** REQ-VND-010: Event check-in via user QR */
exports.checkInEvent = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isAdmin)(request.auth.uid)) && !(await (0, helpers_1.isApprovedVendor)(request.auth.uid))) {
        const eventId = request.data.eventId;
        const eventSnap = await helpers_1.db.doc(`events/${eventId}`).get();
        if (!eventSnap.exists || ((_a = eventSnap.data()) === null || _a === void 0 ? void 0 : _a.createdBy) !== request.auth.uid) {
            throw new https_1.HttpsError("permission-denied", "Not authorized to check in");
        }
    }
    const { eventId, qrValue } = request.data;
    const parsed = await (0, helpers_1.parseAndValidateQrStrict)(qrValue);
    if (!parsed)
        throw new https_1.HttpsError("invalid-argument", "Invalid QR code");
    const ticketSnap = await helpers_1.db
        .collection("tickets")
        .where("eventId", "==", eventId)
        .where("userId", "==", parsed.userId)
        .where("status", "==", "active")
        .limit(1)
        .get();
    if (ticketSnap.empty)
        throw new https_1.HttpsError("not-found", "No active ticket for this user");
    const ticketRef = ticketSnap.docs[0].ref;
    await ticketRef.update({ checkedIn: true, checkedInAt: helpers_1.FieldValue.serverTimestamp() });
    await helpers_1.db.collection("eventCheckIns").add({
        eventId,
        userId: parsed.userId,
        ticketId: ticketSnap.docs[0].id,
        checkedInBy: request.auth.uid,
        createdAt: helpers_1.FieldValue.serverTimestamp(),
    });
    return { success: true, userId: parsed.userId };
});
/** REQ-PRO-002: Promo redemption at vendor POS via user QR */
exports.redeemPromoAtPos = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isApprovedVendor)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Vendor only");
    const vendorId = request.auth.uid;
    const { qrValue, promoCode, purchaseAmount } = request.data;
    const parsed = await (0, helpers_1.parseAndValidateQrStrict)(qrValue);
    if (!parsed)
        throw new https_1.HttpsError("invalid-argument", "Invalid QR code");
    let promoResult;
    try {
        promoResult = await (0, helpers_1.validatePromoInternal)(promoCode, parsed.userId, purchaseAmount, "vendors");
    }
    catch (err) {
        mapErr(err);
    }
    await helpers_1.db.collection("promoRedemptions").add({
        promoId: promoResult.promoId,
        userId: parsed.userId,
        vendorId,
        discount: promoResult.discount,
        purchaseAmount,
        context: "vendor_pos",
        createdAt: helpers_1.FieldValue.serverTimestamp(),
    });
    await helpers_1.db.doc(`promoCodes/${promoResult.promoId}`).update({
        usedCount: helpers_1.FieldValue.increment(1),
    });
    return { success: true, discount: promoResult.discount, userId: parsed.userId };
});
/** REQ-WAL-009: Admin sets corporate vendor flag */
exports.setVendorCorporate = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isAdmin)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Admin only");
    const { vendorId, isCorporate } = request.data;
    await helpers_1.db.doc(`vendors/${vendorId}`).update({ isCorporate, updatedAt: helpers_1.FieldValue.serverTimestamp() });
    await (0, helpers_1.createAuditLog)(request.auth.uid, isCorporate ? "set_corporate" : "unset_corporate", "vendor", vendorId);
    return { success: true };
});
/** REQ-WAL-010: Corporate vendor tops up user work_balance */
exports.corporateTopUpUser = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const vendorId = request.auth.uid;
    if (!(await (0, helpers_1.isCorporateVendor)(vendorId)))
        throw new https_1.HttpsError("permission-denied", "Corporate vendor only");
    const { userId, amount } = request.data;
    if (!userId || !amount || amount < 1)
        throw new https_1.HttpsError("invalid-argument", "Invalid input");
    // REQ-WAL-008: KYC required for the receiving user
    try {
        await (0, helpers_1.requireKycApproved)(userId);
    }
    catch (_b) {
        throw new https_1.HttpsError("permission-denied", "Recipient user must complete KYC verification", { code: "KYC_REQUIRED" });
    }
    const bindingSnap = await helpers_1.db.doc(`corporateBindings/${userId}_${vendorId}`).get();
    if (!bindingSnap.exists || ((_a = bindingSnap.data()) === null || _a === void 0 ? void 0 : _a.status) !== "active") {
        throw new https_1.HttpsError("failed-precondition", "User not bound to this corporate account");
    }
    const vwRef = helpers_1.db.doc(`vendorWallets/${vendorId}`);
    const uwRef = helpers_1.db.doc(`wallets/${userId}`);
    await helpers_1.db.runTransaction(async (tx) => {
        var _a, _b, _c, _d;
        const [vwSnap, uwSnap] = await Promise.all([tx.get(vwRef), tx.get(uwRef)]);
        const cash = (_b = (_a = vwSnap.data()) === null || _a === void 0 ? void 0 : _a.cashBalance) !== null && _b !== void 0 ? _b : 0;
        if (cash < amount)
            throw new Error("INSUFFICIENT_BALANCE");
        const workBal = (_d = (_c = uwSnap.data()) === null || _c === void 0 ? void 0 : _c.workBalance) !== null && _d !== void 0 ? _d : 0;
        tx.update(vwRef, { cashBalance: cash - amount, updatedAt: helpers_1.FieldValue.serverTimestamp() });
        tx.set(uwRef, { workBalance: workBal + amount, updatedAt: helpers_1.FieldValue.serverTimestamp() }, { merge: true });
        (0, helpers_1.recordTransaction)(tx, {
            userId,
            vendorId,
            fromWalletId: `vendorWallets/${vendorId}`,
            toWalletId: `wallets/${userId}`,
            amount,
            currency: "LKR",
            type: "corporate_topup",
            description: "Corporate work balance top-up",
            metadata: { companyId: vendorId, ledger: "work_balance" },
        });
    });
    await (0, helpers_1.createNotification)(userId, "Work Balance Credited", `LKR ${amount} added to your work balance.`, "corporate_topup");
    return { success: true };
});
/** REQ-WAL-012: User requests corporate binding (OTP verified on client) */
exports.confirmCorporateBinding = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const userId = request.auth.uid;
    // REQ-WAL-008: KYC required before binding to corporate account
    try {
        await (0, helpers_1.requireKycApproved)(userId);
    }
    catch (_b) {
        throw new https_1.HttpsError("permission-denied", "KYC verification required before corporate binding", { code: "KYC_REQUIRED" });
    }
    const { vendorId, otpVerified } = request.data;
    if (!vendorId || !otpVerified)
        throw new https_1.HttpsError("invalid-argument", "OTP confirmation required");
    const vendorSnap = await helpers_1.db.doc(`vendors/${vendorId}`).get();
    if (!vendorSnap.exists || !((_a = vendorSnap.data()) === null || _a === void 0 ? void 0 : _a.isCorporate)) {
        throw new https_1.HttpsError("failed-precondition", "Not a corporate vendor");
    }
    await helpers_1.db.doc(`corporateBindings/${userId}_${vendorId}`).set({
        userId,
        vendorId,
        companyId: vendorId,
        status: "active",
        consentedAt: helpers_1.FieldValue.serverTimestamp(),
        createdAt: helpers_1.FieldValue.serverTimestamp(),
    });
    await helpers_1.db.doc(`users/${userId}`).set({ corporateVendorId: vendorId, updatedAt: helpers_1.FieldValue.serverTimestamp() }, { merge: true });
    return { success: true };
});
/** REQ-VND-007: Generate webhook API key */
exports.generateWebhookApiKey = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const vendorId = request.auth.uid;
    const isAdminUser = await (0, helpers_1.isAdmin)(request.auth.uid);
    const targetId = (_a = request.data.vendorId) !== null && _a !== void 0 ? _a : vendorId;
    if (targetId !== request.auth.uid && !isAdminUser)
        throw new https_1.HttpsError("permission-denied", "Not authorized");
    if (!(await (0, helpers_1.isApprovedVendor)(targetId)) && !isAdminUser)
        throw new https_1.HttpsError("permission-denied", "Vendor not active");
    const apiKey = (0, crypto_1.randomBytes)(32).toString("hex");
    await helpers_1.db.doc(`vendors/${targetId}`).update({ webhookApiKey: apiKey, updatedAt: helpers_1.FieldValue.serverTimestamp() });
    if (isAdminUser && targetId !== vendorId) {
        await (0, helpers_1.createAuditLog)(vendorId, "generate_webhook_key", "vendor", targetId);
    }
    return { apiKey };
});
/** REQ-WAL-004: Lookup user for P2P */
exports.lookupUserForTransfer = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const { lookup } = request.data;
    const userId = await (0, helpers_1.resolveUserByLookup)(lookup);
    if (!userId)
        throw new https_1.HttpsError("not-found", "User not found");
    const user = (await helpers_1.db.doc(`users/${userId}`).get()).data();
    return { userId, displayName: user.displayName, email: user.email };
});
/** Admin: update user spending limits */
exports.updateUserSpendingLimits = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isAdmin)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Admin only");
    const { userId, spendingLimitDaily, spendingLimitMonthly } = request.data;
    await helpers_1.db.doc(`wallets/${userId}`).set({ spendingLimitDaily, spendingLimitMonthly, updatedAt: helpers_1.FieldValue.serverTimestamp() }, { merge: true });
    await (0, helpers_1.createAuditLog)(request.auth.uid, "update_spending_limits", "user", userId);
    return { success: true };
});
//# sourceMappingURL=extended.js.map