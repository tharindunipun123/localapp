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
exports.Timestamp = exports.FieldValue = exports.db = void 0;
exports.isAdmin = isAdmin;
exports.isApprovedVendor = isApprovedVendor;
exports.getUserDoc = getUserDoc;
exports.requireKycApproved = requireKycApproved;
exports.createNotification = createNotification;
exports.createAuditLog = createAuditLog;
exports.getAppSettings = getAppSettings;
exports.signQrPayload = signQrPayload;
exports.buildQrValue = buildQrValue;
exports.parseAndValidateQr = parseAndValidateQr;
exports.parseAndValidateQrStrict = parseAndValidateQrStrict;
exports.isCorporateVendor = isCorporateVendor;
exports.checkSpendingLimits = checkSpendingLimits;
exports.validatePromoInternal = validatePromoInternal;
exports.resolveUserByLookup = resolveUserByLookup;
exports.cashBalance = cashBalance;
exports.recordTransaction = recordTransaction;
exports.calcEarnPoints = calcEarnPoints;
exports.analyzeKycWithGemini = analyzeKycWithGemini;
const admin = __importStar(require("firebase-admin"));
const crypto_1 = require("crypto");
const firestore_1 = require("firebase-admin/firestore");
Object.defineProperty(exports, "FieldValue", { enumerable: true, get: function () { return firestore_1.FieldValue; } });
Object.defineProperty(exports, "Timestamp", { enumerable: true, get: function () { return firestore_1.Timestamp; } });
const notifyLkConfig_1 = require("./notifyLkConfig");
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.db = admin.firestore();
const QR_SECRET = process.env.QR_HMAC_SECRET || "localapp-dev-hmac-secret-change-in-production";
async function isAdmin(uid) {
    var _a;
    const user = await exports.db.doc(`users/${uid}`).get();
    const role = (_a = user.data()) === null || _a === void 0 ? void 0 : _a.role;
    return user.exists && typeof role === "string" && role.toLowerCase() === "admin";
}
async function isApprovedVendor(uid) {
    var _a;
    const user = await exports.db.doc(`users/${uid}`).get();
    return user.exists && ((_a = user.data()) === null || _a === void 0 ? void 0 : _a.vendorStatus) === "approved";
}
async function getUserDoc(uid) {
    const snap = await exports.db.doc(`users/${uid}`).get();
    return snap.exists ? snap.data() : null;
}
async function requireKycApproved(uid) {
    const user = await getUserDoc(uid);
    if (!user || user.kycStatus !== "approved") {
        throw new Error("KYC_REQUIRED");
    }
}
async function createNotification(userId, title, body, type, data) {
    await exports.db.collection("notifications").add({
        userId,
        title,
        body,
        type,
        read: false,
        data: data !== null && data !== void 0 ? data : {},
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
}
async function createAuditLog(adminId, action, targetType, targetId, details) {
    await exports.db.collection("auditLogs").add({
        adminId,
        action,
        targetType,
        targetId,
        details: details !== null && details !== void 0 ? details : "",
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
}
async function getAppSettings() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
    const snap = await exports.db.doc("settings/app").get();
    const data = (_a = snap.data()) !== null && _a !== void 0 ? _a : {};
    return {
        depositFeePercent: (_b = data.depositFeePercent) !== null && _b !== void 0 ? _b : 2.5,
        depositFeeFixed: (_c = data.depositFeeFixed) !== null && _c !== void 0 ? _c : 0,
        defaultSpendingLimitDaily: (_d = data.defaultSpendingLimitDaily) !== null && _d !== void 0 ? _d : 50000,
        defaultSpendingLimitMonthly: (_e = data.defaultSpendingLimitMonthly) !== null && _e !== void 0 ? _e : 200000,
        qrRotationHours: (_f = data.qrRotationHours) !== null && _f !== void 0 ? _f : 24,
        geminiApiKey: (_h = (_g = data.geminiApiKey) !== null && _g !== void 0 ? _g : process.env.GEMINI_API_KEY) !== null && _h !== void 0 ? _h : "",
        diditApiKey: (_k = (_j = data.diditApiKey) !== null && _j !== void 0 ? _j : process.env.DIDIT_API_KEY) !== null && _k !== void 0 ? _k : "",
        diditWorkflowId: (_m = (_l = data.diditWorkflowId) !== null && _l !== void 0 ? _l : process.env.DIDIT_WORKFLOW_ID) !== null && _m !== void 0 ? _m : "",
        diditWebhookSecret: (_p = (_o = data.diditWebhookSecret) !== null && _o !== void 0 ? _o : process.env.DIDIT_WEBHOOK_SECRET) !== null && _p !== void 0 ? _p : "",
        siteUrl: (_r = (_q = data.siteUrl) !== null && _q !== void 0 ? _q : process.env.SITE_URL) !== null && _r !== void 0 ? _r : "https://localapp-4020b.web.app",
        notifyLkUserId: (_t = (_s = data.notifyLkUserId) !== null && _s !== void 0 ? _s : process.env.NOTIFYLK_USER_ID) !== null && _t !== void 0 ? _t : notifyLkConfig_1.DEFAULT_NOTIFYLK.userId,
        notifyLkApiKey: (_v = (_u = data.notifyLkApiKey) !== null && _u !== void 0 ? _u : process.env.NOTIFYLK_API_KEY) !== null && _v !== void 0 ? _v : notifyLkConfig_1.DEFAULT_NOTIFYLK.apiKey,
        notifyLkSenderId: (_x = (_w = data.notifyLkSenderId) !== null && _w !== void 0 ? _w : process.env.NOTIFYLK_SENDER_ID) !== null && _x !== void 0 ? _x : notifyLkConfig_1.DEFAULT_NOTIFYLK.senderId,
    };
}
function signQrPayload(userId, timestamp) {
    return (0, crypto_1.createHmac)("sha256", QR_SECRET)
        .update(`${userId}:${timestamp}`)
        .digest("hex");
}
function buildQrValue(userId) {
    const ts = Date.now();
    const sig = signQrPayload(userId, ts);
    const payload = { u: userId, t: ts, s: sig };
    return Buffer.from(JSON.stringify(payload)).toString("base64url");
}
function parseAndValidateQr(qrValue, maxAgeMs) {
    try {
        const payload = JSON.parse(Buffer.from(qrValue, "base64url").toString());
        if (!payload.u || !payload.t || !payload.s)
            return null;
        const ts = Number(payload.t);
        const age = Date.now() - ts;
        const limit = maxAgeMs !== null && maxAgeMs !== void 0 ? maxAgeMs : 24 * 60 * 60 * 1000;
        if (age > limit || age < 0)
            return null;
        const expected = signQrPayload(payload.u, ts);
        if (expected !== payload.s)
            return null;
        return { userId: payload.u, timestamp: ts };
    }
    catch (_a) {
        return null;
    }
}
async function parseAndValidateQrStrict(qrValue) {
    var _a, _b, _c, _d, _e;
    const settings = await getAppSettings();
    const parsed = parseAndValidateQr(qrValue, settings.qrRotationHours * 60 * 60 * 1000);
    if (!parsed)
        return null;
    const tokenSnap = await exports.db.doc(`userQrTokens/${parsed.userId}`).get();
    if (tokenSnap.exists) {
        const stored = (_a = tokenSnap.data()) === null || _a === void 0 ? void 0 : _a.qrValue;
        if (stored && stored !== qrValue)
            return null;
        const expiresAt = (_e = (_d = (_c = (_b = tokenSnap.data()) === null || _b === void 0 ? void 0 : _b.expiresAt) === null || _c === void 0 ? void 0 : _c.toMillis) === null || _d === void 0 ? void 0 : _d.call(_c)) !== null && _e !== void 0 ? _e : 0;
        if (expiresAt && Date.now() > expiresAt)
            return null;
    }
    return { userId: parsed.userId };
}
async function isCorporateVendor(vendorId) {
    var _a;
    const snap = await exports.db.doc(`vendors/${vendorId}`).get();
    return snap.exists && ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.isCorporate) === true;
}
async function checkSpendingLimits(userId, amount) {
    var _a, _b, _c;
    const walletSnap = await exports.db.doc(`wallets/${userId}`).get();
    const wallet = (_a = walletSnap.data()) !== null && _a !== void 0 ? _a : {};
    const dailyLimit = (_b = wallet.spendingLimitDaily) !== null && _b !== void 0 ? _b : (await getAppSettings()).defaultSpendingLimitDaily;
    const monthlyLimit = (_c = wallet.spendingLimitMonthly) !== null && _c !== void 0 ? _c : (await getAppSettings()).defaultSpendingLimitMonthly;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const txSnap = await exports.db
        .collection("transactions")
        .where("userId", "==", userId)
        .where("createdAt", ">=", firestore_1.Timestamp.fromDate(startOfMonth))
        .get();
    let dailySpend = 0;
    let monthlySpend = 0;
    const spendTypes = new Set(["ticket_purchase", "spend", "p2p_transfer", "loyalty_redeem", "lottery_spend"]);
    txSnap.docs.forEach((d) => {
        var _a, _b, _c, _d;
        const t = d.data();
        if (t.currency !== "LKR" || !spendTypes.has(t.type))
            return;
        if (t.status && !["completed", "success"].includes(t.status))
            return;
        const amt = (_a = t.amount) !== null && _a !== void 0 ? _a : 0;
        monthlySpend += amt;
        const created = (_d = (_c = (_b = t.createdAt) === null || _b === void 0 ? void 0 : _b.toDate) === null || _c === void 0 ? void 0 : _c.call(_b)) !== null && _d !== void 0 ? _d : new Date(0);
        if (created >= startOfDay)
            dailySpend += amt;
    });
    if (dailySpend + amount > dailyLimit)
        throw new Error("DAILY_LIMIT_EXCEEDED");
    if (monthlySpend + amount > monthlyLimit)
        throw new Error("MONTHLY_LIMIT_EXCEEDED");
}
async function validatePromoInternal(code, userId, purchaseAmount, context) {
    var _a;
    const normalized = code.toUpperCase().trim();
    const snap = await exports.db.collection("promoCodes").where("code", "==", normalized).limit(1).get();
    if (snap.empty)
        throw new Error("PROMO_INVALID");
    const promo = snap.docs[0].data();
    const promoId = snap.docs[0].id;
    const now = Date.now();
    if (!promo.isActive)
        throw new Error("PROMO_INACTIVE");
    if (promo.validFrom.toMillis() > now)
        throw new Error("PROMO_NOT_YET");
    if (promo.validUntil.toMillis() < now)
        throw new Error("PROMO_EXPIRED");
    if (promo.usedCount >= promo.maxUses)
        throw new Error("PROMO_EXHAUSTED");
    if (purchaseAmount < ((_a = promo.minPurchase) !== null && _a !== void 0 ? _a : 0))
        throw new Error("PROMO_MIN_PURCHASE");
    if (context && promo.applicableTo !== "all" && promo.applicableTo !== context) {
        throw new Error("PROMO_NOT_APPLICABLE");
    }
    const userRedemption = await exports.db
        .collection("promoRedemptions")
        .where("promoId", "==", promoId)
        .where("userId", "==", userId)
        .limit(1)
        .get();
    if (!userRedemption.empty)
        throw new Error("PROMO_ALREADY_USED");
    let discount = 0;
    if (promo.discountType === "percentage") {
        discount = Math.round(purchaseAmount * (promo.discountValue / 100));
    }
    else {
        discount = Math.min(promo.discountValue, purchaseAmount);
    }
    return { promoId, code: normalized, discount };
}
async function resolveUserByLookup(lookup) {
    const trimmed = lookup.trim();
    if (!trimmed)
        return null;
    if (trimmed.length >= 20 && !trimmed.includes("@") && !trimmed.includes(" ")) {
        const direct = await exports.db.doc(`users/${trimmed}`).get();
        if (direct.exists)
            return trimmed;
    }
    const emailSnap = await exports.db.collection("users").where("email", "==", trimmed.toLowerCase()).limit(1).get();
    if (!emailSnap.empty)
        return emailSnap.docs[0].id;
    const phoneSnap = await exports.db.collection("users").where("phone", "==", trimmed).limit(1).get();
    if (!phoneSnap.empty)
        return phoneSnap.docs[0].id;
    const nameSnap = await exports.db.collection("users").where("displayName", "==", trimmed).limit(1).get();
    if (!nameSnap.empty)
        return nameSnap.docs[0].id;
    return null;
}
function cashBalance(data) {
    var _a, _b;
    if (!data)
        return 0;
    return (_b = (_a = data.cashBalance) !== null && _a !== void 0 ? _a : data.balance) !== null && _b !== void 0 ? _b : 0;
}
async function recordTransaction(tx, fields) {
    const ref = exports.db.collection("transactions").doc();
    tx.set(ref, {
        status: "completed",
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        ...fields,
    });
    return ref.id;
}
function calcEarnPoints(spendAmount, earnRule) {
    if (!earnRule.spendAmount || earnRule.spendAmount <= 0)
        return 0;
    return Math.floor((spendAmount / earnRule.spendAmount) * earnRule.pointsAwarded);
}
async function analyzeKycWithGemini(paths, apiKey) {
    var _a, _b, _c, _d, _e;
    if (!apiKey) {
        return { skipped: true, reason: "Gemini API key not configured — manual review required" };
    }
    const bucket = admin.storage().bucket();
    async function downloadBase64(path) {
        try {
            const [buf] = await bucket.file(path).download();
            return buf.toString("base64");
        }
        catch (_a) {
            return null;
        }
    }
    const [front, back, selfie] = await Promise.all([
        downloadBase64(paths.front),
        downloadBase64(paths.back),
        downloadBase64(paths.selfie),
    ]);
    if (!front || !back || !selfie) {
        return { error: "Could not read uploaded images", recommendation: "manual_review" };
    }
    const prompt = `You are a KYC document reviewer. Compare the ID card (front and back) with the selfie photo.
Respond in JSON only with keys: faceMatchLikely (boolean), idReadable (boolean), flags (array of strings), recommendation ("approve" | "reject" | "manual_review"), summary (string).
Be conservative — if uncertain, use manual_review.`;
    const body = {
        contents: [
            {
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: "image/jpeg", data: front } },
                    { inline_data: { mime_type: "image/jpeg", data: back } },
                    { inline_data: { mime_type: "image/jpeg", data: selfie } },
                ],
            },
        ],
        generationConfig: { responseMimeType: "application/json" },
    };
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            return { error: `Gemini API error ${res.status}`, recommendation: "manual_review" };
        }
        const json = (await res.json());
        const text = (_e = (_d = (_c = (_b = (_a = json.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text;
        if (!text)
            return { recommendation: "manual_review", summary: "No AI response" };
        return JSON.parse(text);
    }
    catch (err) {
        return {
            error: err instanceof Error ? err.message : "Gemini failed",
            recommendation: "manual_review",
        };
    }
}
//# sourceMappingURL=helpers.js.map