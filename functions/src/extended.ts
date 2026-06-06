import { onCall, HttpsError } from "firebase-functions/v2/https";
import { randomBytes } from "crypto";
import {
  db,
  isAdmin,
  isApprovedVendor,
  isCorporateVendor,
  requireKycApproved,
  createNotification,
  createAuditLog,
  parseAndValidateQrStrict,
  recordTransaction,
  validatePromoInternal,
  resolveUserByLookup,
  FieldValue,
} from "./helpers";

const REGION = "us-central1";

function mapErr(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === "KYC_REQUIRED") throw new HttpsError("permission-denied", "KYC verification required", { code: "KYC_REQUIRED" });
  if (msg === "INSUFFICIENT_BALANCE") throw new HttpsError("failed-precondition", "Insufficient balance");
  if (msg === "INSUFFICIENT_POINTS") throw new HttpsError("failed-precondition", "Insufficient loyalty points");
  if (msg === "DAILY_LIMIT_EXCEEDED") throw new HttpsError("resource-exhausted", "Daily spending limit exceeded");
  if (msg === "MONTHLY_LIMIT_EXCEEDED") throw new HttpsError("resource-exhausted", "Monthly spending limit exceeded");
  if (msg.startsWith("PROMO_")) throw new HttpsError("invalid-argument", "Invalid promo code");
  throw err instanceof HttpsError ? err : new HttpsError("internal", msg);
}

/** REQ-VND-005: Vendor requests pool top-up — pending admin approval */
export const requestPointsPoolTopUp = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isApprovedVendor(request.auth.uid))) throw new HttpsError("permission-denied", "Vendor only");

  const vendorId = request.auth.uid;
  const { pointsAmount, lkrAmount } = request.data as { pointsAmount: number; lkrAmount: number };
  if (!pointsAmount || !lkrAmount || pointsAmount < 1 || lkrAmount < 1) {
    throw new HttpsError("invalid-argument", "Invalid amounts");
  }

  const vwSnap = await db.doc(`vendorWallets/${vendorId}`).get();
  const cash = vwSnap.data()?.cashBalance ?? 0;
  if (cash < lkrAmount) throw new HttpsError("failed-precondition", "Insufficient vendor cash balance");

  const ref = await db.collection("poolTopUpRequests").add({
    vendorId,
    pointsAmount,
    lkrAmount,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  });

  return { requestId: ref.id };
});

/** Admin approves points pool top-up */
export const approvePointsPoolTopUp = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isAdmin(request.auth.uid))) throw new HttpsError("permission-denied", "Admin only");

  const { requestId, action } = request.data as { requestId: string; action: string };
  const reqRef = db.doc(`poolTopUpRequests/${requestId}`);
  const snap = await reqRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Request not found");
  const req = snap.data()!;
  if (req.status !== "pending") throw new HttpsError("failed-precondition", "Already processed");

  if (action === "approve") {
    await db.runTransaction(async (tx) => {
      const vwRef = db.doc(`vendorWallets/${req.vendorId}`);
      const vwSnap = await tx.get(vwRef);
      const cash = vwSnap.data()?.cashBalance ?? 0;
      if (cash < req.lkrAmount) throw new Error("INSUFFICIENT_BALANCE");
      const pool = vwSnap.data()?.pointsPool ?? 0;
      tx.update(vwRef, {
        cashBalance: cash - req.lkrAmount,
        pointsPool: pool + req.pointsAmount,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(reqRef, { status: "approved", processedBy: request.auth!.uid, processedAt: FieldValue.serverTimestamp() });
      recordTransaction(tx, {
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
    await createNotification(req.vendorId as string, "Points Pool Topped Up", `${req.pointsAmount} points added to your pool.`, "pool_topup");
  } else {
    await reqRef.update({ status: "rejected", processedBy: request.auth.uid, processedAt: FieldValue.serverTimestamp() });
  }

  await createAuditLog(request.auth.uid, action, "pool_topup", requestId);
  return { success: true };
});

/** REQ-VND-004: Redeem loyalty points at vendor */
export const redeemLoyaltyPoints = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");

  const { qrValue, programId, vendorId: targetVendorId } = request.data as {
    qrValue?: string;
    programId: string;
    vendorId?: string;
  };

  const vendorId = targetVendorId ?? request.auth.uid;
  const isVendorCaller = await isApprovedVendor(request.auth.uid);
  if (!isVendorCaller && request.auth.uid !== vendorId) {
    throw new HttpsError("permission-denied", "Vendor only");
  }

  let userId: string;
  if (qrValue) {
    const parsed = await parseAndValidateQrStrict(qrValue);
    if (!parsed) throw new HttpsError("invalid-argument", "Invalid QR code");
    userId = parsed.userId;
  } else {
    userId = request.auth.uid;
  }

  // REQ-WAL-008: KYC required before any financial operation
  try {
    await requireKycApproved(userId);
  } catch {
    throw new HttpsError("permission-denied", "User KYC verification required", { code: "KYC_REQUIRED" });
  }

  const programSnap = await db.doc(`loyaltyPrograms/${programId}`).get();
  if (!programSnap.exists || programSnap.data()?.vendorId !== vendorId) {
    throw new HttpsError("not-found", "Program not found");
  }
  const program = programSnap.data()!;
  const pointsRequired = program.redeemRule?.pointsRequired ?? 0;
  if (pointsRequired <= 0) throw new HttpsError("invalid-argument", "Invalid redeem rule");

  try {
    await db.runTransaction(async (tx) => {
      const uwRef = db.doc(`wallets/${userId}`);
      const uwSnap = await tx.get(uwRef);
      const loyalty = uwSnap.data()?.loyaltyPoints ?? 0;
      if (loyalty < pointsRequired) throw new Error("INSUFFICIENT_POINTS");

      tx.update(uwRef, {
        loyaltyPoints: loyalty - pointsRequired,
        updatedAt: FieldValue.serverTimestamp(),
      });

      recordTransaction(tx, {
        userId,
        vendorId,
        fromWalletId: `wallets/${userId}`,
        toWalletId: `vendorWallets/${vendorId}`,
        amount: pointsRequired,
        currency: "POINTS",
        type: "loyalty_redeem",
        description: program.redeemRule?.rewardDescription ?? "Loyalty redemption",
        metadata: { programId, companyId: vendorId },
      });
    });
  } catch (err) {
    mapErr(err);
  }

  await createNotification(userId, "Points Redeemed", `You redeemed ${pointsRequired} loyalty points.`, "loyalty_redeem");
  return { success: true, pointsRedeemed: pointsRequired };
});

/** REQ-VND-010: Event check-in via user QR */
export const checkInEvent = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isAdmin(request.auth.uid)) && !(await isApprovedVendor(request.auth.uid))) {
    const eventId = (request.data as { eventId: string }).eventId;
    const eventSnap = await db.doc(`events/${eventId}`).get();
    if (!eventSnap.exists || eventSnap.data()?.createdBy !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Not authorized to check in");
    }
  }

  const { eventId, qrValue } = request.data as { eventId: string; qrValue: string };
  const parsed = await parseAndValidateQrStrict(qrValue);
  if (!parsed) throw new HttpsError("invalid-argument", "Invalid QR code");

  const ticketSnap = await db
    .collection("tickets")
    .where("eventId", "==", eventId)
    .where("userId", "==", parsed.userId)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (ticketSnap.empty) throw new HttpsError("not-found", "No active ticket for this user");

  const ticketRef = ticketSnap.docs[0].ref;
  await ticketRef.update({ checkedIn: true, checkedInAt: FieldValue.serverTimestamp() });

  await db.collection("eventCheckIns").add({
    eventId,
    userId: parsed.userId,
    ticketId: ticketSnap.docs[0].id,
    checkedInBy: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { success: true, userId: parsed.userId };
});

/** REQ-PRO-002: Promo redemption at vendor POS via user QR */
export const redeemPromoAtPos = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isApprovedVendor(request.auth.uid))) throw new HttpsError("permission-denied", "Vendor only");

  const vendorId = request.auth.uid;
  const { qrValue, promoCode, purchaseAmount } = request.data as {
    qrValue: string;
    promoCode: string;
    purchaseAmount: number;
  };

  const parsed = await parseAndValidateQrStrict(qrValue);
  if (!parsed) throw new HttpsError("invalid-argument", "Invalid QR code");

  let promoResult;
  try {
    promoResult = await validatePromoInternal(promoCode, parsed.userId, purchaseAmount, "vendors");
  } catch (err) {
    mapErr(err);
  }

  await db.collection("promoRedemptions").add({
    promoId: promoResult!.promoId,
    userId: parsed.userId,
    vendorId,
    discount: promoResult!.discount,
    purchaseAmount,
    context: "vendor_pos",
    createdAt: FieldValue.serverTimestamp(),
  });

  await db.doc(`promoCodes/${promoResult!.promoId}`).update({
    usedCount: FieldValue.increment(1),
  });

  return { success: true, discount: promoResult!.discount, userId: parsed.userId };
});

/** REQ-WAL-009: Admin sets corporate vendor flag */
export const setVendorCorporate = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isAdmin(request.auth.uid))) throw new HttpsError("permission-denied", "Admin only");

  const { vendorId, isCorporate } = request.data as { vendorId: string; isCorporate: boolean };
  await db.doc(`vendors/${vendorId}`).update({ isCorporate, updatedAt: FieldValue.serverTimestamp() });
  await createAuditLog(request.auth.uid, isCorporate ? "set_corporate" : "unset_corporate", "vendor", vendorId);
  return { success: true };
});

/** REQ-WAL-010: Corporate vendor tops up user work_balance */
export const corporateTopUpUser = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const vendorId = request.auth.uid;
  if (!(await isCorporateVendor(vendorId))) throw new HttpsError("permission-denied", "Corporate vendor only");

  const { userId, amount } = request.data as { userId: string; amount: number };
  if (!userId || !amount || amount < 1) throw new HttpsError("invalid-argument", "Invalid input");

  // REQ-WAL-008: KYC required for the receiving user
  try {
    await requireKycApproved(userId);
  } catch {
    throw new HttpsError("permission-denied", "Recipient user must complete KYC verification", { code: "KYC_REQUIRED" });
  }

  const bindingSnap = await db.doc(`corporateBindings/${userId}_${vendorId}`).get();
  if (!bindingSnap.exists || bindingSnap.data()?.status !== "active") {
    throw new HttpsError("failed-precondition", "User not bound to this corporate account");
  }

  const vwRef = db.doc(`vendorWallets/${vendorId}`);
  const uwRef = db.doc(`wallets/${userId}`);

  await db.runTransaction(async (tx) => {
    const [vwSnap, uwSnap] = await Promise.all([tx.get(vwRef), tx.get(uwRef)]);
    const cash = vwSnap.data()?.cashBalance ?? 0;
    if (cash < amount) throw new Error("INSUFFICIENT_BALANCE");
    const workBal = uwSnap.data()?.workBalance ?? 0;

    tx.update(vwRef, { cashBalance: cash - amount, updatedAt: FieldValue.serverTimestamp() });
    tx.set(uwRef, { workBalance: workBal + amount, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    recordTransaction(tx, {
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

  await createNotification(userId, "Work Balance Credited", `LKR ${amount} added to your work balance.`, "corporate_topup");
  return { success: true };
});

/** REQ-WAL-012: User requests corporate binding (OTP verified on client) */
export const confirmCorporateBinding = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");

  const userId = request.auth.uid;

  // REQ-WAL-008: KYC required before binding to corporate account
  try {
    await requireKycApproved(userId);
  } catch {
    throw new HttpsError("permission-denied", "KYC verification required before corporate binding", { code: "KYC_REQUIRED" });
  }

  const { vendorId, otpVerified } = request.data as { vendorId: string; otpVerified: boolean };
  if (!vendorId || !otpVerified) throw new HttpsError("invalid-argument", "OTP confirmation required");

  const vendorSnap = await db.doc(`vendors/${vendorId}`).get();
  if (!vendorSnap.exists || !vendorSnap.data()?.isCorporate) {
    throw new HttpsError("failed-precondition", "Not a corporate vendor");
  }

  await db.doc(`corporateBindings/${userId}_${vendorId}`).set({
    userId,
    vendorId,
    companyId: vendorId,
    status: "active",
    consentedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });

  await db.doc(`users/${userId}`).set({ corporateVendorId: vendorId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { success: true };
});

/** REQ-VND-007: Generate webhook API key */
export const generateWebhookApiKey = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const vendorId = request.auth.uid;
  const isAdminUser = await isAdmin(request.auth.uid);
  const targetId = (request.data as { vendorId?: string }).vendorId ?? vendorId;

  if (targetId !== request.auth.uid && !isAdminUser) throw new HttpsError("permission-denied", "Not authorized");
  if (!(await isApprovedVendor(targetId)) && !isAdminUser) throw new HttpsError("permission-denied", "Vendor not active");

  const apiKey = randomBytes(32).toString("hex");
  await db.doc(`vendors/${targetId}`).update({ webhookApiKey: apiKey, updatedAt: FieldValue.serverTimestamp() });
  if (isAdminUser && targetId !== vendorId) {
    await createAuditLog(vendorId, "generate_webhook_key", "vendor", targetId);
  }
  return { apiKey };
});

/** REQ-WAL-004: Lookup user for P2P */
export const lookupUserForTransfer = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const { lookup } = request.data as { lookup: string };
  const userId = await resolveUserByLookup(lookup);
  if (!userId) throw new HttpsError("not-found", "User not found");

  const user = (await db.doc(`users/${userId}`).get()).data()!;
  return { userId, displayName: user.displayName, email: user.email };
});

/** Admin: update user spending limits */
export const updateUserSpendingLimits = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isAdmin(request.auth.uid))) throw new HttpsError("permission-denied", "Admin only");

  const { userId, spendingLimitDaily, spendingLimitMonthly } = request.data as {
    userId: string;
    spendingLimitDaily: number;
    spendingLimitMonthly: number;
  };

  await db.doc(`wallets/${userId}`).set(
    { spendingLimitDaily, spendingLimitMonthly, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  await createAuditLog(request.auth.uid, "update_spending_limits", "user", userId);
  return { success: true };
});
