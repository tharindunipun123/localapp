import * as admin from "firebase-admin";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import {
  db,
  isAdmin,
  isApprovedVendor,
  requireKycApproved,
  createNotification,
  createAuditLog,
  getAppSettings,
  buildQrValue,
  parseAndValidateQrStrict,
  cashBalance,
  recordTransaction,
  calcEarnPoints,
  checkSpendingLimits,
  resolveUserByLookup,
  FieldValue,
  Timestamp,
} from "./helpers";
import { applyKycOutcome, createDiditHostedSession, mapDiditSessionStatus } from "./kycProvider";

const REGION = "us-central1";

function mapHttpsError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === "KYC_REQUIRED") throw new HttpsError("permission-denied", "KYC verification required", { code: "KYC_REQUIRED" });
  if (msg === "INSUFFICIENT_BALANCE") throw new HttpsError("failed-precondition", "Insufficient balance");
  if (msg === "INSUFFICIENT_POINTS_POOL") throw new HttpsError("failed-precondition", "Insufficient points pool");
  if (msg === "NOT_VENDOR") throw new HttpsError("permission-denied", "Vendor access required");
  if (msg === "INVALID_QR") throw new HttpsError("invalid-argument", "Invalid or expired QR code");
  if (msg === "PROMO_INVALID") throw new HttpsError("invalid-argument", "Invalid promo code");
  throw err instanceof HttpsError ? err : new HttpsError("internal", msg);
}

/** Sync email verification from Firebase Auth; phone comes from Notify.lk OTP flow */
export const syncVerificationStatus = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;
  const authUser = await admin.auth().getUser(uid);
  const userSnap = await db.doc(`users/${uid}`).get();
  const userData = userSnap.data() ?? {};

  await db.doc(`users/${uid}`).set(
    {
      emailVerified: authUser.emailVerified,
      phone: userData.phone ?? null,
      phoneVerified: userData.phoneVerified ?? false,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const vendorSnap = await db.doc(`vendors/${uid}`).get();
  if (vendorSnap.exists) {
    await db.doc(`vendors/${uid}`).update({
      emailVerified: authUser.emailVerified,
      phoneVerified: userData.phoneVerified ?? false,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return {
    emailVerified: authUser.emailVerified,
    phoneVerified: userData.phoneVerified ?? false,
    phone: userData.phone ?? null,
  };
});

/** Submit vendor application (same user can become vendor) */
export const submitVendorApplication = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;
  const authUser = await admin.auth().getUser(uid);

  if (!authUser.emailVerified) {
    throw new HttpsError("failed-precondition", "Verify your email before applying as a vendor");
  }

  const userSnap = await db.doc(`users/${uid}`).get();
  const userData = userSnap.data() ?? {};
  if (!userData.phoneVerified) {
    throw new HttpsError("failed-precondition", "Verify your phone number before applying as a vendor");
  }

  const data = request.data as Record<string, unknown>;
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
    if (!data[field]) throw new HttpsError("invalid-argument", `${field} is required`);
  }

  const vendorRef = db.doc(`vendors/${uid}`);
  const existing = await vendorRef.get();
  if (existing.exists && existing.data()?.status === "active") {
    throw new HttpsError("already-exists", "Vendor profile already active");
  }

  const vendorDoc = {
    ownerId: uid,
    businessName: data.businessName,
    category: data.category,
    address: data.address,
    coordinates: data.coordinates ?? null,
    phone: data.phone,
    email: data.email,
    website: data.website ?? "",
    logoUrl: data.logoUrl ?? "",
    coverImageUrl: data.coverImageUrl ?? "",
    operatingHours: data.operatingHours ?? {},
    description: data.description,
    businessRegistrationNumber: data.businessRegistrationNumber,
    registrationPdfPath: data.registrationPdfPath,
    status: "pending",
    isCorporate: false,
    emailVerified: authUser.emailVerified,
    phoneVerified: userData.phoneVerified ?? false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await vendorRef.set(vendorDoc, { merge: true });
  await db.doc(`users/${uid}`).set(
    {
      vendorStatus: "pending",
      vendorId: uid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await createNotification(uid, "Vendor Application Submitted", "Your vendor application is under review.", "vendor_pending");

  return { success: true, vendorId: uid };
});

/** Admin: approve/reject vendor */
export const moderateVendor = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isAdmin(request.auth.uid))) throw new HttpsError("permission-denied", "Admin only");

  const { vendorId, action } = request.data as { vendorId: string; action: string };
  if (!vendorId || !["approve", "reject", "suspend"].includes(action)) {
    throw new HttpsError("invalid-argument", "Invalid input");
  }

  const vendorRef = db.doc(`vendors/${vendorId}`);
  const snap = await vendorRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Vendor not found");

  const vendor = snap.data()!;

  if (action === "approve") {
    await vendorRef.update({ status: "active", updatedAt: FieldValue.serverTimestamp() });
    await db.doc(`users/${vendorId}`).update({
      vendorStatus: "approved",
      role: "vendor",
      updatedAt: FieldValue.serverTimestamp(),
    });
    const vwRef = db.doc(`vendorWallets/${vendorId}`);
    const vwSnap = await vwRef.get();
    if (!vwSnap.exists) {
      await vwRef.set({
        cashBalance: 0,
        pointsPool: 0,
        currency: "LKR",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await createNotification(vendorId, "Vendor Approved", `Welcome! ${vendor.businessName} is now active.`, "vendor_approved");
  } else if (action === "reject") {
    await vendorRef.update({ status: "rejected", updatedAt: FieldValue.serverTimestamp() });
    await db.doc(`users/${vendorId}`).update({ vendorStatus: "rejected", updatedAt: FieldValue.serverTimestamp() });
    await createNotification(vendorId, "Vendor Application Rejected", "Your vendor application was not approved.", "vendor_rejected");
  } else {
    await vendorRef.update({ status: "suspended", updatedAt: FieldValue.serverTimestamp() });
    await db.doc(`users/${vendorId}`).update({ vendorStatus: "suspended", updatedAt: FieldValue.serverTimestamp() });
  }

  await createAuditLog(request.auth.uid, action, "vendor", vendorId);
  return { success: true };
});

/** Create loyalty program */
export const createLoyaltyProgram = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isApprovedVendor(request.auth.uid))) throw new HttpsError("permission-denied", "Vendor only");

  const vendorId = request.auth.uid;
  const d = request.data as Record<string, unknown>;

  const program = {
    vendorId,
    programName: d.programName,
    earnRule: d.earnRule ?? { spendAmount: 1000, pointsAwarded: 10 },
    redeemRule: d.redeemRule ?? { pointsRequired: 1000, rewardDescription: "Reward" },
    isActive: d.isActive !== false,
    expiryPolicy: d.expiryPolicy ?? "never",
    expiryDays: d.expiryDays ?? 180,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const ref = await db.collection("loyaltyPrograms").add(program);
  return { programId: ref.id };
});

/** Update loyalty program */
export const updateLoyaltyProgram = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isApprovedVendor(request.auth.uid))) throw new HttpsError("permission-denied", "Vendor only");

  const { programId, updates } = request.data as { programId: string; updates: Record<string, unknown> };
  const ref = db.doc(`loyaltyPrograms/${programId}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.vendorId !== request.auth.uid) {
    throw new HttpsError("not-found", "Program not found");
  }

  await ref.update({ ...updates, updatedAt: FieldValue.serverTimestamp() });
  return { success: true };
});

/** Cashier: scan QR + enter purchase → pending grant */
export const initiateLoyaltyGrant = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isApprovedVendor(request.auth.uid))) throw new HttpsError("permission-denied", "Vendor only");

  const vendorId = request.auth.uid;
  const { qrValue, programId, purchaseAmount } = request.data as {
    qrValue: string;
    programId: string;
    purchaseAmount: number;
  };

  const parsed = await parseAndValidateQrStrict(qrValue);
  if (!parsed) throw new HttpsError("invalid-argument", "Invalid or expired QR code");

  const programSnap = await db.doc(`loyaltyPrograms/${programId}`).get();
  if (!programSnap.exists || programSnap.data()?.vendorId !== vendorId) {
    throw new HttpsError("not-found", "Program not found");
  }
  const program = programSnap.data()!;
  if (!program.isActive) throw new HttpsError("failed-precondition", "Program is paused");

  const points = calcEarnPoints(purchaseAmount, program.earnRule);
  if (points <= 0) throw new HttpsError("invalid-argument", "Purchase amount too low for points");

  const vwSnap = await db.doc(`vendorWallets/${vendorId}`).get();
  const pool = vwSnap.data()?.pointsPool ?? 0;
  if (pool < points) throw new HttpsError("failed-precondition", "Insufficient points pool — top up first");

  const grantRef = db.collection("loyaltyGrants").doc();
  await grantRef.set({
    vendorId,
    programId,
    userId: parsed.userId,
    purchaseAmount,
    pointsCalculated: points,
    status: "pending",
    grantedBy: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { grantId: grantRef.id, userId: parsed.userId, pointsCalculated: points };
});

/** Vendor confirms pending loyalty grant — atomic debit pool + credit user */
export const confirmLoyaltyGrant = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isApprovedVendor(request.auth.uid))) throw new HttpsError("permission-denied", "Vendor only");

  const vendorId = request.auth.uid;
  const { grantId } = request.data as { grantId: string };

  try {
    await db.runTransaction(async (tx) => {
      const grantRef = db.doc(`loyaltyGrants/${grantId}`);
      const grantSnap = await tx.get(grantRef);
      if (!grantSnap.exists) throw new Error("GRANT_NOT_FOUND");
      const grant = grantSnap.data()!;
      if (grant.vendorId !== vendorId) throw new Error("NOT_OWNER");
      if (grant.status !== "pending") throw new Error("ALREADY_PROCESSED");

      const points = grant.pointsCalculated as number;
      const userId = grant.userId as string;

      const vwRef = db.doc(`vendorWallets/${vendorId}`);
      const uwRef = db.doc(`wallets/${userId}`);
      const [vwSnap, uwSnap] = await Promise.all([tx.get(vwRef), tx.get(uwRef)]);

      const pool = vwSnap.data()?.pointsPool ?? 0;
      if (pool < points) throw new Error("INSUFFICIENT_POINTS_POOL");

      const loyaltyPoints = uwSnap.data()?.loyaltyPoints ?? 0;

      tx.update(vwRef, { pointsPool: pool - points, updatedAt: FieldValue.serverTimestamp() });
      tx.set(
        uwRef,
        {
          loyaltyPoints: loyaltyPoints + points,
          cashBalance: cashBalance(uwSnap.data()),
          balance: cashBalance(uwSnap.data()),
          currency: "LKR",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.update(grantRef, {
        status: "confirmed",
        confirmedAt: FieldValue.serverTimestamp(),
      });

      recordTransaction(tx, {
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
  } catch (err) {
    mapHttpsError(err);
  }

  const grant = (await db.doc(`loyaltyGrants/${grantId}`).get()).data()!;
  await createNotification(
    grant.userId as string,
    "Loyalty Points Earned",
    `You received ${grant.pointsCalculated} loyalty points!`,
    "loyalty_earn"
  );

  return { success: true };
});

/** Vendor requests points pool top-up — creates pending request for admin (REQ-VND-005) */
export const topUpPointsPool = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isApprovedVendor(request.auth.uid))) throw new HttpsError("permission-denied", "Vendor only");

  const vendorId = request.auth.uid;
  const { pointsAmount, lkrAmount } = request.data as { pointsAmount: number; lkrAmount: number };

  if (!pointsAmount || pointsAmount < 1 || !lkrAmount || lkrAmount < 1) {
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

  return { requestId: ref.id, status: "pending", message: "Awaiting admin approval" };
});

/** Admin confirms vendor points pool top-up from external payment */
export const adminTopUpVendorWallet = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isAdmin(request.auth.uid))) throw new HttpsError("permission-denied", "Admin only");

  const { vendorId, cashAmount, pointsAmount } = request.data as {
    vendorId: string;
    cashAmount?: number;
    pointsAmount?: number;
  };

  const vwRef = db.doc(`vendorWallets/${vendorId}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(vwRef);
    const data = snap.data() ?? { cashBalance: 0, pointsPool: 0 };
    tx.set(
      vwRef,
      {
        cashBalance: (data.cashBalance ?? 0) + (cashAmount ?? 0),
        pointsPool: (data.pointsPool ?? 0) + (pointsAmount ?? 0),
        currency: "LKR",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  await createAuditLog(request.auth.uid, "topup_vendor_wallet", "vendor", vendorId, JSON.stringify({ cashAmount, pointsAmount }));
  return { success: true };
});

/** Generate or refresh user QR code */
export const generateUserQr = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;
  const qrValue = buildQrValue(uid);
  const settings = await getAppSettings();
  const expiresAt = Timestamp.fromMillis(Date.now() + settings.qrRotationHours * 60 * 60 * 1000);

  await db.doc(`userQrTokens/${uid}`).set({
    qrValue,
    expiresAt,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { qrValue, expiresAt: expiresAt.toMillis() };
});

/** Validate QR server-side (for vendor apps) */
export const validateUserQr = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const { qrValue } = request.data as { qrValue: string };
  const parsed = await parseAndValidateQrStrict(qrValue);
  if (!parsed) throw new HttpsError("invalid-argument", "Invalid or expired QR code");

  const userSnap = await db.doc(`users/${parsed.userId}`).get();
  if (!userSnap.exists) throw new HttpsError("not-found", "User not found");

  const user = userSnap.data()!;
  return {
    userId: parsed.userId,
    displayName: user.displayName,
    kycStatus: user.kycStatus ?? "none",
  };
});

/** Create a Didit hosted KYC session (OCR + liveness + face match) */
export const createKycSession = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;

  const userSnap = await db.doc(`users/${uid}`).get();
  if (userSnap.data()?.kycStatus === "approved") {
    throw new HttpsError("failed-precondition", "KYC already approved");
  }

  return createDiditHostedSession(uid);
});

/** Didit webhook — receives real-time KYC status updates */
export const diditWebhook = onRequest({ region: REGION }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Optionally verify HMAC-SHA256 signature when webhook secret is configured
  const settings = await getAppSettings();
  if (settings.diditWebhookSecret) {
    const { createHmac } = await import("crypto");
    const sigHeader = req.headers["x-signature-v2"] as string | undefined;
    const tsHeader = req.headers["x-timestamp"] as string | undefined;
    if (sigHeader && tsHeader) {
      const age = Math.abs(Date.now() / 1000 - parseInt(tsHeader, 10));
      if (age > 300) {
        res.status(401).json({ error: "Stale webhook" });
        return;
      }
      const canonical = JSON.stringify(
        req.body,
        Object.keys(req.body as object).sort()
      );
      const expected = createHmac("sha256", settings.diditWebhookSecret)
        .update(canonical)
        .digest("hex");
      if (expected !== sigHeader) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
    }
  }

  const payload = req.body as {
    session_id?: string;
    status?: string;
    vendor_data?: string;
    webhook_type?: string;
    decision?: Record<string, unknown>;
  };

  const userId = payload.vendor_data;
  const diditStatus = payload.status;

  if (!userId || !diditStatus) {
    res.status(400).json({ error: "Missing vendor_data or status" });
    return;
  }

  const kycStatus = mapDiditSessionStatus(diditStatus);

  try {
    await applyKycOutcome(userId, kycStatus, {
      diditStatus,
      sessionId: payload.session_id ?? "",
      decision: payload.decision ?? {},
      provider: "didit",
      mode: "hosted",
    });

    res.json({ received: true });
  } catch (err) {
    console.error("diditWebhook error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/** Admin review KYC */
export const reviewKyc = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isAdmin(request.auth.uid))) throw new HttpsError("permission-denied", "Admin only");

  const { userId, action, notes } = request.data as { userId: string; action: string; notes?: string };
  if (!userId || !["approve", "reject"].includes(action)) {
    throw new HttpsError("invalid-argument", "Invalid input");
  }

  const status = action === "approve" ? "approved" : "rejected";
  await db.doc(`kycSubmissions/${userId}`).update({
    status,
    reviewNotes: notes ?? "",
    reviewedBy: request.auth.uid,
    reviewedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.doc(`users/${userId}`).update({ kycStatus: status, updatedAt: FieldValue.serverTimestamp() });

  const settings = await getAppSettings();
  if (action === "approve") {
    await db.doc(`wallets/${userId}`).set(
      {
        spendingLimitDaily: settings.defaultSpendingLimitDaily,
        spendingLimitMonthly: settings.defaultSpendingLimitMonthly,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  await createNotification(
    userId,
    action === "approve" ? "KYC Approved" : "KYC Rejected",
    action === "approve" ? "Your identity verification is complete." : "Your KYC submission was rejected.",
    `kyc_${status}`
  );

  await createAuditLog(request.auth.uid, action, "kyc", userId, notes);
  return { success: true };
});

/** Create promo code (admin or vendor) */
export const createPromoCode = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");

  const uid = request.auth.uid;
  const isAdminUser = await isAdmin(uid);
  const isVendor = await isApprovedVendor(uid);
  if (!isAdminUser && !isVendor) throw new HttpsError("permission-denied", "Not authorized");

  const d = request.data as Record<string, unknown>;
  const code = String(d.code ?? "").toUpperCase().trim();
  if (!code) throw new HttpsError("invalid-argument", "Code required");

  const existing = await db.collection("promoCodes").where("code", "==", code).limit(1).get();
  if (!existing.empty) throw new HttpsError("already-exists", "Code already exists");

  const promo = {
    code,
    discountType: d.discountType ?? "percentage",
    discountValue: d.discountValue ?? 10,
    minPurchase: d.minPurchase ?? 0,
    maxUses: d.maxUses ?? 100,
    usedCount: 0,
    validFrom: d.validFrom ? Timestamp.fromMillis(d.validFrom as number) : Timestamp.now(),
    validUntil: d.validUntil ? Timestamp.fromMillis(d.validUntil as number) : Timestamp.fromMillis(Date.now() + 30 * 86400000),
    applicableTo: d.applicableTo ?? "all",
    vendorId: isVendor ? uid : d.vendorId ?? null,
    createdBy: uid,
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await db.collection("promoCodes").add(promo);
  return { promoId: ref.id };
});

/** Validate promo code */
export const validatePromoCode = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const { code, purchaseAmount, context } = request.data as {
    code: string;
    purchaseAmount: number;
    context?: string;
  };

  const normalized = code.toUpperCase().trim();
  const snap = await db.collection("promoCodes").where("code", "==", normalized).limit(1).get();
  if (snap.empty) throw new HttpsError("not-found", "Invalid promo code");

  const promo = snap.docs[0].data();
  const promoId = snap.docs[0].id;
  const now = Date.now();

  if (!promo.isActive) throw new HttpsError("failed-precondition", "Promo code inactive");
  if (promo.validFrom.toMillis() > now) throw new HttpsError("failed-precondition", "Promo not yet valid");
  if (promo.validUntil.toMillis() < now) throw new HttpsError("failed-precondition", "Promo expired");
  if (promo.usedCount >= promo.maxUses) throw new HttpsError("resource-exhausted", "Promo fully redeemed");
  if (purchaseAmount < (promo.minPurchase ?? 0)) {
    throw new HttpsError("failed-precondition", `Minimum purchase LKR ${promo.minPurchase}`);
  }
  if (context && promo.applicableTo !== "all" && promo.applicableTo !== context) {
    throw new HttpsError("failed-precondition", "Promo not applicable");
  }

  const userRedemption = await db
    .collection("promoRedemptions")
    .where("promoId", "==", promoId)
    .where("userId", "==", request.auth.uid)
    .limit(1)
    .get();
  if (!userRedemption.empty) throw new HttpsError("already-exists", "You already used this code");

  let discount = 0;
  if (promo.discountType === "percentage") {
    discount = Math.round(purchaseAmount * (promo.discountValue / 100));
  } else {
    discount = Math.min(promo.discountValue, purchaseAmount);
  }

  return { promoId, code: normalized, discount, finalAmount: purchaseAmount - discount };
});

/** P2P transfer between users */
export const transferP2P = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");

  const fromId = request.auth.uid;
  const { toUserId, toLookup, amount, description } = request.data as {
    toUserId?: string;
    toLookup?: string;
    amount: number;
    description?: string;
  };

  let recipientId = toUserId;
  if (!recipientId && toLookup) {
    recipientId = (await resolveUserByLookup(toLookup)) ?? undefined;
    if (!recipientId) throw new HttpsError("not-found", "Recipient not found");
  }

  if (!recipientId || !amount || amount < 1) throw new HttpsError("invalid-argument", "Invalid input");
  if (recipientId === fromId) throw new HttpsError("invalid-argument", "Cannot transfer to yourself");

  try {
    await requireKycApproved(fromId);
    await checkSpendingLimits(fromId, amount);
    await db.runTransaction(async (tx) => {
      const fromRef = db.doc(`wallets/${fromId}`);
      const toRef = db.doc(`wallets/${recipientId}`);
      const [fromSnap, toSnap] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);

      const fromBal = cashBalance(fromSnap.data());
      if (fromBal < amount) throw new Error("INSUFFICIENT_BALANCE");

      const toBal = cashBalance(toSnap.data());

      tx.set(fromRef, { cashBalance: fromBal - amount, balance: fromBal - amount, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(toRef, { cashBalance: toBal + amount, balance: toBal + amount, currency: "LKR", updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      recordTransaction(tx, {
        userId: fromId,
        fromWalletId: `wallets/${fromId}`,
        toWalletId: `wallets/${recipientId}`,
        amount,
        currency: "LKR",
        type: "p2p_transfer",
        description: description ?? "P2P transfer",
        metadata: { toUserId: recipientId },
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "DAILY_LIMIT_EXCEEDED") throw new HttpsError("resource-exhausted", "Daily spending limit exceeded");
    if (msg === "MONTHLY_LIMIT_EXCEEDED") throw new HttpsError("resource-exhausted", "Monthly spending limit exceeded");
    mapHttpsError(err);
  }

  await createNotification(recipientId, "Money Received", `You received LKR ${amount}`, "p2p_received");
  return { success: true, toUserId: recipientId };
});

/** Vendor withdrawal request */
export const requestVendorWithdrawal = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isApprovedVendor(request.auth.uid))) throw new HttpsError("permission-denied", "Vendor only");

  const vendorId = request.auth.uid;
  const { amount, bankDetails } = request.data as { amount: number; bankDetails: string };

  if (!amount || amount < 100) throw new HttpsError("invalid-argument", "Minimum withdrawal LKR 100");

  const vwRef = db.doc(`vendorWallets/${vendorId}`);

  let requestId: string;

  // REQ-WAL balance reservation: atomically deduct from cashBalance and hold in pendingWithdrawal
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(vwRef);
    const cash = snap.data()?.cashBalance ?? 0;
    const pending = snap.data()?.pendingWithdrawal ?? 0;
    if (cash < amount) throw new HttpsError("failed-precondition", "Insufficient balance");

    const reqRef = db.collection("withdrawalRequests").doc();
    requestId = reqRef.id;

    // Reserve the funds
    tx.set(vwRef, {
      cashBalance: cash - amount,
      pendingWithdrawal: pending + amount,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    tx.set(reqRef, {
      vendorId,
      amount,
      bankDetails,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

    const txRef = db.collection("transactions").doc();
    tx.set(txRef, {
      vendorId,
      amount,
      currency: "LKR",
      type: "withdrawal_request",
      status: "pending",
      description: "Vendor withdrawal request (funds reserved)",
      metadata: { requestId: reqRef.id, bankDetails },
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { requestId: requestId! };
});

/** Admin process vendor withdrawal */
export const processVendorWithdrawal = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isAdmin(request.auth.uid))) throw new HttpsError("permission-denied", "Admin only");

  const { requestId, action } = request.data as { requestId: string; action: string };
  const reqRef = db.doc(`withdrawalRequests/${requestId}`);
  const snap = await reqRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Request not found");

  const req = snap.data()!;
  if (req.status !== "pending") throw new HttpsError("failed-precondition", "Already processed");

  if (action === "approve") {
    // Funds are already reserved — just clear the pendingWithdrawal hold and mark processed
    await db.runTransaction(async (tx) => {
      const vwRef = db.doc(`vendorWallets/${req.vendorId}`);
      const vwSnap = await tx.get(vwRef);
      const pending = vwSnap.data()?.pendingWithdrawal ?? 0;
      tx.set(vwRef, {
        pendingWithdrawal: Math.max(0, pending - req.amount),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.update(reqRef, { status: "processed", processedBy: request.auth!.uid, processedAt: FieldValue.serverTimestamp() });
    });
    await createNotification(req.vendorId as string, "Withdrawal Processed", `LKR ${req.amount} withdrawal approved.`, "withdrawal_processed");
  } else {
    // Return reserved funds to cashBalance
    await db.runTransaction(async (tx) => {
      const vwRef = db.doc(`vendorWallets/${req.vendorId}`);
      const vwSnap = await tx.get(vwRef);
      const cash = vwSnap.data()?.cashBalance ?? 0;
      const pending = vwSnap.data()?.pendingWithdrawal ?? 0;
      tx.set(vwRef, {
        cashBalance: cash + req.amount,
        pendingWithdrawal: Math.max(0, pending - req.amount),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.update(reqRef, { status: "rejected", processedBy: request.auth!.uid, processedAt: FieldValue.serverTimestamp() });
    });
    await createNotification(req.vendorId as string, "Withdrawal Rejected", `Your LKR ${req.amount} withdrawal was rejected — funds returned to your balance.`, "withdrawal_rejected");
  }

  await createAuditLog(request.auth.uid, action, "withdrawal", requestId);
  return { success: true };
});

/** External webhook for loyalty point grants (Nexus-style) */
export const webhookLoyaltyGrant = onRequest({ region: REGION }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const apiKey = req.headers["x-vendor-api-key"] as string;
  const { vendorId, userId, points, programId, externalRef } = req.body as {
    vendorId?: string;
    userId?: string;
    points?: number;
    programId?: string;
    externalRef?: string;
  };

  if (!apiKey || !vendorId || !userId || !points) {
    res.status(400).json({ error: "Missing fields" });
    return;
  }

  const vendorSnap = await db.doc(`vendors/${vendorId}`).get();
  if (!vendorSnap.exists || vendorSnap.data()?.webhookApiKey !== apiKey) {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

  try {
    await db.runTransaction(async (tx) => {
      const vwRef = db.doc(`vendorWallets/${vendorId}`);
      const uwRef = db.doc(`wallets/${userId}`);
      const [vwSnap, uwSnap] = await Promise.all([tx.get(vwRef), tx.get(uwRef)]);

      const pool = vwSnap.data()?.pointsPool ?? 0;
      if (pool < points) throw new Error("INSUFFICIENT_POINTS_POOL");

      tx.update(vwRef, { pointsPool: pool - points, updatedAt: FieldValue.serverTimestamp() });
      tx.set(
        uwRef,
        {
          loyaltyPoints: (uwSnap.data()?.loyaltyPoints ?? 0) + points,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      recordTransaction(tx, {
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
  } catch {
    res.status(400).json({ error: "Grant failed" });
  }
});
