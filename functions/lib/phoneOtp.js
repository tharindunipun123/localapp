"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPhoneOtp = exports.sendPhoneOtp = void 0;
const crypto_1 = require("crypto");
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const helpers_1 = require("./helpers");
const notifyLk_1 = require("./notifyLk");
const REGION = "us-central1";
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;
function hashOtp(code, uid) {
    return (0, crypto_1.createHash)("sha256").update(`${uid}:${code}:localapp`).digest("hex");
}
function generateOtpCode() {
    return String((0, crypto_1.randomInt)(100000, 999999));
}
exports.sendPhoneOtp = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const { phone } = request.data;
    if (!(phone === null || phone === void 0 ? void 0 : phone.trim()))
        throw new https_1.HttpsError("invalid-argument", "Phone number is required");
    let notifyPhone;
    let e164Phone;
    try {
        notifyPhone = (0, notifyLk_1.toNotifyLkPhone)(phone.trim());
        e164Phone = (0, notifyLk_1.toE164Phone)(phone.trim());
    }
    catch (_s) {
        throw new https_1.HttpsError("invalid-argument", "Enter a valid Sri Lankan mobile number");
    }
    const otpRef = helpers_1.db.doc(`phoneOtps/${uid}`);
    const existing = await otpRef.get();
    const now = Date.now();
    if (existing.exists) {
        const data = existing.data();
        const sendCount = (_a = data.sendCount) !== null && _a !== void 0 ? _a : 1;
        const windowStart = (_g = (_d = (_c = (_b = data.sendWindowStart) === null || _b === void 0 ? void 0 : _b.toMillis) === null || _c === void 0 ? void 0 : _c.call(_b)) !== null && _d !== void 0 ? _d : (_f = (_e = data.createdAt) === null || _e === void 0 ? void 0 : _e.toMillis) === null || _f === void 0 ? void 0 : _f.call(_e)) !== null && _g !== void 0 ? _g : 0;
        if (now - windowStart < 60 * 60 * 1000 && sendCount >= MAX_SENDS_PER_HOUR) {
            throw new https_1.HttpsError("resource-exhausted", "Too many OTP requests. Try again in an hour.");
        }
    }
    const code = generateOtpCode();
    const expiresAt = helpers_1.Timestamp.fromMillis(now + OTP_TTL_MS);
    const sendWindowStart = existing.exists &&
        now - ((_l = (_k = (_j = (_h = existing.data()) === null || _h === void 0 ? void 0 : _h.sendWindowStart) === null || _j === void 0 ? void 0 : _j.toMillis) === null || _k === void 0 ? void 0 : _k.call(_j)) !== null && _l !== void 0 ? _l : 0) < 60 * 60 * 1000
        ? existing.data().sendWindowStart
        : helpers_1.Timestamp.fromMillis(now);
    const sendCount = existing.exists &&
        now - ((_q = (_p = (_o = (_m = existing.data()) === null || _m === void 0 ? void 0 : _m.sendWindowStart) === null || _o === void 0 ? void 0 : _o.toMillis) === null || _p === void 0 ? void 0 : _p.call(_o)) !== null && _q !== void 0 ? _q : 0) < 60 * 60 * 1000
        ? ((_r = existing.data().sendCount) !== null && _r !== void 0 ? _r : 0) + 1
        : 1;
    await otpRef.set({
        phone: notifyPhone,
        phoneE164: e164Phone,
        codeHash: hashOtp(code, uid),
        expiresAt,
        attempts: 0,
        sendCount,
        sendWindowStart,
        createdAt: helpers_1.FieldValue.serverTimestamp(),
    });
    const smsMessage = `Your Local App verification code is ${code}. Valid for 10 minutes.`;
    try {
        const config = await (0, notifyLk_1.getNotifyLkConfig)();
        if (!config.userId || !config.apiKey) {
            firebase_functions_1.logger.warn(`Notify.lk not configured — OTP for ${uid} / ${e164Phone}: ${code}`);
            return {
                success: true,
                phone: e164Phone,
                devMode: true,
                message: "SMS gateway not configured. Ask admin to set Notify.lk credentials, or check function logs.",
            };
        }
        await (0, notifyLk_1.sendNotifyLkSms)(notifyPhone, smsMessage);
        return { success: true, phone: e164Phone };
    }
    catch (err) {
        await otpRef.delete().catch(() => { });
        const msg = err instanceof Error ? err.message : "Failed to send SMS";
        if (msg === "NOTIFYLK_NOT_CONFIGURED") {
            throw new https_1.HttpsError("failed-precondition", "Notify.lk is not configured in admin settings.");
        }
        throw new https_1.HttpsError("internal", `Could not send SMS: ${msg}`);
    }
});
exports.verifyPhoneOtp = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const { phone, code } = request.data;
    if (!(phone === null || phone === void 0 ? void 0 : phone.trim()) || !(code === null || code === void 0 ? void 0 : code.trim())) {
        throw new https_1.HttpsError("invalid-argument", "Phone and OTP code are required");
    }
    let notifyPhone;
    let e164Phone;
    try {
        notifyPhone = (0, notifyLk_1.toNotifyLkPhone)(phone.trim());
        e164Phone = (0, notifyLk_1.toE164Phone)(phone.trim());
    }
    catch (_b) {
        throw new https_1.HttpsError("invalid-argument", "Invalid phone number");
    }
    const otpRef = helpers_1.db.doc(`phoneOtps/${uid}`);
    const snap = await otpRef.get();
    if (!snap.exists) {
        throw new https_1.HttpsError("failed-precondition", "No OTP sent. Request a new code.");
    }
    const data = snap.data();
    if (data.phone !== notifyPhone) {
        throw new https_1.HttpsError("invalid-argument", "Phone number does not match the OTP request");
    }
    if (data.expiresAt.toMillis() < Date.now()) {
        await otpRef.delete();
        throw new https_1.HttpsError("deadline-exceeded", "OTP expired. Request a new code.");
    }
    const attempts = ((_a = data.attempts) !== null && _a !== void 0 ? _a : 0) + 1;
    if (attempts > MAX_VERIFY_ATTEMPTS) {
        await otpRef.delete();
        throw new https_1.HttpsError("resource-exhausted", "Too many wrong attempts. Request a new code.");
    }
    if (hashOtp(code.trim(), uid) !== data.codeHash) {
        await otpRef.update({ attempts });
        throw new https_1.HttpsError("invalid-argument", "Incorrect OTP code");
    }
    await helpers_1.db.doc(`users/${uid}`).set({
        phone: e164Phone,
        phoneVerified: true,
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    const vendorSnap = await helpers_1.db.doc(`vendors/${uid}`).get();
    if (vendorSnap.exists) {
        await helpers_1.db.doc(`vendors/${uid}`).update({
            phoneVerified: true,
            updatedAt: helpers_1.FieldValue.serverTimestamp(),
        });
    }
    await otpRef.delete();
    return { success: true, phone: e164Phone, phoneVerified: true };
});
//# sourceMappingURL=phoneOtp.js.map