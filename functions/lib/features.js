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
exports.autoDrawDueLotteries = exports.expireLoyaltyPoints = exports.drawLottery = exports.purchaseLotteryTicket = exports.createLottery = exports.spendWorkBalance = exports.updateVendorProfile = void 0;
/**
 * New feature Cloud Functions:
 *  - updateVendorProfile      (REQ-VND-001)
 *  - spendWorkBalance         (REQ-WAL-010 spend side)
 *  - purchaseLotteryTicket    (lottery module)
 *  - createLottery            (admin)
 *  - drawLottery              (admin)
 *  - expireLoyaltyPoints      (scheduled, REQ-VND-006 expiry)
 */
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const helpers_1 = require("./helpers");
const REGION = "us-central1";
// ─── Vendor Profile Edit ─────────────────────────────────────────────────────
/** REQ-VND-001: Approved vendor can update their public profile. */
exports.updateVendorProfile = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const vendorId = request.auth.uid;
    if (!(await (0, helpers_1.isApprovedVendor)(vendorId)))
        throw new https_1.HttpsError("permission-denied", "Approved vendor only");
    const { businessName, category, address, coordinates, phone, email, website, logoUrl, coverImageUrl, operatingHours, description, } = request.data;
    const update = { updatedAt: helpers_1.FieldValue.serverTimestamp() };
    if (businessName !== undefined)
        update.businessName = businessName;
    if (category !== undefined)
        update.category = category;
    if (address !== undefined)
        update.address = address;
    if (coordinates !== undefined)
        update.coordinates = coordinates;
    if (phone !== undefined)
        update.phone = phone;
    if (email !== undefined)
        update.email = email;
    if (website !== undefined)
        update.website = website;
    if (logoUrl !== undefined)
        update.logoUrl = logoUrl;
    if (coverImageUrl !== undefined)
        update.coverImageUrl = coverImageUrl;
    if (operatingHours !== undefined)
        update.operatingHours = operatingHours;
    if (description !== undefined)
        update.description = description;
    await helpers_1.db.doc(`vendors/${vendorId}`).update(update);
    await (0, helpers_1.createAuditLog)(vendorId, "update_profile", "vendor", vendorId);
    return { success: true };
});
// ─── Work Balance Spend ───────────────────────────────────────────────────────
/** REQ-WAL-010 (spend side): User spends work_balance at a vendor POS. */
exports.spendWorkBalance = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const userId = request.auth.uid;
    try {
        await (0, helpers_1.requireKycApproved)(userId);
    }
    catch (_b) {
        throw new https_1.HttpsError("permission-denied", "KYC verification required", { code: "KYC_REQUIRED" });
    }
    const { vendorId, amount } = request.data;
    if (!vendorId || !amount || amount < 1)
        throw new https_1.HttpsError("invalid-argument", "Invalid input");
    if (!(await (0, helpers_1.isApprovedVendor)(vendorId)))
        throw new https_1.HttpsError("not-found", "Vendor not found or not active");
    const bindingSnap = await helpers_1.db.doc(`corporateBindings/${userId}_${vendorId}`).get();
    if (!bindingSnap.exists || ((_a = bindingSnap.data()) === null || _a === void 0 ? void 0 : _a.status) !== "active") {
        throw new https_1.HttpsError("failed-precondition", "Not bound to this corporate vendor");
    }
    const uwRef = helpers_1.db.doc(`wallets/${userId}`);
    const vwRef = helpers_1.db.doc(`vendorWallets/${vendorId}`);
    await helpers_1.db.runTransaction(async (tx) => {
        var _a, _b, _c, _d;
        const [uwSnap, vwSnap] = await Promise.all([tx.get(uwRef), tx.get(vwRef)]);
        const workBal = (_b = (_a = uwSnap.data()) === null || _a === void 0 ? void 0 : _a.workBalance) !== null && _b !== void 0 ? _b : 0;
        if (workBal < amount)
            throw new https_1.HttpsError("failed-precondition", "Insufficient work balance");
        const vendorCash = (_d = (_c = vwSnap.data()) === null || _c === void 0 ? void 0 : _c.cashBalance) !== null && _d !== void 0 ? _d : 0;
        tx.set(uwRef, { workBalance: workBal - amount, updatedAt: helpers_1.FieldValue.serverTimestamp() }, { merge: true });
        tx.set(vwRef, { cashBalance: vendorCash + amount, updatedAt: helpers_1.FieldValue.serverTimestamp() }, { merge: true });
        (0, helpers_1.recordTransaction)(tx, {
            userId,
            vendorId,
            fromWalletId: `wallets/${userId}`,
            toWalletId: `vendorWallets/${vendorId}`,
            amount,
            currency: "LKR",
            type: "work_balance_spend",
            description: `Work balance spend at vendor`,
            metadata: { companyId: vendorId, ledger: "work_balance" },
        });
    });
    await (0, helpers_1.createNotification)(userId, "Work Balance Spent", `LKR ${amount} spent from your work balance.`, "work_balance_spend");
    return { success: true };
});
// ─── Lottery Module ───────────────────────────────────────────────────────────
/** Admin creates a lottery. */
exports.createLottery = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isAdmin)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Admin only");
    const { title, description, pointsCost, prize, drawDate } = request.data;
    if (!title || !pointsCost || pointsCost < 1 || !prize || !drawDate) {
        throw new https_1.HttpsError("invalid-argument", "title, pointsCost, prize, drawDate are required");
    }
    const ref = await helpers_1.db.collection("lotteries").add({
        title,
        description: description !== null && description !== void 0 ? description : "",
        pointsCost,
        prize,
        drawDate: helpers_1.Timestamp.fromMillis(drawDate),
        status: "active",
        entryCount: 0,
        createdBy: request.auth.uid,
        createdAt: helpers_1.FieldValue.serverTimestamp(),
    });
    await (0, helpers_1.createAuditLog)(request.auth.uid, "create_lottery", "lottery", ref.id);
    return { lotteryId: ref.id };
});
/** User purchases a lottery ticket with loyalty points. */
exports.purchaseLotteryTicket = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const userId = request.auth.uid;
    try {
        await (0, helpers_1.requireKycApproved)(userId);
    }
    catch (_a) {
        throw new https_1.HttpsError("permission-denied", "KYC verification required", { code: "KYC_REQUIRED" });
    }
    const { lotteryId } = request.data;
    if (!lotteryId)
        throw new https_1.HttpsError("invalid-argument", "lotteryId required");
    const lotterySnap = await helpers_1.db.doc(`lotteries/${lotteryId}`).get();
    if (!lotterySnap.exists)
        throw new https_1.HttpsError("not-found", "Lottery not found");
    const lottery = lotterySnap.data();
    if (lottery.status !== "active")
        throw new https_1.HttpsError("failed-precondition", "Lottery not active");
    const existing = await helpers_1.db.collection("lotteryEntries")
        .where("lotteryId", "==", lotteryId)
        .where("userId", "==", userId)
        .limit(1)
        .get();
    if (!existing.empty)
        throw new https_1.HttpsError("already-exists", "Already entered this lottery");
    const uwRef = helpers_1.db.doc(`wallets/${userId}`);
    await helpers_1.db.runTransaction(async (tx) => {
        var _a, _b;
        const uwSnap = await tx.get(uwRef);
        const loyalty = (_b = (_a = uwSnap.data()) === null || _a === void 0 ? void 0 : _a.loyaltyPoints) !== null && _b !== void 0 ? _b : 0;
        if (loyalty < lottery.pointsCost)
            throw new https_1.HttpsError("failed-precondition", "Insufficient loyalty points");
        tx.set(uwRef, { loyaltyPoints: loyalty - lottery.pointsCost, updatedAt: helpers_1.FieldValue.serverTimestamp() }, { merge: true });
        const entryRef = helpers_1.db.collection("lotteryEntries").doc();
        tx.set(entryRef, {
            lotteryId,
            userId,
            pointsSpent: lottery.pointsCost,
            enteredAt: helpers_1.FieldValue.serverTimestamp(),
        });
        tx.update(helpers_1.db.doc(`lotteries/${lotteryId}`), { entryCount: helpers_1.FieldValue.increment(1) });
        (0, helpers_1.recordTransaction)(tx, {
            userId,
            fromWalletId: `wallets/${userId}`,
            toWalletId: "platform/lottery",
            amount: lottery.pointsCost,
            currency: "POINTS",
            type: "lottery_spend",
            description: `Lottery entry: ${lottery.title}`,
            metadata: { lotteryId },
        });
    });
    await (0, helpers_1.createNotification)(userId, "Lottery Entry Confirmed", `You entered "${lottery.title}". Good luck!`, "lottery_entry");
    return { success: true };
});
/** Admin draws a random winner for a lottery. */
exports.drawLottery = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isAdmin)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Admin only");
    const { lotteryId, bonusPointsPrize } = request.data;
    if (!lotteryId)
        throw new https_1.HttpsError("invalid-argument", "lotteryId required");
    const lotterySnap = await helpers_1.db.doc(`lotteries/${lotteryId}`).get();
    if (!lotterySnap.exists)
        throw new https_1.HttpsError("not-found", "Lottery not found");
    const lottery = lotterySnap.data();
    if (lottery.status !== "active")
        throw new https_1.HttpsError("failed-precondition", "Lottery already drawn or closed");
    const entriesSnap = await helpers_1.db.collection("lotteryEntries")
        .where("lotteryId", "==", lotteryId)
        .get();
    if (entriesSnap.empty)
        throw new https_1.HttpsError("failed-precondition", "No entries in this lottery");
    const { randomInt } = await Promise.resolve().then(() => __importStar(require("crypto")));
    const randomIndex = randomInt(0, entriesSnap.docs.length);
    const winnerEntry = entriesSnap.docs[randomIndex].data();
    const winnerId = winnerEntry.userId;
    await helpers_1.db.runTransaction(async (tx) => {
        var _a, _b;
        tx.update(helpers_1.db.doc(`lotteries/${lotteryId}`), {
            status: "drawn",
            winnerId,
            drawnAt: helpers_1.FieldValue.serverTimestamp(),
            drawnBy: request.auth.uid,
        });
        if (bonusPointsPrize && bonusPointsPrize > 0) {
            const uwRef = helpers_1.db.doc(`wallets/${winnerId}`);
            const uwSnap = await tx.get(uwRef);
            const bonus = (_b = (_a = uwSnap.data()) === null || _a === void 0 ? void 0 : _a.bonusPoints) !== null && _b !== void 0 ? _b : 0;
            tx.set(uwRef, { bonusPoints: bonus + bonusPointsPrize, updatedAt: helpers_1.FieldValue.serverTimestamp() }, { merge: true });
            (0, helpers_1.recordTransaction)(tx, {
                userId: winnerId,
                fromWalletId: "platform/lottery",
                toWalletId: `wallets/${winnerId}`,
                amount: bonusPointsPrize,
                currency: "POINTS",
                type: "lottery_win",
                description: `Lottery win: ${lottery.title}`,
                metadata: { lotteryId },
            });
        }
    });
    await (0, helpers_1.createNotification)(winnerId, "You Won! 🎉", `Congratulations! You won the "${lottery.title}" lottery. Prize: ${lottery.prize}`, "lottery_win");
    await (0, helpers_1.createAuditLog)(request.auth.uid, "draw_lottery", "lottery", lotteryId, winnerId);
    return { success: true, winnerId };
});
// ─── Points Expiry (Scheduled) ────────────────────────────────────────────────
/**
 * Runs daily. Finds loyalty grants whose earn date + program expiry days < now,
 * deducts those points from users' wallets and marks grants "expired".
 */
exports.expireLoyaltyPoints = (0, scheduler_1.onSchedule)({ schedule: "every 24 hours", region: REGION }, async () => {
    var _a, _b, _c;
    const now = helpers_1.Timestamp.now();
    // Fetch all programs with rolling_days expiry
    const programsSnap = await helpers_1.db
        .collection("loyaltyPrograms")
        .where("expiryPolicy", "==", "rolling_days")
        .get();
    let totalExpired = 0;
    for (const programDoc of programsSnap.docs) {
        const program = programDoc.data();
        const rollingDays = (_a = program.expiryDays) !== null && _a !== void 0 ? _a : 180;
        const cutoff = helpers_1.Timestamp.fromMillis(now.toMillis() - rollingDays * 86400000);
        const grantsSnap = await helpers_1.db
            .collection("loyaltyGrants")
            .where("programId", "==", programDoc.id)
            .where("status", "==", "confirmed")
            .where("grantedAt", "<", cutoff)
            .limit(200)
            .get();
        if (grantsSnap.empty)
            continue;
        // Group deductions by userId
        const deductions = {};
        for (const grantDoc of grantsSnap.docs) {
            const g = grantDoc.data();
            const uid = g.userId;
            deductions[uid] = ((_b = deductions[uid]) !== null && _b !== void 0 ? _b : 0) + ((_c = g.pointsGranted) !== null && _c !== void 0 ? _c : 0);
        }
        const batch = helpers_1.db.batch();
        // Deduct from each user's wallet
        for (const [uid, pts] of Object.entries(deductions)) {
            if (pts <= 0)
                continue;
            const uwRef = helpers_1.db.doc(`wallets/${uid}`);
            batch.set(uwRef, { loyaltyPoints: helpers_1.FieldValue.increment(-pts), updatedAt: helpers_1.FieldValue.serverTimestamp() }, { merge: true });
            // Record expiry transaction
            const txRef = helpers_1.db.collection("transactions").doc();
            batch.set(txRef, {
                userId: uid,
                fromWalletId: `wallets/${uid}`,
                toWalletId: "platform/expiry",
                amount: pts,
                currency: "POINTS",
                type: "points_expiry",
                status: "completed",
                description: `Loyalty points expired (program: ${programDoc.id})`,
                createdAt: helpers_1.FieldValue.serverTimestamp(),
            });
        }
        // Mark grants expired
        for (const grantDoc of grantsSnap.docs) {
            batch.update(grantDoc.ref, { status: "expired", expiredAt: helpers_1.FieldValue.serverTimestamp() });
        }
        await batch.commit();
        totalExpired += grantsSnap.size;
    }
    console.log(`Expired loyalty grants: ${totalExpired}`);
});
/** REQ-LOT-003: auto-draw lotteries whose drawDate has passed. */
exports.autoDrawDueLotteries = (0, scheduler_1.onSchedule)({ schedule: "every 15 minutes", region: REGION }, async () => {
    var _a, _b, _c;
    const now = helpers_1.Timestamp.now();
    const snap = await helpers_1.db.collection("lotteries").where("status", "==", "active").limit(50).get();
    const { randomInt } = await Promise.resolve().then(() => __importStar(require("crypto")));
    for (const lotteryDoc of snap.docs) {
        const lottery = lotteryDoc.data();
        const drawMs = (_c = (_b = (_a = lottery.drawDate) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : 0;
        if (!drawMs || drawMs > now.toMillis())
            continue;
        const entriesSnap = await helpers_1.db.collection("lotteryEntries").where("lotteryId", "==", lotteryDoc.id).get();
        if (entriesSnap.empty) {
            await lotteryDoc.ref.update({
                status: "closed",
                drawnAt: helpers_1.FieldValue.serverTimestamp(),
                drawnBy: "scheduler",
            });
            continue;
        }
        const winnerEntry = entriesSnap.docs[randomInt(0, entriesSnap.docs.length)].data();
        const winnerId = winnerEntry.userId;
        await lotteryDoc.ref.update({
            status: "drawn",
            winnerId,
            drawnAt: helpers_1.FieldValue.serverTimestamp(),
            drawnBy: "scheduler",
        });
        await (0, helpers_1.createNotification)(winnerId, "You Won! 🎉", `Congratulations! You won the "${lottery.title}" lottery. Prize: ${lottery.prize}`, "lottery_win");
    }
});
//# sourceMappingURL=features.js.map