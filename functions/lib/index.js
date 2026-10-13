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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAppSettings = exports.initUserWallet = exports.updateAttractionRating = exports.completeWalletDeposit = exports.initiateWalletDeposit = exports.topUpWallet = exports.purchaseTicket = exports.linkEventToAttraction = exports.moderateEvent = exports.expireOldEvents = exports.refreshKycDecision = exports.submitKycDocuments = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const crypto_1 = require("crypto");
const helpers_1 = require("./helpers");
const notifyLkConfig_1 = require("./notifyLkConfig");
const chat_1 = require("./chat");
__exportStar(require("./platform"), exports);
var kycProvider_1 = require("./kycProvider");
Object.defineProperty(exports, "submitKycDocuments", { enumerable: true, get: function () { return kycProvider_1.submitKycDocuments; } });
Object.defineProperty(exports, "refreshKycDecision", { enumerable: true, get: function () { return kycProvider_1.refreshKycDecision; } });
__exportStar(require("./extended"), exports);
__exportStar(require("./phoneOtp"), exports);
__exportStar(require("./adminApi"), exports);
__exportStar(require("./features"), exports);
__exportStar(require("./matrimonial"), exports);
__exportStar(require("./chat"), exports);
__exportStar(require("./family"), exports);
const REGION = "us-central1";
/** Expire old events — runs every hour */
exports.expireOldEvents = (0, scheduler_1.onSchedule)({ schedule: "every 1 hours", region: REGION }, async () => {
    const now = helpers_1.Timestamp.now();
    const twentyFourHoursAgo = helpers_1.Timestamp.fromMillis(now.toMillis() - 24 * 60 * 60 * 1000);
    const expiredSnap = await helpers_1.db
        .collection("events")
        .where("status", "==", "approved")
        .where("endDatetime", "<", now)
        .limit(400)
        .get();
    const batch = helpers_1.db.batch();
    let count = 0;
    for (const docSnap of expiredSnap.docs) {
        const event = docSnap.data();
        const endMs = event.endDatetime.toMillis();
        const shouldExpire = (event.eventType === "free" && endMs < twentyFourHoursAgo.toMillis()) ||
            (event.eventType !== "free" && endMs < now.toMillis());
        if (shouldExpire) {
            batch.update(docSnap.ref, {
                status: "expired",
                updatedAt: helpers_1.FieldValue.serverTimestamp(),
            });
            count++;
        }
    }
    if (count > 0)
        await batch.commit();
    console.log(`Expired ${count} events`);
});
/** Admin: approve/reject/feature/cancel events */
exports.moderateEvent = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isAdmin)(request.auth.uid))) {
        throw new https_1.HttpsError("permission-denied", "Admin only");
    }
    const { eventId, action, rejectionReason } = request.data;
    if (!eventId || !action) {
        throw new https_1.HttpsError("invalid-argument", "eventId and action required");
    }
    const ref = helpers_1.db.doc(`events/${eventId}`);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError("not-found", "Event not found");
    const event = snap.data();
    const updates = { updatedAt: helpers_1.FieldValue.serverTimestamp() };
    switch (action) {
        case "approve":
            updates.status = "approved";
            if (event.chatEnabled !== false) {
                const group = await (0, chat_1.ensureEventChatGroup)(eventId, event, event.createdBy);
                updates.chatGroupId = group.groupId;
                updates.chatEnabled = true;
            }
            await (0, helpers_1.createNotification)(event.createdBy, "Event Approved", `Your event "${event.title}" has been approved.`, "event_approved", { eventId });
            break;
        case "reject":
            updates.status = "rejected";
            updates.rejectionReason = rejectionReason !== null && rejectionReason !== void 0 ? rejectionReason : "Does not meet guidelines";
            await (0, helpers_1.createNotification)(event.createdBy, "Event Rejected", `Your event "${event.title}" was rejected.`, "event_rejected", { eventId });
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
            throw new https_1.HttpsError("invalid-argument", "Invalid action");
    }
    await ref.update(updates);
    await (0, helpers_1.createAuditLog)(request.auth.uid, action, "event", eventId, rejectionReason);
    return { success: true };
});
/** Link event to attraction */
exports.linkEventToAttraction = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isAdmin)(request.auth.uid))) {
        throw new https_1.HttpsError("permission-denied", "Admin only");
    }
    const { eventId, attractionId } = request.data;
    if (!eventId || !attractionId) {
        throw new https_1.HttpsError("invalid-argument", "eventId and attractionId required");
    }
    await helpers_1.db.doc(`events/${eventId}`).update({
        attractionRef: attractionId,
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    });
    await (0, helpers_1.createAuditLog)(request.auth.uid, "link_event", "event", eventId, attractionId);
    return { success: true };
});
/** Purchase ticket with wallet — transaction-safe */
exports.purchaseTicket = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const userId = request.auth.uid;
    const { eventId, quantity = 1, promoCode } = request.data;
    if (!eventId || quantity < 1) {
        throw new https_1.HttpsError("invalid-argument", "Invalid input");
    }
    try {
        await (0, helpers_1.requireKycApproved)(userId);
    }
    catch (_b) {
        throw new https_1.HttpsError("permission-denied", "KYC verification required", { code: "KYC_REQUIRED" });
    }
    const eventRef = helpers_1.db.doc(`events/${eventId}`);
    const walletRef = helpers_1.db.doc(`wallets/${userId}`);
    const eventPreview = await eventRef.get();
    if (!eventPreview.exists)
        throw new https_1.HttpsError("not-found", "Event not found");
    const preview = eventPreview.data();
    if (preview.status !== "approved") {
        throw new https_1.HttpsError("failed-precondition", "Event not available");
    }
    if (preview.eventType !== "paid_inapp") {
        throw new https_1.HttpsError("failed-precondition", "Not a paid in-app event");
    }
    let ticketPrice = (_a = preview.ticketPrice) !== null && _a !== void 0 ? _a : 0;
    let discount = 0;
    let promoId = null;
    if (promoCode) {
        try {
            const promoResult = await (0, helpers_1.validatePromoInternal)(promoCode, userId, ticketPrice * quantity, "events");
            promoId = promoResult.promoId;
            discount = promoResult.discount;
        }
        catch (_c) {
            throw new https_1.HttpsError("invalid-argument", "Invalid or expired promo code");
        }
    }
    const totalPrice = Math.max(0, ticketPrice * quantity - discount);
    try {
        await (0, helpers_1.checkSpendingLimits)(userId, totalPrice);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "DAILY_LIMIT_EXCEEDED")
            throw new https_1.HttpsError("resource-exhausted", "Daily spending limit exceeded");
        if (msg === "MONTHLY_LIMIT_EXCEEDED")
            throw new https_1.HttpsError("resource-exhausted", "Monthly spending limit exceeded");
        throw err;
    }
    const result = await helpers_1.db
        .runTransaction(async (tx) => {
        var _a;
        const eventSnap = await tx.get(eventRef);
        const walletSnap = await tx.get(walletRef);
        if (!eventSnap.exists)
            throw new Error("EVENT_NOT_FOUND");
        const event = eventSnap.data();
        if (event.status !== "approved")
            throw new Error("EVENT_UNAVAILABLE");
        if (event.eventType !== "paid_inapp")
            throw new Error("NOT_PAID_INAPP");
        if (event.maxAttendees) {
            const attendeeCount = (_a = event.attendeeCount) !== null && _a !== void 0 ? _a : 0;
            if (attendeeCount + quantity > event.maxAttendees) {
                throw new Error("SOLD_OUT");
            }
        }
        const balance = (0, helpers_1.cashBalance)(walletSnap.data());
        if (balance < totalPrice)
            throw new Error("INSUFFICIENT_BALANCE");
        tx.set(walletRef, {
            cashBalance: balance - totalPrice,
            balance: balance - totalPrice,
            currency: "LKR",
            updatedAt: helpers_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        const transactionRef = helpers_1.db.collection("transactions").doc();
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
            createdAt: helpers_1.FieldValue.serverTimestamp(),
        });
        const qrCodeValue = `TICKET-${eventId}-${userId}-${(0, crypto_1.randomUUID)()}`;
        const ticketRef = helpers_1.db.collection("tickets").doc();
        tx.set(ticketRef, {
            eventId,
            userId,
            quantity,
            totalPrice,
            discount,
            promoId,
            qrCodeValue,
            status: "active",
            createdAt: helpers_1.FieldValue.serverTimestamp(),
        });
        tx.update(eventRef, {
            attendeeCount: helpers_1.FieldValue.increment(quantity),
            updatedAt: helpers_1.FieldValue.serverTimestamp(),
        });
        if (promoId) {
            tx.update(helpers_1.db.doc(`promoCodes/${promoId}`), {
                usedCount: helpers_1.FieldValue.increment(1),
            });
            const redemptionRef = helpers_1.db.collection("promoRedemptions").doc();
            tx.set(redemptionRef, {
                promoId,
                userId,
                eventId,
                discount,
                createdAt: helpers_1.FieldValue.serverTimestamp(),
            });
        }
        return { ticketId: ticketRef.id, qrCodeValue };
    })
        .catch((err) => {
        const code = err.message;
        if (code === "EVENT_NOT_FOUND")
            throw new https_1.HttpsError("not-found", "Event not found");
        if (code === "EVENT_UNAVAILABLE")
            throw new https_1.HttpsError("failed-precondition", "Event not available");
        if (code === "NOT_PAID_INAPP")
            throw new https_1.HttpsError("failed-precondition", "Not a paid in-app event");
        if (code === "SOLD_OUT")
            throw new https_1.HttpsError("resource-exhausted", "Not enough tickets available");
        if (code === "INSUFFICIENT_BALANCE")
            throw new https_1.HttpsError("failed-precondition", "Insufficient wallet balance");
        throw err;
    });
    await (0, helpers_1.createNotification)(userId, "Ticket Purchased", "Your ticket has been confirmed.", "ticket_purchase", {
        eventId,
        ticketId: result.ticketId,
    });
    try {
        const eventAfter = await eventRef.get();
        const eventData = eventAfter.data();
        if ((eventData === null || eventData === void 0 ? void 0 : eventData.chatEnabled) !== false) {
            if (!(eventData === null || eventData === void 0 ? void 0 : eventData.chatGroupId)) {
                await (0, chat_1.ensureEventChatGroup)(eventId, eventData !== null && eventData !== void 0 ? eventData : preview, preview.createdBy);
            }
            await (0, chat_1.addUserToEventChat)(eventId, userId);
        }
    }
    catch (err) {
        console.error("Failed to join event chat after ticket purchase", err);
    }
    return result;
});
/** Top up wallet with deposit fee — requires KYC */
exports.topUpWallet = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const userId = request.auth.uid;
    const { amount } = request.data;
    if (!amount || amount < 100) {
        throw new https_1.HttpsError("invalid-argument", "Minimum top-up is LKR 100");
    }
    try {
        await (0, helpers_1.requireKycApproved)(userId);
    }
    catch (_a) {
        throw new https_1.HttpsError("permission-denied", "KYC verification required", { code: "KYC_REQUIRED" });
    }
    const settings = await (0, helpers_1.getAppSettings)();
    const fee = Math.round(amount * (settings.depositFeePercent / 100) + settings.depositFeeFixed);
    const credited = amount - fee;
    try {
        await (0, helpers_1.checkSpendingLimits)(userId, 0);
    }
    catch (_b) {
        // deposits don't count against spend limits; KYC already checked
    }
    const walletRef = helpers_1.db.doc(`wallets/${userId}`);
    await helpers_1.db.runTransaction(async (tx) => {
        const walletSnap = await tx.get(walletRef);
        const balance = (0, helpers_1.cashBalance)(walletSnap.data());
        tx.set(walletRef, {
            cashBalance: balance + credited,
            balance: balance + credited,
            currency: "LKR",
            updatedAt: helpers_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        const transactionRef = helpers_1.db.collection("transactions").doc();
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
            createdAt: helpers_1.FieldValue.serverTimestamp(),
        });
        if (fee > 0) {
            const feeRef = helpers_1.db.collection("transactions").doc();
            tx.set(feeRef, {
                userId,
                type: "fee",
                amount: fee,
                currency: "LKR",
                status: "completed",
                description: "Deposit gateway fee",
                createdAt: helpers_1.FieldValue.serverTimestamp(),
            });
        }
    });
    return { success: true, credited, fee };
});
/** Create a pending deposit session for the secure checkout page */
exports.initiateWalletDeposit = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const userId = request.auth.uid;
    const { amount } = request.data;
    if (!amount || amount < 100)
        throw new https_1.HttpsError("invalid-argument", "Minimum top-up is LKR 100");
    try {
        await (0, helpers_1.requireKycApproved)(userId);
    }
    catch (_a) {
        throw new https_1.HttpsError("permission-denied", "KYC verification required", { code: "KYC_REQUIRED" });
    }
    const settings = await (0, helpers_1.getAppSettings)();
    const fee = Math.round(amount * (settings.depositFeePercent / 100) + settings.depositFeeFixed);
    const credited = amount - fee;
    const expiresAt = helpers_1.Timestamp.fromMillis(Date.now() + 15 * 60 * 1000);
    const ref = await helpers_1.db.collection("depositSessions").add({
        userId,
        amount,
        fee,
        credited,
        status: "pending",
        method: "card",
        expiresAt,
        createdAt: helpers_1.FieldValue.serverTimestamp(),
    });
    return {
        sessionId: ref.id,
        amount,
        fee,
        credited,
        expiresAt: expiresAt.toMillis(),
    };
});
/** Complete a pending deposit after the checkout UI confirms payment */
exports.completeWalletDeposit = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const userId = request.auth.uid;
    const { sessionId, method } = request.data;
    if (!sessionId)
        throw new https_1.HttpsError("invalid-argument", "sessionId required");
    const sessionRef = helpers_1.db.doc(`depositSessions/${sessionId}`);
    const walletRef = helpers_1.db.doc(`wallets/${userId}`);
    const result = await helpers_1.db.runTransaction(async (tx) => {
        var _a, _b, _c;
        const sessionSnap = await tx.get(sessionRef);
        if (!sessionSnap.exists)
            throw new Error("SESSION_NOT_FOUND");
        const session = sessionSnap.data();
        if (session.userId !== userId)
            throw new Error("FORBIDDEN");
        if (session.status === "completed")
            return { credited: session.credited, fee: session.fee, already: true };
        if (session.status !== "pending")
            throw new Error("SESSION_INVALID");
        const exp = (_c = (_b = (_a = session.expiresAt) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : 0;
        if (exp && Date.now() > exp)
            throw new Error("SESSION_EXPIRED");
        const walletSnap = await tx.get(walletRef);
        const balance = (0, helpers_1.cashBalance)(walletSnap.data());
        const credited = session.credited;
        const fee = session.fee;
        const amount = session.amount;
        tx.set(walletRef, {
            cashBalance: balance + credited,
            balance: balance + credited,
            currency: "LKR",
            updatedAt: helpers_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.update(sessionRef, {
            status: "completed",
            method: method !== null && method !== void 0 ? method : "card",
            completedAt: helpers_1.FieldValue.serverTimestamp(),
        });
        const transactionRef = helpers_1.db.collection("transactions").doc();
        tx.set(transactionRef, {
            userId,
            fromWalletId: "gateway",
            toWalletId: `wallets/${userId}`,
            type: "deposit",
            amount: credited,
            currency: "LKR",
            status: "completed",
            description: `Deposit LKR ${amount} via ${method !== null && method !== void 0 ? method : "card"} (fee LKR ${fee})`,
            metadata: { grossAmount: amount, fee, sessionId, method: method !== null && method !== void 0 ? method : "card" },
            createdAt: helpers_1.FieldValue.serverTimestamp(),
        });
        if (fee > 0) {
            tx.set(helpers_1.db.collection("transactions").doc(), {
                userId,
                type: "fee",
                amount: fee,
                currency: "LKR",
                status: "completed",
                description: "Deposit gateway fee",
                createdAt: helpers_1.FieldValue.serverTimestamp(),
            });
        }
        return { credited, fee, already: false };
    }).catch((err) => {
        if (err.message === "SESSION_NOT_FOUND")
            throw new https_1.HttpsError("not-found", "Checkout session not found");
        if (err.message === "FORBIDDEN")
            throw new https_1.HttpsError("permission-denied", "Not your checkout session");
        if (err.message === "SESSION_INVALID")
            throw new https_1.HttpsError("failed-precondition", "Session already used");
        if (err.message === "SESSION_EXPIRED")
            throw new https_1.HttpsError("deadline-exceeded", "Checkout session expired");
        throw err;
    });
    return { success: true, ...result };
});
/** Update attraction rating when review changes */
exports.updateAttractionRating = (0, firestore_1.onDocumentWritten)({ document: "reviews/{reviewId}", region: REGION }, async (event) => {
    var _a, _b, _c, _d;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    const review = after !== null && after !== void 0 ? after : before;
    if (!(review === null || review === void 0 ? void 0 : review.attractionId))
        return;
    const attractionId = review.attractionId;
    const reviewsSnap = await helpers_1.db
        .collection("reviews")
        .where("attractionId", "==", attractionId)
        .where("status", "==", "published")
        .get();
    let total = 0;
    reviewsSnap.forEach((doc) => {
        var _a;
        total += (_a = doc.data().rating) !== null && _a !== void 0 ? _a : 0;
    });
    const count = reviewsSnap.size;
    const average = count > 0 ? total / count : 0;
    await helpers_1.db.doc(`places/${attractionId}`).update({
        averageRating: Math.round(average * 10) / 10,
        reviewCount: count,
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    });
});
/** Initialize wallet when a user profile is created or updated without one yet */
exports.initUserWallet = (0, firestore_1.onDocumentWritten)({ document: "users/{userId}", region: REGION }, async (event) => {
    var _a;
    const after = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after;
    if (!(after === null || after === void 0 ? void 0 : after.exists))
        return;
    const userId = event.params.userId;
    const walletRef = helpers_1.db.doc(`wallets/${userId}`);
    const walletSnap = await walletRef.get();
    if (walletSnap.exists)
        return;
    const settings = await (0, helpers_1.getAppSettings)();
    await walletRef.set({
        cashBalance: 0,
        balance: 0,
        loyaltyPoints: 0,
        bonusPoints: 0,
        workBalance: 0,
        currency: "LKR",
        spendingLimitDaily: settings.defaultSpendingLimitDaily,
        spendingLimitMonthly: settings.defaultSpendingLimitMonthly,
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    });
});
/** Initialize app settings document */
exports.ensureAppSettings = (0, https_1.onCall)({ region: REGION }, async () => {
    const ref = helpers_1.db.doc("settings/app");
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
            notifyLkUserId: notifyLkConfig_1.DEFAULT_NOTIFYLK.userId,
            notifyLkApiKey: notifyLkConfig_1.DEFAULT_NOTIFYLK.apiKey,
            notifyLkSenderId: notifyLkConfig_1.DEFAULT_NOTIFYLK.senderId,
            updatedAt: helpers_1.FieldValue.serverTimestamp(),
        });
    }
    return { success: true };
});
//# sourceMappingURL=index.js.map