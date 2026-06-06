import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { randomUUID } from "crypto";
import {
  db,
  isAdmin,
  createNotification,
  createAuditLog,
  requireKycApproved,
  getAppSettings,
  cashBalance,
  checkSpendingLimits,
  validatePromoInternal,
  FieldValue,
  Timestamp,
} from "./helpers";
import { DEFAULT_NOTIFYLK } from "./notifyLkConfig";

export * from "./platform";
export * from "./extended";
export * from "./phoneOtp";
export * from "./adminApi";
export * from "./features";
export * from "./matrimonial";
export * from "./chat";

const REGION = "us-central1";

/** Expire old events — runs every hour */
export const expireOldEvents = onSchedule(
  { schedule: "every 1 hours", region: REGION },
  async () => {
    const now = Timestamp.now();
    const twentyFourHoursAgo = Timestamp.fromMillis(now.toMillis() - 24 * 60 * 60 * 1000);

    const expiredSnap = await db
      .collection("events")
      .where("status", "==", "approved")
      .where("endDatetime", "<", now)
      .limit(400)
      .get();

    const batch = db.batch();
    let count = 0;

    for (const docSnap of expiredSnap.docs) {
      const event = docSnap.data();
      const endMs = event.endDatetime.toMillis();
      const shouldExpire =
        (event.eventType === "free" && endMs < twentyFourHoursAgo.toMillis()) ||
        (event.eventType !== "free" && endMs < now.toMillis());

      if (shouldExpire) {
        batch.update(docSnap.ref, {
          status: "expired",
          updatedAt: FieldValue.serverTimestamp(),
        });
        count++;
      }
    }

    if (count > 0) await batch.commit();
    console.log(`Expired ${count} events`);
  }
);

/** Admin: approve/reject/feature/cancel events */
export const moderateEvent = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isAdmin(request.auth.uid))) {
    throw new HttpsError("permission-denied", "Admin only");
  }

  const { eventId, action, rejectionReason } = request.data as {
    eventId: string;
    action: string;
    rejectionReason?: string;
  };

  if (!eventId || !action) {
    throw new HttpsError("invalid-argument", "eventId and action required");
  }

  const ref = db.doc(`events/${eventId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Event not found");

  const event = snap.data()!;
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

  switch (action) {
    case "approve":
      updates.status = "approved";
      await createNotification(
        event.createdBy,
        "Event Approved",
        `Your event "${event.title}" has been approved.`,
        "event_approved",
        { eventId }
      );
      break;
    case "reject":
      updates.status = "rejected";
      updates.rejectionReason = rejectionReason ?? "Does not meet guidelines";
      await createNotification(
        event.createdBy,
        "Event Rejected",
        `Your event "${event.title}" was rejected.`,
        "event_rejected",
        { eventId }
      );
      break;
    case "feature":
      updates.isFeatured = true;
      break;
    case "unfeature":
      updates.isFeatured = false;
      break;
    case "cancel":
      updates.status = "cancelled";
      break;
    case "expire":
      updates.status = "expired";
      break;
    default:
      throw new HttpsError("invalid-argument", "Invalid action");
  }

  await ref.update(updates);
  await createAuditLog(request.auth.uid, action, "event", eventId, rejectionReason);

  return { success: true };
});

/** Link event to attraction */
export const linkEventToAttraction = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isAdmin(request.auth.uid))) {
    throw new HttpsError("permission-denied", "Admin only");
  }

  const { eventId, attractionId } = request.data as { eventId: string; attractionId: string };
  if (!eventId || !attractionId) {
    throw new HttpsError("invalid-argument", "eventId and attractionId required");
  }

  await db.doc(`events/${eventId}`).update({
    attractionRef: attractionId,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await createAuditLog(request.auth.uid, "link_event", "event", eventId, attractionId);
  return { success: true };
});

/** Purchase ticket with wallet — transaction-safe */
export const purchaseTicket = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");

  const userId = request.auth.uid;
  const { eventId, quantity = 1, promoCode } = request.data as {
    eventId: string;
    quantity: number;
    promoCode?: string;
  };

  if (!eventId || quantity < 1) {
    throw new HttpsError("invalid-argument", "Invalid input");
  }

  try {
    await requireKycApproved(userId);
  } catch {
    throw new HttpsError("permission-denied", "KYC verification required", { code: "KYC_REQUIRED" });
  }

  const eventRef = db.doc(`events/${eventId}`);
  const walletRef = db.doc(`wallets/${userId}`);

  const eventPreview = await eventRef.get();
  if (!eventPreview.exists) throw new HttpsError("not-found", "Event not found");

  const preview = eventPreview.data()!;
  if (preview.status !== "approved") {
    throw new HttpsError("failed-precondition", "Event not available");
  }
  if (preview.eventType !== "paid_inapp") {
    throw new HttpsError("failed-precondition", "Not a paid in-app event");
  }

  let ticketPrice = preview.ticketPrice ?? 0;
  let discount = 0;
  let promoId: string | null = null;

  if (promoCode) {
    try {
      const promoResult = await validatePromoInternal(
        promoCode,
        userId,
        ticketPrice * quantity,
        "events"
      );
      promoId = promoResult.promoId;
      discount = promoResult.discount;
    } catch {
      throw new HttpsError("invalid-argument", "Invalid or expired promo code");
    }
  }

  const totalPrice = Math.max(0, ticketPrice * quantity - discount);

  try {
    await checkSpendingLimits(userId, totalPrice);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "DAILY_LIMIT_EXCEEDED") throw new HttpsError("resource-exhausted", "Daily spending limit exceeded");
    if (msg === "MONTHLY_LIMIT_EXCEEDED") throw new HttpsError("resource-exhausted", "Monthly spending limit exceeded");
    throw err;
  }

  const result = await db
    .runTransaction(async (tx) => {
      const eventSnap = await tx.get(eventRef);
      const walletSnap = await tx.get(walletRef);

      if (!eventSnap.exists) throw new Error("EVENT_NOT_FOUND");

      const event = eventSnap.data()!;
      if (event.status !== "approved") throw new Error("EVENT_UNAVAILABLE");
      if (event.eventType !== "paid_inapp") throw new Error("NOT_PAID_INAPP");

      if (event.maxAttendees) {
        const attendeeCount = event.attendeeCount ?? 0;
        if (attendeeCount + quantity > event.maxAttendees) {
          throw new Error("SOLD_OUT");
        }
      }

      const balance = cashBalance(walletSnap.data());
      if (balance < totalPrice) throw new Error("INSUFFICIENT_BALANCE");

      tx.set(
        walletRef,
        {
          cashBalance: balance - totalPrice,
          balance: balance - totalPrice,
          currency: "LKR",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const transactionRef = db.collection("transactions").doc();
      tx.set(transactionRef, {
        userId,
        fromWalletId: `wallets/${userId}`,
        toWalletId: `platform/events`,
        type: "ticket_purchase",
        amount: totalPrice,
        currency: "LKR",
        eventId,
        promoId,
        discount,
        status: "completed",
        description: `Ticket purchase for event ${eventId}`,
        createdAt: FieldValue.serverTimestamp(),
      });

      const qrCodeValue = `TICKET-${eventId}-${userId}-${randomUUID()}`;
      const ticketRef = db.collection("tickets").doc();
      tx.set(ticketRef, {
        eventId,
        userId,
        quantity,
        totalPrice,
        discount,
        promoId,
        qrCodeValue,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.update(eventRef, {
        attendeeCount: FieldValue.increment(quantity),
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (promoId) {
        tx.update(db.doc(`promoCodes/${promoId}`), {
          usedCount: FieldValue.increment(1),
        });
        const redemptionRef = db.collection("promoRedemptions").doc();
        tx.set(redemptionRef, {
          promoId,
          userId,
          eventId,
          discount,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      return { ticketId: ticketRef.id, qrCodeValue };
    })
    .catch((err: Error) => {
      const code = err.message;
      if (code === "EVENT_NOT_FOUND") throw new HttpsError("not-found", "Event not found");
      if (code === "EVENT_UNAVAILABLE") throw new HttpsError("failed-precondition", "Event not available");
      if (code === "NOT_PAID_INAPP") throw new HttpsError("failed-precondition", "Not a paid in-app event");
      if (code === "SOLD_OUT") throw new HttpsError("resource-exhausted", "Not enough tickets available");
      if (code === "INSUFFICIENT_BALANCE") throw new HttpsError("failed-precondition", "Insufficient wallet balance");
      throw err;
    });

  await createNotification(userId, "Ticket Purchased", "Your ticket has been confirmed.", "ticket_purchase", {
    eventId,
    ticketId: result.ticketId,
  });

  return result;
});

/** Top up wallet with deposit fee — requires KYC */
export const topUpWallet = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");

  const userId = request.auth.uid;
  const { amount } = request.data as { amount: number };

  if (!amount || amount < 100) {
    throw new HttpsError("invalid-argument", "Minimum top-up is LKR 100");
  }

  try {
    await requireKycApproved(userId);
  } catch {
    throw new HttpsError("permission-denied", "KYC verification required", { code: "KYC_REQUIRED" });
  }

  const settings = await getAppSettings();
  const fee = Math.round(amount * (settings.depositFeePercent / 100) + settings.depositFeeFixed);
  const credited = amount - fee;

  try {
    await checkSpendingLimits(userId, 0);
  } catch {
    // deposits don't count against spend limits; KYC already checked
  }

  const walletRef = db.doc(`wallets/${userId}`);

  await db.runTransaction(async (tx) => {
    const walletSnap = await tx.get(walletRef);
    const balance = cashBalance(walletSnap.data());

    tx.set(
      walletRef,
      {
        cashBalance: balance + credited,
        balance: balance + credited,
        currency: "LKR",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const transactionRef = db.collection("transactions").doc();
    tx.set(transactionRef, {
      userId,
      fromWalletId: "gateway",
      toWalletId: `wallets/${userId}`,
      type: "deposit",
      amount: credited,
      currency: "LKR",
      status: "completed",
      description: `Deposit LKR ${amount} (fee LKR ${fee})`,
      metadata: { grossAmount: amount, fee },
      createdAt: FieldValue.serverTimestamp(),
    });

    if (fee > 0) {
      const feeRef = db.collection("transactions").doc();
      tx.set(feeRef, {
        userId,
        type: "fee",
        amount: fee,
        currency: "LKR",
        status: "completed",
        description: "Deposit gateway fee",
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });

  return { success: true, credited, fee };
});

/** Update attraction rating when review changes */
export const updateAttractionRating = onDocumentWritten(
  { document: "reviews/{reviewId}", region: REGION },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const review = after ?? before;
    if (!review?.attractionId) return;

    const attractionId = review.attractionId as string;
    const reviewsSnap = await db
      .collection("reviews")
      .where("attractionId", "==", attractionId)
      .where("status", "==", "published")
      .get();

    let total = 0;
    reviewsSnap.forEach((doc) => {
      total += doc.data().rating ?? 0;
    });

    const count = reviewsSnap.size;
    const average = count > 0 ? total / count : 0;

    await db.doc(`places/${attractionId}`).update({
      averageRating: Math.round(average * 10) / 10,
      reviewCount: count,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
);

/** Initialize wallet when a user profile is created or updated without one yet */
export const initUserWallet = onDocumentWritten(
  { document: "users/{userId}", region: REGION },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;

    const userId = event.params.userId;
    const walletRef = db.doc(`wallets/${userId}`);
    const walletSnap = await walletRef.get();
    if (walletSnap.exists) return;

    const settings = await getAppSettings();
    await walletRef.set({
      cashBalance: 0,
      balance: 0,
      loyaltyPoints: 0,
      bonusPoints: 0,
      workBalance: 0,
      currency: "LKR",
      spendingLimitDaily: settings.defaultSpendingLimitDaily,
      spendingLimitMonthly: settings.defaultSpendingLimitMonthly,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
);

/** Initialize app settings document */
export const ensureAppSettings = onCall({ region: REGION }, async () => {
  const ref = db.doc("settings/app");
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      featuredEventLimit: 6,
      nearbyRadiusKm: 10,
      depositFeePercent: 2.5,
      depositFeeFixed: 0,
      defaultSpendingLimitDaily: 50000,
      defaultSpendingLimitMonthly: 200000,
      qrRotationHours: 24,
      geminiApiKey: "",
      notifyLkUserId: DEFAULT_NOTIFYLK.userId,
      notifyLkApiKey: DEFAULT_NOTIFYLK.apiKey,
      notifyLkSenderId: DEFAULT_NOTIFYLK.senderId,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  return { success: true };
});
