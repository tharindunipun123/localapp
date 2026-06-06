import { createHash, randomInt } from "crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { db, FieldValue, Timestamp } from "./helpers";
import { getNotifyLkConfig, sendNotifyLkSms, toE164Phone, toNotifyLkPhone } from "./notifyLk";

const REGION = "us-central1";
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;

function hashOtp(code: string, uid: string): string {
  return createHash("sha256").update(`${uid}:${code}:localapp`).digest("hex");
}

function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

export const sendPhoneOtp = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");

  const uid = request.auth.uid;
  const { phone } = request.data as { phone?: string };
  if (!phone?.trim()) throw new HttpsError("invalid-argument", "Phone number is required");

  let notifyPhone: string;
  let e164Phone: string;
  try {
    notifyPhone = toNotifyLkPhone(phone.trim());
    e164Phone = toE164Phone(phone.trim());
  } catch {
    throw new HttpsError("invalid-argument", "Enter a valid Sri Lankan mobile number");
  }

  const otpRef = db.doc(`phoneOtps/${uid}`);
  const existing = await otpRef.get();
  const now = Date.now();

  if (existing.exists) {
    const data = existing.data()!;
    const sendCount = data.sendCount ?? 1;
    const windowStart = data.sendWindowStart?.toMillis?.() ?? data.createdAt?.toMillis?.() ?? 0;
    if (now - windowStart < 60 * 60 * 1000 && sendCount >= MAX_SENDS_PER_HOUR) {
      throw new HttpsError("resource-exhausted", "Too many OTP requests. Try again in an hour.");
    }
  }

  const code = generateOtpCode();
  const expiresAt = Timestamp.fromMillis(now + OTP_TTL_MS);
  const sendWindowStart =
    existing.exists &&
    now - (existing.data()?.sendWindowStart?.toMillis?.() ?? 0) < 60 * 60 * 1000
      ? existing.data()!.sendWindowStart
      : Timestamp.fromMillis(now);
  const sendCount =
    existing.exists &&
    now - (existing.data()?.sendWindowStart?.toMillis?.() ?? 0) < 60 * 60 * 1000
      ? (existing.data()!.sendCount ?? 0) + 1
      : 1;

  await otpRef.set({
    phone: notifyPhone,
    phoneE164: e164Phone,
    codeHash: hashOtp(code, uid),
    expiresAt,
    attempts: 0,
    sendCount,
    sendWindowStart,
    createdAt: FieldValue.serverTimestamp(),
  });

  const smsMessage = `Your Local App verification code is ${code}. Valid for 10 minutes.`;

  try {
    const config = await getNotifyLkConfig();
    if (!config.userId || !config.apiKey) {
      logger.warn(`Notify.lk not configured — OTP for ${uid} / ${e164Phone}: ${code}`);
      return {
        success: true,
        phone: e164Phone,
        devMode: true,
        message: "SMS gateway not configured. Ask admin to set Notify.lk credentials, or check function logs.",
      };
    }
    await sendNotifyLkSms(notifyPhone, smsMessage);
    return { success: true, phone: e164Phone };
  } catch (err) {
    await otpRef.delete().catch(() => {});
    const msg = err instanceof Error ? err.message : "Failed to send SMS";
    if (msg === "NOTIFYLK_NOT_CONFIGURED") {
      throw new HttpsError("failed-precondition", "Notify.lk is not configured in admin settings.");
    }
    throw new HttpsError("internal", `Could not send SMS: ${msg}`);
  }
});

export const verifyPhoneOtp = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");

  const uid = request.auth.uid;
  const { phone, code } = request.data as { phone?: string; code?: string };
  if (!phone?.trim() || !code?.trim()) {
    throw new HttpsError("invalid-argument", "Phone and OTP code are required");
  }

  let notifyPhone: string;
  let e164Phone: string;
  try {
    notifyPhone = toNotifyLkPhone(phone.trim());
    e164Phone = toE164Phone(phone.trim());
  } catch {
    throw new HttpsError("invalid-argument", "Invalid phone number");
  }

  const otpRef = db.doc(`phoneOtps/${uid}`);
  const snap = await otpRef.get();
  if (!snap.exists) {
    throw new HttpsError("failed-precondition", "No OTP sent. Request a new code.");
  }

  const data = snap.data()!;
  if (data.phone !== notifyPhone) {
    throw new HttpsError("invalid-argument", "Phone number does not match the OTP request");
  }

  if (data.expiresAt.toMillis() < Date.now()) {
    await otpRef.delete();
    throw new HttpsError("deadline-exceeded", "OTP expired. Request a new code.");
  }

  const attempts = (data.attempts ?? 0) + 1;
  if (attempts > MAX_VERIFY_ATTEMPTS) {
    await otpRef.delete();
    throw new HttpsError("resource-exhausted", "Too many wrong attempts. Request a new code.");
  }

  if (hashOtp(code.trim(), uid) !== data.codeHash) {
    await otpRef.update({ attempts });
    throw new HttpsError("invalid-argument", "Incorrect OTP code");
  }

  await db.doc(`users/${uid}`).set(
    {
      phone: e164Phone,
      phoneVerified: true,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const vendorSnap = await db.doc(`vendors/${uid}`).get();
  if (vendorSnap.exists) {
    await db.doc(`vendors/${uid}`).update({
      phoneVerified: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await otpRef.delete();

  return { success: true, phone: e164Phone, phoneVerified: true };
});
