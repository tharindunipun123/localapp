"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotifyLkConfig = getNotifyLkConfig;
exports.toNotifyLkPhone = toNotifyLkPhone;
exports.toE164Phone = toE164Phone;
exports.sendNotifyLkSms = sendNotifyLkSms;
const helpers_1 = require("./helpers");
async function getNotifyLkConfig() {
    var _a, _b, _c, _d, _e, _f;
    const settings = await (0, helpers_1.getAppSettings)();
    return {
        userId: (_b = (_a = settings.notifyLkUserId) !== null && _a !== void 0 ? _a : process.env.NOTIFYLK_USER_ID) !== null && _b !== void 0 ? _b : "",
        apiKey: (_d = (_c = settings.notifyLkApiKey) !== null && _c !== void 0 ? _c : process.env.NOTIFYLK_API_KEY) !== null && _d !== void 0 ? _d : "",
        senderId: (_f = (_e = settings.notifyLkSenderId) !== null && _e !== void 0 ? _e : process.env.NOTIFYLK_SENDER_ID) !== null && _f !== void 0 ? _f : "NotifyDEMO",
    };
}
/** E.164 (+94771234567) or local (0712345678) → Notify.lk format 94771234567 */
function toNotifyLkPhone(phone) {
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith("94"))
        return digits;
    if (digits.startsWith("0"))
        return `94${digits.slice(1)}`;
    if (digits.length === 9)
        return `94${digits}`;
    throw new Error("Invalid Sri Lankan phone number");
}
/** Store/display as +94771234567 */
function toE164Phone(phone) {
    const notify = toNotifyLkPhone(phone);
    return `+${notify}`;
}
async function sendNotifyLkSms(to, message) {
    var _a;
    const config = await getNotifyLkConfig();
    if (!config.userId || !config.apiKey) {
        throw new Error("NOTIFYLK_NOT_CONFIGURED");
    }
    const body = new URLSearchParams({
        user_id: config.userId,
        api_key: config.apiKey,
        sender_id: config.senderId,
        to,
        message,
    });
    const res = await fetch("https://app.notify.lk/api/v1/send", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });
    const data = (await res.json().catch(() => ({})));
    if (!res.ok || data.status === "error") {
        throw new Error((_a = data.message) !== null && _a !== void 0 ? _a : `Notify.lk HTTP ${res.status}`);
    }
}
//# sourceMappingURL=notifyLk.js.map