import * as admin from "firebase-admin";
import { createHmac } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { DEFAULT_NOTIFYLK } from "./notifyLkConfig";

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();

const QR_SECRET =
  process.env.QR_HMAC_SECRET || "localapp-dev-hmac-secret-change-in-production";

export async function isAdmin(uid: string): Promise<boolean> {
  const user = await db.doc(`users/${uid}`).get();
  const role = user.data()?.role;
  return user.exists && typeof role === "string" && role.toLowerCase() === "admin";
}

export async function isApprovedVendor(uid: string): Promise<boolean> {
  const user = await db.doc(`users/${uid}`).get();
  return user.exists && user.data()?.vendorStatus === "approved";
}

export async function getUserDoc(uid: string) {
  const snap = await db.doc(`users/${uid}`).get();
  return snap.exists ? snap.data()! : null;
}

export async function requireKycApproved(uid: string): Promise<void> {
  const user = await getUserDoc(uid);
  if (!user || user.kycStatus !== "approved") {
    throw new Error("KYC_REQUIRED");
  }
}

export async function createNotification(
  userId: string,
  title: string,
  body: string,
  type: string,
  data?: Record<string, string>
) {
  await db.collection("notifications").add({
    userId,
    title,
    body,
    type,
    read: false,
    data: data ?? {},
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function createAuditLog(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  details?: string
) {
  await db.collection("auditLogs").add({
    adminId,
    action,
    targetType,
    targetId,
    details: details ?? "",
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function getAppSettings() {
  const snap = await db.doc("settings/app").get();
  const data = snap.data() ?? {};
  return {
    depositFeePercent: data.depositFeePercent ?? 2.5,
    depositFeeFixed: data.depositFeeFixed ?? 0,
    defaultSpendingLimitDaily: data.defaultSpendingLimitDaily ?? 50000,
    defaultSpendingLimitMonthly: data.defaultSpendingLimitMonthly ?? 200000,
    qrRotationHours: data.qrRotationHours ?? 24,
    geminiApiKey: data.geminiApiKey ?? process.env.GEMINI_API_KEY ?? "",
    diditApiKey: data.diditApiKey ?? process.env.DIDIT_API_KEY ?? "",
    diditWorkflowId: data.diditWorkflowId ?? process.env.DIDIT_WORKFLOW_ID ?? "",
    diditWebhookSecret: data.diditWebhookSecret ?? process.env.DIDIT_WEBHOOK_SECRET ?? "",
    siteUrl: data.siteUrl ?? process.env.SITE_URL ?? "https://localapp-4020b.web.app",
    notifyLkUserId: data.notifyLkUserId ?? process.env.NOTIFYLK_USER_ID ?? DEFAULT_NOTIFYLK.userId,
    notifyLkApiKey: data.notifyLkApiKey ?? process.env.NOTIFYLK_API_KEY ?? DEFAULT_NOTIFYLK.apiKey,
    notifyLkSenderId: data.notifyLkSenderId ?? process.env.NOTIFYLK_SENDER_ID ?? DEFAULT_NOTIFYLK.senderId,
  };
}

export function signQrPayload(userId: string, timestamp: number): string {
  return createHmac("sha256", QR_SECRET)
    .update(`${userId}:${timestamp}`)
    .digest("hex");
}

export function buildQrValue(userId: string): string {
  const ts = Date.now();
  const sig = signQrPayload(userId, ts);
  const payload = { u: userId, t: ts, s: sig };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function parseAndValidateQr(qrValue: string, maxAgeMs?: number): { userId: string; timestamp: number } | null {
  try {
    const payload = JSON.parse(Buffer.from(qrValue, "base64url").toString());
    if (!payload.u || !payload.t || !payload.s) return null;
    const ts = Number(payload.t);
    const age = Date.now() - ts;
    const limit = maxAgeMs ?? 24 * 60 * 60 * 1000;
    if (age > limit || age < 0) return null;
    const expected = signQrPayload(payload.u, ts);
    if (expected !== payload.s) return null;
    return { userId: payload.u as string, timestamp: ts };
  } catch {
    return null;
  }
}

export async function parseAndValidateQrStrict(qrValue: string): Promise<{ userId: string } | null> {
  const settings = await getAppSettings();
  const parsed = parseAndValidateQr(qrValue, settings.qrRotationHours * 60 * 60 * 1000);
  if (!parsed) return null;

  const tokenSnap = await db.doc(`userQrTokens/${parsed.userId}`).get();
  if (tokenSnap.exists) {
    const stored = tokenSnap.data()?.qrValue;
    if (stored && stored !== qrValue) return null;
    const expiresAt = tokenSnap.data()?.expiresAt?.toMillis?.() ?? 0;
    if (expiresAt && Date.now() > expiresAt) return null;
  }

  return { userId: parsed.userId };
}

export async function isCorporateVendor(vendorId: string): Promise<boolean> {
  const snap = await db.doc(`vendors/${vendorId}`).get();
  return snap.exists && snap.data()?.isCorporate === true;
}

export async function checkSpendingLimits(userId: string, amount: number): Promise<void> {
  const walletSnap = await db.doc(`wallets/${userId}`).get();
  const wallet = walletSnap.data() ?? {};
  const dailyLimit = wallet.spendingLimitDaily ?? (await getAppSettings()).defaultSpendingLimitDaily;
  const monthlyLimit = wallet.spendingLimitMonthly ?? (await getAppSettings()).defaultSpendingLimitMonthly;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const txSnap = await db
    .collection("transactions")
    .where("userId", "==", userId)
    .where("createdAt", ">=", Timestamp.fromDate(startOfMonth))
    .get();

  let dailySpend = 0;
  let monthlySpend = 0;
  const spendTypes = new Set(["ticket_purchase", "spend", "p2p_transfer", "loyalty_redeem", "lottery_spend"]);

  txSnap.docs.forEach((d) => {
    const t = d.data();
    if (t.currency !== "LKR" || !spendTypes.has(t.type)) return;
    if (t.status && !["completed", "success"].includes(t.status)) return;
    const amt = t.amount ?? 0;
    monthlySpend += amt;
    const created = t.createdAt?.toDate?.() ?? new Date(0);
    if (created >= startOfDay) dailySpend += amt;
  });

  if (dailySpend + amount > dailyLimit) throw new Error("DAILY_LIMIT_EXCEEDED");
  if (monthlySpend + amount > monthlyLimit) throw new Error("MONTHLY_LIMIT_EXCEEDED");
}

export interface PromoValidation {
  promoId: string;
  code: string;
  discount: number;
}

export async function validatePromoInternal(
  code: string,
  userId: string,
  purchaseAmount: number,
  context?: string
): Promise<PromoValidation> {
  const normalized = code.toUpperCase().trim();
  const snap = await db.collection("promoCodes").where("code", "==", normalized).limit(1).get();
  if (snap.empty) throw new Error("PROMO_INVALID");

  const promo = snap.docs[0].data();
  const promoId = snap.docs[0].id;
  const now = Date.now();

  if (!promo.isActive) throw new Error("PROMO_INACTIVE");
  if (promo.validFrom.toMillis() > now) throw new Error("PROMO_NOT_YET");
  if (promo.validUntil.toMillis() < now) throw new Error("PROMO_EXPIRED");
  if (promo.usedCount >= promo.maxUses) throw new Error("PROMO_EXHAUSTED");
  if (purchaseAmount < (promo.minPurchase ?? 0)) throw new Error("PROMO_MIN_PURCHASE");
  if (context && promo.applicableTo !== "all" && promo.applicableTo !== context) {
    throw new Error("PROMO_NOT_APPLICABLE");
  }

  const userRedemption = await db
    .collection("promoRedemptions")
    .where("promoId", "==", promoId)
    .where("userId", "==", userId)
    .limit(1)
    .get();
  if (!userRedemption.empty) throw new Error("PROMO_ALREADY_USED");

  let discount = 0;
  if (promo.discountType === "percentage") {
    discount = Math.round(purchaseAmount * (promo.discountValue / 100));
  } else {
    discount = Math.min(promo.discountValue, purchaseAmount);
  }

  return { promoId, code: normalized, discount };
}

export async function resolveUserByLookup(lookup: string): Promise<string | null> {
  const trimmed = lookup.trim();
  if (!trimmed) return null;

  if (trimmed.length >= 20 && !trimmed.includes("@") && !trimmed.includes(" ")) {
    const direct = await db.doc(`users/${trimmed}`).get();
    if (direct.exists) return trimmed;
  }

  const emailSnap = await db.collection("users").where("email", "==", trimmed.toLowerCase()).limit(1).get();
  if (!emailSnap.empty) return emailSnap.docs[0].id;

  const phoneSnap = await db.collection("users").where("phone", "==", trimmed).limit(1).get();
  if (!phoneSnap.empty) return phoneSnap.docs[0].id;

  const nameSnap = await db.collection("users").where("displayName", "==", trimmed).limit(1).get();
  if (!nameSnap.empty) return nameSnap.docs[0].id;

  return null;
}

export function cashBalance(data: FirebaseFirestore.DocumentData | undefined): number {
  if (!data) return 0;
  return data.cashBalance ?? data.balance ?? 0;
}

export async function recordTransaction(tx: FirebaseFirestore.Transaction, fields: Record<string, unknown>) {
  const ref = db.collection("transactions").doc();
  tx.set(ref, {
    status: "completed",
    createdAt: FieldValue.serverTimestamp(),
    ...fields,
  });
  return ref.id;
}

export function calcEarnPoints(spendAmount: number, earnRule: { spendAmount: number; pointsAwarded: number }) {
  if (!earnRule.spendAmount || earnRule.spendAmount <= 0) return 0;
  return Math.floor((spendAmount / earnRule.spendAmount) * earnRule.pointsAwarded);
}

export async function analyzeKycWithGemini(
  paths: { front: string; back: string; selfie: string },
  apiKey: string
): Promise<Record<string, unknown>> {
  if (!apiKey) {
    return { skipped: true, reason: "Gemini API key not configured — manual review required" };
  }

  const bucket = admin.storage().bucket();

  async function downloadBase64(path: string): Promise<string | null> {
    try {
      const [buf] = await bucket.file(path).download();
      return buf.toString("base64");
    } catch {
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
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      return { error: `Gemini API error ${res.status}`, recommendation: "manual_review" };
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { recommendation: "manual_review", summary: "No AI response" };
    return JSON.parse(text) as Record<string, unknown>;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Gemini failed",
      recommendation: "manual_review",
    };
  }
}

export { FieldValue, Timestamp };
