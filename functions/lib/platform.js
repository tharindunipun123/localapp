"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookLoyaltyGrant = exports.processVendorWithdrawal = exports.requestVendorWithdrawal = exports.transferP2P = exports.validatePromoCode = exports.createPromoCode = exports.reviewKyc = exports.diditWebhook = exports.createKycSession = exports.validateUserQr = exports.generateUserQr = exports.adminTopUpVendorWallet = exports.topUpPointsPool = exports.confirmLoyaltyGrant = exports.initiateLoyaltyGrant = exports.updateLoyaltyProgram = exports.createLoyaltyProgram = exports.moderateVendor = exports.submitVendorApplication = exports.syncVerificationStatus = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
const kycProvider_1 = require("./kycProvider");
const REGION = "us-central1";
function mapHttpsError(err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "KYC_REQUIRED")
        throw new https_1.HttpsError("permission-denied", "KYC verification required", { code: "KYC_REQUIRED" });
    if (msg === "INSUFFICIENT_BALANCE")
        throw new https_1.HttpsError("failed-precondition", "Insufficient balance");
    if (msg === "INSUFFICIENT_POINTS_POOL")
        throw new https_1.HttpsError("failed-precondition", "Insufficient points pool");
    if (msg === "NOT_VENDOR")
        throw new https_1.HttpsError("permission-denied", "Vendor access required");
    if (msg === "INVALID_QR")
        throw new https_1.HttpsError("invalid-argument", "Invalid or expired QR code");
    if (msg === "PROMO_INVALID")
        throw new https_1.HttpsError("invalid-argument", "Invalid promo code");
    throw err instanceof https_1.HttpsError ? err : new https_1.HttpsError("internal", msg);
}
/** Sync email verification from Firebase Auth; phone comes from Notify.lk OTP flow */
exports.syncVerificationStatus = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b, _c, _d, _e, _f;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const authUser = await admin.auth().getUser(uid);
    const userSnap = await helpers_1.db.doc(`users/${uid}`).get();
    const userData = (_a = userSnap.data()) !== null && _a !== void 0 ? _a : {};
    await helpers_1.db.doc(`users/${uid}`).set({
        emailVerified: authUser.emailVerified,
        phone: (_b = userData.phone) !== null && _b !== void 0 ? _b : null,
        phoneVerified: (_c = userData.phoneVerified) !== null && _c !== void 0 ? _c : false,
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    const vendorSnap = await helpers_1.db.doc(`vendors/${uid}`).get();
    if (vendorSnap.exists) {
        await helpers_1.db.doc(`vendors/${uid}`).update({
            emailVerified: authUser.emailVerified,
            phoneVerified: (_d = userData.phoneVerified) !== null && _d !== void 0 ? _d : false,
            updatedAt: helpers_1.FieldValue.serverTimestamp(),
        });
    }
    return {
        emailVerified: authUser.emailVerified,
        phoneVerified: (_e = userData.phoneVerified) !== null && _e !== void 0 ? _e : false,
        phone: (_f = userData.phone) !== null && _f !== void 0 ? _f : null,
    };
});
/** Submit vendor application (same user can become vendor) */
exports.submitVendorApplication = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const authUser = await admin.auth().getUser(uid);
    if (!authUser.emailVerified) {
        throw new https_1.HttpsError("failed-precondition", "Verify your email before applying as a vendor");
    }
    const userSnap = await helpers_1.db.doc(`users/${uid}`).get();
    const userData = (_a = userSnap.data()) !== null && _a !== void 0 ? _a : {};
    if (!userData.phoneVerified) {
        throw new https_1.HttpsError("failed-precondition", "Verify your phone number before applying as a vendor");
    }
    const data = request.data;
    const required = [
        "businessName",
        "category",
        "address",
        "phone",
        "email",
        "description",
        "businessRegistrationNumber",
        "registrationPdfPath",
    ];
    for (const field of required) {
        if (!data[field])
            throw new https_1.HttpsError("invalid-argument", `${field} is required`);
    }
    const vendorRef = helpers_1.db.doc(`vendors/${uid}`);
    const existing = await vendorRef.get();
    if (existing.exists && ((_b = existing.data()) === null || _b === void 0 ? void 0 : _b.status) === "active") {
        throw new https_1.HttpsError("already-exists", "Vendor profile already active");
    }
    const vendorDoc = {
        ownerId: uid,
        businessName: data.businessName,
        category: data.category,
        address: data.address,
        coordinates: (_c = data.coordinates) !== null && _c !== void 0 ? _c : null,
        phone: data.phone,
        email: data.email,
        website: (_d = data.website) !== null && _d !== void 0 ? _d : "",
        logoUrl: (_e = data.logoUrl) !== null && _e !== void 0 ? _e : "",
        coverImageUrl: (_f = data.coverImageUrl) !== null && _f !== void 0 ? _f : "",
        operatingHours: (_g = data.operatingHours) !== null && _g !== void 0 ? _g : {},
        description: data.description,
        businessRegistrationNumber: data.businessRegistrationNumber,
        registrationPdfPath: data.registrationPdfPath,
        status: "pending",
        isCorporate: false,
        emailVerified: authUser.emailVerified,
        phoneVerified: (_h = userData.phoneVerified) !== null && _h !== void 0 ? _h : false,
        createdAt: helpers_1.FieldValue.serverTimestamp(),
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    };
    await vendorRef.set(vendorDoc, { merge: true });
    await helpers_1.db.doc(`users/${uid}`).set({
        vendorStatus: "pending",
        vendorId: uid,
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    await (0, helpers_1.createNotification)(uid, "Vendor Application Submitted", "Your vendor application is under review.", "vendor_pending");
    return { success: true, vendorId: uid };
});
/** Admin: approve/reject vendor */
exports.moderateVendor = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isAdmin)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Admin only");
    const { vendorId, action } = request.data;
    if (!vendorId || !["approve", "reject", "suspend"].includes(action)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid input");
    }
    const vendorRef = helpers_1.db.doc(`vendors/${vendorId}`);
    const snap = await vendorRef.get();
    if (!snap.exists)
        throw new https_1.HttpsError("not-found", "Vendor not found");
    const vendor = snap.data();
    if (action === "approve") {
        await vendorRef.update({ status: "active", updatedAt: helpers_1.FieldValue.serverTimestamp() });
        await helpers_1.db.doc(`users/${vendorId}`).update({
            vendorStatus: "approved",
            role: "vendor",
            updatedAt: helpers_1.FieldValue.serverTimestamp(),
        });
        const vwRef = helpers_1.db.doc(`vendorWallets/${vendorId}`);
        const vwSnap = await vwRef.get();
        if (!vwSnap.exists) {
            await vwRef.set({
                cashBalance: 0,
                pointsPool: 0,
                currency: "LKR",
                updatedAt: helpers_1.FieldValue.serverTimestamp(),
            });
        }
        await (0, helpers_1.createNotification)(vendorId, "Vendor Approved", `Welcome! ${vendor.businessName} is now active.`, "vendor_approved");
    }
    else if (action === "reject") {
        await vendorRef.update({ status: "rejected", updatedAt: helpers_1.FieldValue.serverTimestamp() });
        await helpers_1.db.doc(`users/${vendorId}`).update({ vendorStatus: "rejected", updatedAt: helpers_1.FieldValue.serverTimestamp() });
        await (0, helpers_1.createNotification)(vendorId, "Vendor Application Rejected", "Your vendor application was not approved.", "vendor_rejected");
    }
    else {
        await vendorRef.update({ status: "suspended", updatedAt: helpers_1.FieldValue.serverTimestamp() });
        await helpers_1.db.doc(`users/${vendorId}`).update({ vendorStatus: "suspended", updatedAt: helpers_1.FieldValue.serverTimestamp() });
    }
    await (0, helpers_1.createAuditLog)(request.auth.uid, action, "vendor", vendorId);
    return { success: true };
});
/** Create loyalty program */
exports.createLoyaltyProgram = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b, _c, _d;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isApprovedVendor)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Vendor only");
    const vendorId = request.auth.uid;
    const d = request.data;
    const program = {
        vendorId,
        programName: d.programName,
        earnRule: (_a = d.earnRule) !== null && _a !== void 0 ? _a : { spendAmount: 1000, pointsAwarded: 10 },
        redeemRule: (_b = d.redeemRule) !== null && _b !== void 0 ? _b : { pointsRequired: 1000, rewardDescription: "Reward" },
        isActive: d.isActive !== false,
        expiryPolicy: (_c = d.expiryPolicy) !== null && _c !== void 0 ? _c : "never",
        expiryDays: (_d = d.expiryDays) !== null && _d !== void 0 ? _d : 180,
        createdAt: helpers_1.FieldValue.serverTimestamp(),
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    };
    const ref = await helpers_1.db.collection("loyaltyPrograms").add(program);
    return { programId: ref.id };
});
/** Update loyalty program */
exports.updateLoyaltyProgram = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isApprovedVendor)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Vendor only");
    const { programId, updates } = request.data;
    const ref = helpers_1.db.doc(`loyaltyPrograms/${programId}`);
    const snap = await ref.get();
    if (!snap.exists || ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.vendorId) !== request.auth.uid) {
        throw new https_1.HttpsError("not-found", "Program not found");
    }
    await ref.update({ ...updates, updatedAt: helpers_1.FieldValue.serverTimestamp() });
    return { success: true };
});
/** Cashier: scan QR + enter purchase → pending grant */
exports.initiateLoyaltyGrant = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b, _c;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isApprovedVendor)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Vendor only");
    const vendorId = request.auth.uid;
    const { qrValue, programId, purchaseAmount } = request.data;
    const parsed = await (0, helpers_1.parseAndValidateQrStrict)(qrValue);
    if (!parsed)
        throw new https_1.HttpsError("invalid-argument", "Invalid or expired QR code");
    const programSnap = await helpers_1.db.doc(`loyaltyPrograms/${programId}`).get();
    if (!programSnap.exists || ((_a = programSnap.data()) === null || _a === void 0 ? void 0 : _a.vendorId) !== vendorId) {
        throw new https_1.HttpsError("not-found", "Program not found");
    }
    const program = programSnap.data();
    if (!program.isActive)
        throw new https_1.HttpsError("failed-precondition", "Program is paused");
    const points = (0, helpers_1.calcEarnPoints)(purchaseAmount, program.earnRule);
    if (points <= 0)
        throw new https_1.HttpsError("invalid-argument", "Purchase amount too low for points");
    const vwSnap = await helpers_1.db.doc(`vendorWallets/${vendorId}`).get();
    const pool = (_c = (_b = vwSnap.data()) === null || _b === void 0 ? void 0 : _b.pointsPool) !== null && _c !== void 0 ? _c : 0;
    if (pool < points)
        throw new https_1.HttpsError("failed-precondition", "Insufficient points pool — top up first");
    const grantRef = helpers_1.db.collection("loyaltyGrants").doc();
    await grantRef.set({
        vendorId,
        programId,
        userId: parsed.userId,
        purchaseAmount,
        pointsCalculated: points,
        status: "pending",
        grantedBy: request.auth.uid,
        createdAt: helpers_1.FieldValue.serverTimestamp(),
    });
    return { grantId: grantRef.id, userId: parsed.userId, pointsCalculated: points };
});
/** Vendor confirms pending loyalty grant — atomic debit pool + credit user */
exports.confirmLoyaltyGrant = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isApprovedVendor)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Vendor only");
    const vendorId = request.auth.uid;
    const { grantId } = request.data;
    try {
        await helpers_1.db.runTransaction(async (tx) => {
            var _a, _b, _c, _d;
            const grantRef = helpers_1.db.doc(`loyaltyGrants/${grantId}`);
            const grantSnap = await tx.get(grantRef);
            if (!grantSnap.exists)
                throw new Error("GRANT_NOT_FOUND");
            const grant = grantSnap.data();
            if (grant.vendorId !== vendorId)
                throw new Error("NOT_OWNER");
            if (grant.status !== "pending")
                throw new Error("ALREADY_PROCESSED");
            const points = grant.pointsCalculated;
            const userId = grant.userId;
            const vwRef = helpers_1.db.doc(`vendorWallets/${vendorId}`);
            const uwRef = helpers_1.db.doc(`wallets/${userId}`);
            const [vwSnap, uwSnap] = await Promise.all([tx.get(vwRef), tx.get(uwRef)]);
            const pool = (_b = (_a = vwSnap.data()) === null || _a === void 0 ? void 0 : _a.pointsPool) !== null && _b !== void 0 ? _b : 0;
            if (pool < points)
                throw new Error("INSUFFICIENT_POINTS_POOL");
            const loyaltyPoints = (_d = (_c = uwSnap.data()) === null || _c === void 0 ? void 0 : _c.loyaltyPoints) !== null && _d !== void 0 ? _d : 0;
            tx.update(vwRef, { pointsPool: pool - points, updatedAt: helpers_1.FieldValue.serverTimestamp() });
            tx.set(uwRef, {
                loyaltyPoints: loyaltyPoints + points,
                cashBalance: (0, helpers_1.cashBalance)(uwSnap.data()),
                balance: (0, helpers_1.cashBalance)(uwSnap.data()),
                currency: "LKR",
                updatedAt: helpers_1.FieldValue.serverTimestamp(),
            }, { merge: true });
            tx.update(grantRef, {
                status: "confirmed",
                confirmedAt: helpers_1.FieldValue.serverTimestamp(),
            });
            (0, helpers_1.recordTransaction)(tx, {
                userId,
                vendorId,
                fromWalletId: `vendorWallets/${vendorId}`,
                toWalletId: `wallets/${userId}`,
                amount: points,
                currency: "POINTS",
                type: "loyalty_earn",
                description: `Loyalty points from vendor ${vendorId}`,
                metadata: { grantId, programId: grant.programId },
            });
        });
    }
    catch (err) {
        mapHttpsError(err);
    }
    const grant = (await helpers_1.db.doc(`loyaltyGrants/${grantId}`).get()).data();
    await (0, helpers_1.createNotification)(grant.userId, "Loyalty Points Earned", `You received ${grant.pointsCalculated} loyalty points!`, "loyalty_earn");
    return { success: true };
});
/** Vendor requests points pool top-up — creates pending request for admin (REQ-VND-005) */
exports.topUpPointsPool = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isApprovedVendor)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Vendor only");
    const vendorId = request.auth.uid;
    const { pointsAmount, lkrAmount } = request.data;
    if (!pointsAmount || pointsAmount < 1 || !lkrAmount || lkrAmount < 1) {
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
    return { requestId: ref.id, status: "pending", message: "Awaiting admin approval" };
});
/** Admin confirms vendor points pool top-up from external payment */
exports.adminTopUpVendorWallet = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isAdmin)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Admin only");
    const { vendorId, cashAmount, pointsAmount } = request.data;
    const vwRef = helpers_1.db.doc(`vendorWallets/${vendorId}`);
    await helpers_1.db.runTransaction(async (tx) => {
        var _a, _b, _c;
        const snap = await tx.get(vwRef);
        const data = (_a = snap.data()) !== null && _a !== void 0 ? _a : { cashBalance: 0, pointsPool: 0 };
        tx.set(vwRef, {
            cashBalance: ((_b = data.cashBalance) !== null && _b !== void 0 ? _b : 0) + (cashAmount !== null && cashAmount !== void 0 ? cashAmount : 0),
            pointsPool: ((_c = data.pointsPool) !== null && _c !== void 0 ? _c : 0) + (pointsAmount !== null && pointsAmount !== void 0 ? pointsAmount : 0),
            currency: "LKR",
            updatedAt: helpers_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
    await (0, helpers_1.createAuditLog)(request.auth.uid, "topup_vendor_wallet", "vendor", vendorId, JSON.stringify({ cashAmount, pointsAmount }));
    return { success: true };
});
/** Generate or refresh user QR code */
exports.generateUserQr = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const qrValue = (0, helpers_1.buildQrValue)(uid);
    const settings = await (0, helpers_1.getAppSettings)();
    const expiresAt = helpers_1.Timestamp.fromMillis(Date.now() + settings.qrRotationHours * 60 * 60 * 1000);
    await helpers_1.db.doc(`userQrTokens/${uid}`).set({
        qrValue,
        expiresAt,
        createdAt: helpers_1.FieldValue.serverTimestamp(),
    });
    return { qrValue, expiresAt: expiresAt.toMillis() };
});
/** Validate QR server-side (for vendor apps) */
exports.validateUserQr = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const { qrValue } = request.data;
    const parsed = await (0, helpers_1.parseAndValidateQrStrict)(qrValue);
    if (!parsed)
        throw new https_1.HttpsError("invalid-argument", "Invalid or expired QR code");
    const userSnap = await helpers_1.db.doc(`users/${parsed.userId}`).get();
    if (!userSnap.exists)
        throw new https_1.HttpsError("not-found", "User not found");
    const user = userSnap.data();
    return {
        userId: parsed.userId,
        displayName: user.displayName,
        kycStatus: (_a = user.kycStatus) !== null && _a !== void 0 ? _a : "none",
    };
});
/** Create a Didit hosted KYC session (OCR + liveness + face match) */
exports.createKycSession = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const userSnap = await helpers_1.db.doc(`users/${uid}`).get();
    if (((_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.kycStatus) === "approved") {
        throw new https_1.HttpsError("failed-precondition", "KYC already approved");
    }
    return (0, kycProvider_1.createDiditHostedSession)(uid);
});
/** Didit webhook — receives real-time KYC status updates */
exports.diditWebhook = (0, https_1.onRequest)({ region: REGION }, async (req, res) => {
    var _a, _b;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    // Optionally verify HMAC-SHA256 signature when webhook secret is configured
    const settings = await (0, helpers_1.getAppSettings)();
    if (settings.diditWebhookSecret) {
        const { createHmac } = await Promise.resolve().then(() => __importStar(require("crypto")));
        const sigHeader = req.headers["x-signature-v2"];
        const tsHeader = req.headers["x-timestamp"];
        if (sigHeader && tsHeader) {
            const age = Math.abs(Date.now() / 1000 - parseInt(tsHeader, 10));
            if (age > 300) {
                res.status(401).json({ error: "Stale webhook" });
                return;
            }
            const canonical = JSON.stringify(req.body, Object.keys(req.body).sort());
            const expected = createHmac("sha256", settings.diditWebhookSecret)
                .update(canonical)
                .digest("hex");
            if (expected !== sigHeader) {
                res.status(401).json({ error: "Invalid signature" });
                return;
            }
        }
    }
    const payload = req.body;
    const userId = payload.vendor_data;
    const diditStatus = payload.status;
    if (!userId || !diditStatus) {
        res.status(400).json({ error: "Missing vendor_data or status" });
        return;
    }
    const kycStatus = (0, kycProvider_1.mapDiditSessionStatus)(diditStatus);
    try {
        await (0, kycProvider_1.applyKycOutcome)(userId, kycStatus, {
            diditStatus,
            sessionId: (_a = payload.session_id) !== null && _a !== void 0 ? _a : "",
            decision: (_b = payload.decision) !== null && _b !== void 0 ? _b : {},
            provider: "didit",
            mode: "hosted",
        });
        res.json({ received: true });
    }
    catch (err) {
        console.error("diditWebhook error:", err);
        res.status(500).json({ error: "Internal error" });
    }
});
/** Admin review KYC */
exports.reviewKyc = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isAdmin)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Admin only");
    const { userId, action, notes } = request.data;
    if (!userId || !["approve", "reject"].includes(action)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid input");
    }
    const status = action === "approve" ? "approved" : "rejected";
    await helpers_1.db.doc(`kycSubmissions/${userId}`).update({
        status,
        reviewNotes: notes !== null && notes !== void 0 ? notes : "",
        reviewedBy: request.auth.uid,
        reviewedAt: helpers_1.FieldValue.serverTimestamp(),
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    });
    await helpers_1.db.doc(`users/${userId}`).update({ kycStatus: status, updatedAt: helpers_1.FieldValue.serverTimestamp() });
    const settings = await (0, helpers_1.getAppSettings)();
    if (action === "approve") {
        await helpers_1.db.doc(`wallets/${userId}`).set({
            spendingLimitDaily: settings.defaultSpendingLimitDaily,
            spendingLimitMonthly: settings.defaultSpendingLimitMonthly,
            updatedAt: helpers_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    await (0, helpers_1.createNotification)(userId, action === "approve" ? "KYC Approved" : "KYC Rejected", action === "approve" ? "Your identity verification is complete." : "Your KYC submission was rejected.", `kyc_${status}`);
    await (0, helpers_1.createAuditLog)(request.auth.uid, action, "kyc", userId, notes);
    return { success: true };
});
/** Create promo code (admin or vendor) */
exports.createPromoCode = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const isAdminUser = await (0, helpers_1.isAdmin)(uid);
    const isVendor = await (0, helpers_1.isApprovedVendor)(uid);
    if (!isAdminUser && !isVendor)
        throw new https_1.HttpsError("permission-denied", "Not authorized");
    const d = request.data;
    const code = String((_a = d.code) !== null && _a !== void 0 ? _a : "").toUpperCase().trim();
    if (!code)
        throw new https_1.HttpsError("invalid-argument", "Code required");
    const existing = await helpers_1.db.collection("promoCodes").where("code", "==", code).limit(1).get();
    if (!existing.empty)
        throw new https_1.HttpsError("already-exists", "Code already exists");
    const promo = {
        code,
        discountType: (_b = d.discountType) !== null && _b !== void 0 ? _b : "percentage",
        discountValue: (_c = d.discountValue) !== null && _c !== void 0 ? _c : 10,
        minPurchase: (_d = d.minPurchase) !== null && _d !== void 0 ? _d : 0,
        maxUses: (_e = d.maxUses) !== null && _e !== void 0 ? _e : 100,
        usedCount: 0,
        validFrom: d.validFrom ? helpers_1.Timestamp.fromMillis(d.validFrom) : helpers_1.Timestamp.now(),
        validUntil: d.validUntil ? helpers_1.Timestamp.fromMillis(d.validUntil) : helpers_1.Timestamp.fromMillis(Date.now() + 30 * 86400000),
        applicableTo: (_f = d.applicableTo) !== null && _f !== void 0 ? _f : "all",
        vendorId: isVendor ? uid : (_g = d.vendorId) !== null && _g !== void 0 ? _g : null,
        createdBy: uid,
        isActive: true,
        createdAt: helpers_1.FieldValue.serverTimestamp(),
    };
    const ref = await helpers_1.db.collection("promoCodes").add(promo);
    return { promoId: ref.id };
});
/** Validate promo code */
exports.validatePromoCode = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const { code, purchaseAmount, context } = request.data;
    const normalized = code.toUpperCase().trim();
    const snap = await helpers_1.db.collection("promoCodes").where("code", "==", normalized).limit(1).get();
    if (snap.empty)
        throw new https_1.HttpsError("not-found", "Invalid promo code");
    const promo = snap.docs[0].data();
    const promoId = snap.docs[0].id;
    const now = Date.now();
    if (!promo.isActive)
        throw new https_1.HttpsError("failed-precondition", "Promo code inactive");
    if (promo.validFrom.toMillis() > now)
        throw new https_1.HttpsError("failed-precondition", "Promo not yet valid");
    if (promo.validUntil.toMillis() < now)
        throw new https_1.HttpsError("failed-precondition", "Promo expired");
    if (promo.usedCount >= promo.maxUses)
        throw new https_1.HttpsError("resource-exhausted", "Promo fully redeemed");
    if (purchaseAmount < ((_a = promo.minPurchase) !== null && _a !== void 0 ? _a : 0)) {
        throw new https_1.HttpsError("failed-precondition", `Minimum purchase LKR ${promo.minPurchase}`);
    }
    if (context && promo.applicableTo !== "all" && promo.applicableTo !== context) {
        throw new https_1.HttpsError("failed-precondition", "Promo not applicable");
    }
    const userRedemption = await helpers_1.db
        .collection("promoRedemptions")
        .where("promoId", "==", promoId)
        .where("userId", "==", request.auth.uid)
        .limit(1)
        .get();
    if (!userRedemption.empty)
        throw new https_1.HttpsError("already-exists", "You already used this code");
    let discount = 0;
    if (promo.discountType === "percentage") {
        discount = Math.round(purchaseAmount * (promo.discountValue / 100));
    }
    else {
        discount = Math.min(promo.discountValue, purchaseAmount);
    }
    return { promoId, code: normalized, discount, finalAmount: purchaseAmount - discount };
});
/** P2P transfer between users */
exports.transferP2P = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const fromId = request.auth.uid;
    const { toUserId, toLookup, amount, description } = request.data;
    let recipientId = toUserId;
    if (!recipientId && toLookup) {
        recipientId = (_a = (await (0, helpers_1.resolveUserByLookup)(toLookup))) !== null && _a !== void 0 ? _a : undefined;
        if (!recipientId)
            throw new https_1.HttpsError("not-found", "Recipient not found");
    }
    if (!recipientId || !amount || amount < 1)
        throw new https_1.HttpsError("invalid-argument", "Invalid input");
    if (recipientId === fromId)
        throw new https_1.HttpsError("invalid-argument", "Cannot transfer to yourself");
    try {
        await (0, helpers_1.requireKycApproved)(fromId);
        await (0, helpers_1.checkSpendingLimits)(fromId, amount);
        await helpers_1.db.runTransaction(async (tx) => {
            const fromRef = helpers_1.db.doc(`wallets/${fromId}`);
            const toRef = helpers_1.db.doc(`wallets/${recipientId}`);
            const [fromSnap, toSnap] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);
            const fromBal = (0, helpers_1.cashBalance)(fromSnap.data());
            if (fromBal < amount)
                throw new Error("INSUFFICIENT_BALANCE");
            const toBal = (0, helpers_1.cashBalance)(toSnap.data());
            tx.set(fromRef, { cashBalance: fromBal - amount, balance: fromBal - amount, updatedAt: helpers_1.FieldValue.serverTimestamp() }, { merge: true });
            tx.set(toRef, { cashBalance: toBal + amount, balance: toBal + amount, currency: "LKR", updatedAt: helpers_1.FieldValue.serverTimestamp() }, { merge: true });
            (0, helpers_1.recordTransaction)(tx, {
                userId: fromId,
                fromWalletId: `wallets/${fromId}`,
                toWalletId: `wallets/${recipientId}`,
                amount,
                currency: "LKR",
                type: "p2p_transfer",
                description: description !== null && description !== void 0 ? description : "P2P transfer",
                metadata: { toUserId: recipientId },
            });
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "DAILY_LIMIT_EXCEEDED")
            throw new https_1.HttpsError("resource-exhausted", "Daily spending limit exceeded");
        if (msg === "MONTHLY_LIMIT_EXCEEDED")
            throw new https_1.HttpsError("resource-exhausted", "Monthly spending limit exceeded");
        mapHttpsError(err);
    }
    await (0, helpers_1.createNotification)(recipientId, "Money Received", `You received LKR ${amount}`, "p2p_received");
    return { success: true, toUserId: recipientId };
});
/** Vendor withdrawal request */
exports.requestVendorWithdrawal = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isApprovedVendor)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Vendor only");
    const vendorId = request.auth.uid;
    const { amount, bankDetails } = request.data;
    if (!amount || amount < 100)
        throw new https_1.HttpsError("invalid-argument", "Minimum withdrawal LKR 100");
    const vwRef = helpers_1.db.doc(`vendorWallets/${vendorId}`);
    let requestId;
    // REQ-WAL balance reservation: atomically deduct from cashBalance and hold in pendingWithdrawal
    await helpers_1.db.runTransaction(async (tx) => {
        var _a, _b, _c, _d;
        const snap = await tx.get(vwRef);
        const cash = (_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.cashBalance) !== null && _b !== void 0 ? _b : 0;
        const pending = (_d = (_c = snap.data()) === null || _c === void 0 ? void 0 : _c.pendingWithdrawal) !== null && _d !== void 0 ? _d : 0;
        if (cash < amount)
            throw new https_1.HttpsError("failed-precondition", "Insufficient balance");
        const reqRef = helpers_1.db.collection("withdrawalRequests").doc();
        requestId = reqRef.id;
        // Reserve the funds
        tx.set(vwRef, {
            cashBalance: cash - amount,
            pendingWithdrawal: pending + amount,
            updatedAt: helpers_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(reqRef, {
            vendorId,
            amount,
            bankDetails,
            status: "pending",
            createdAt: helpers_1.FieldValue.serverTimestamp(),
        });
        const txRef = helpers_1.db.collection("transactions").doc();
        tx.set(txRef, {
            vendorId,
            amount,
            currency: "LKR",
            type: "withdrawal_request",
            status: "pending",
            description: "Vendor withdrawal request (funds reserved)",
            metadata: { requestId: reqRef.id, bankDetails },
            createdAt: helpers_1.FieldValue.serverTimestamp(),
        });
    });
    return { requestId: requestId };
});
/** Admin process vendor withdrawal */
exports.processVendorWithdrawal = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isAdmin)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Admin only");
    const { requestId, action } = request.data;
    const reqRef = helpers_1.db.doc(`withdrawalRequests/${requestId}`);
    const snap = await reqRef.get();
    if (!snap.exists)
        throw new https_1.HttpsError("not-found", "Request not found");
    const req = snap.data();
    if (req.status !== "pending")
        throw new https_1.HttpsError("failed-precondition", "Already processed");
    if (action === "approve") {
        // Funds are already reserved — just clear the pendingWithdrawal hold and mark processed
        await helpers_1.db.runTransaction(async (tx) => {
            var _a, _b;
            const vwRef = helpers_1.db.doc(`vendorWallets/${req.vendorId}`);
            const vwSnap = await tx.get(vwRef);
            const pending = (_b = (_a = vwSnap.data()) === null || _a === void 0 ? void 0 : _a.pendingWithdrawal) !== null && _b !== void 0 ? _b : 0;
            tx.set(vwRef, {
                pendingWithdrawal: Math.max(0, pending - req.amount),
                updatedAt: helpers_1.FieldValue.serverTimestamp(),
            }, { merge: true });
            tx.update(reqRef, { status: "processed", processedBy: request.auth.uid, processedAt: helpers_1.FieldValue.serverTimestamp() });
        });
        await (0, helpers_1.createNotification)(req.vendorId, "Withdrawal Processed", `LKR ${req.amount} withdrawal approved.`, "withdrawal_processed");
    }
    else {
        // Return reserved funds to cashBalance
        await helpers_1.db.runTransaction(async (tx) => {
            var _a, _b, _c, _d;
            const vwRef = helpers_1.db.doc(`vendorWallets/${req.vendorId}`);
            const vwSnap = await tx.get(vwRef);
            const cash = (_b = (_a = vwSnap.data()) === null || _a === void 0 ? void 0 : _a.cashBalance) !== null && _b !== void 0 ? _b : 0;
            const pending = (_d = (_c = vwSnap.data()) === null || _c === void 0 ? void 0 : _c.pendingWithdrawal) !== null && _d !== void 0 ? _d : 0;
            tx.set(vwRef, {
                cashBalance: cash + req.amount,
                pendingWithdrawal: Math.max(0, pending - req.amount),
                updatedAt: helpers_1.FieldValue.serverTimestamp(),
            }, { merge: true });
            tx.update(reqRef, { status: "rejected", processedBy: request.auth.uid, processedAt: helpers_1.FieldValue.serverTimestamp() });
        });
        await (0, helpers_1.createNotification)(req.vendorId, "Withdrawal Rejected", `Your LKR ${req.amount} withdrawal was rejected — funds returned to your balance.`, "withdrawal_rejected");
    }
    await (0, helpers_1.createAuditLog)(request.auth.uid, action, "withdrawal", requestId);
    return { success: true };
});
/** External webhook for loyalty point grants (Nexus-style) */
exports.webhookLoyaltyGrant = (0, https_1.onRequest)({ region: REGION }, async (req, res) => {
    var _a;
    if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
    }
    const apiKey = req.headers["x-vendor-api-key"];
    const { vendorId, userId, points, programId, externalRef } = req.body;
    if (!apiKey || !vendorId || !userId || !points) {
        res.status(400).json({ error: "Missing fields" });
        return;
    }
    const vendorSnap = await helpers_1.db.doc(`vendors/${vendorId}`).get();
    if (!vendorSnap.exists || ((_a = vendorSnap.data()) === null || _a === void 0 ? void 0 : _a.webhookApiKey) !== apiKey) {
        res.status(403).json({ error: "Unauthorized" });
        return;
    }
    try {
        await helpers_1.db.runTransaction(async (tx) => {
            var _a, _b, _c, _d;
            const vwRef = helpers_1.db.doc(`vendorWallets/${vendorId}`);
            const uwRef = helpers_1.db.doc(`wallets/${userId}`);
            const [vwSnap, uwSnap] = await Promise.all([tx.get(vwRef), tx.get(uwRef)]);
            const pool = (_b = (_a = vwSnap.data()) === null || _a === void 0 ? void 0 : _a.pointsPool) !== null && _b !== void 0 ? _b : 0;
            if (pool < points)
                throw new Error("INSUFFICIENT_POINTS_POOL");
            tx.update(vwRef, { pointsPool: pool - points, updatedAt: helpers_1.FieldValue.serverTimestamp() });
            tx.set(uwRef, {
                loyaltyPoints: ((_d = (_c = uwSnap.data()) === null || _c === void 0 ? void 0 : _c.loyaltyPoints) !== null && _d !== void 0 ? _d : 0) + points,
                updatedAt: helpers_1.FieldValue.serverTimestamp(),
            }, { merge: true });
            (0, helpers_1.recordTransaction)(tx, {
                userId,
                vendorId,
                amount: points,
                currency: "POINTS",
                type: "loyalty_earn",
                description: "External loyalty grant",
                metadata: { programId, externalRef, source: "webhook" },
            });
        });
        res.json({ success: true });
    }
    catch (_b) {
        res.status(400).json({ error: "Grant failed" });
    }
});
//# sourceMappingURL=platform.js.map