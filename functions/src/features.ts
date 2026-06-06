/**
 * New feature Cloud Functions:
 *  - updateVendorProfile      (REQ-VND-001)
 *  - spendWorkBalance         (REQ-WAL-010 spend side)
 *  - purchaseLotteryTicket    (lottery module)
 *  - createLottery            (admin)
 *  - drawLottery              (admin)
 *  - expireLoyaltyPoints      (scheduled, REQ-VND-006 expiry)
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  db,
  isAdmin,
  isApprovedVendor,
  requireKycApproved,
  createNotification,
  createAuditLog,
  recordTransaction,
  FieldValue,
  Timestamp,
} from "./helpers";

const REGION = "us-central1";

// ─── Vendor Profile Edit ─────────────────────────────────────────────────────

/** REQ-VND-001: Approved vendor can update their public profile. */
export const updateVendorProfile = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const vendorId = request.auth.uid;
  if (!(await isApprovedVendor(vendorId))) throw new HttpsError("permission-denied", "Approved vendor only");

  const {
    businessName,
    category,
    address,
    coordinates,
    phone,
    email,
    website,
    logoUrl,
    coverImageUrl,
    operatingHours,
    description,
  } = request.data as {
    businessName?: string;
    category?: string;
    address?: string;
    coordinates?: { lat: number; lng: number };
    phone?: string;
    email?: string;
    website?: string;
    logoUrl?: string;
    coverImageUrl?: string;
    operatingHours?: Record<string, { open: string; close: string; closed?: boolean }>;
    description?: string;
  };

  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (businessName !== undefined) update.businessName = businessName;
  if (category !== undefined) update.category = category;
  if (address !== undefined) update.address = address;
  if (coordinates !== undefined) update.coordinates = coordinates;
  if (phone !== undefined) update.phone = phone;
  if (email !== undefined) update.email = email;
  if (website !== undefined) update.website = website;
  if (logoUrl !== undefined) update.logoUrl = logoUrl;
  if (coverImageUrl !== undefined) update.coverImageUrl = coverImageUrl;
  if (operatingHours !== undefined) update.operatingHours = operatingHours;
  if (description !== undefined) update.description = description;

  await db.doc(`vendors/${vendorId}`).update(update);
  await createAuditLog(vendorId, "update_profile", "vendor", vendorId);
  return { success: true };
});

// ─── Work Balance Spend ───────────────────────────────────────────────────────

/** REQ-WAL-010 (spend side): User spends work_balance at a vendor POS. */
export const spendWorkBalance = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const userId = request.auth.uid;

  try {
    await requireKycApproved(userId);
  } catch {
    throw new HttpsError("permission-denied", "KYC verification required", { code: "KYC_REQUIRED" });
  }

  const { vendorId, amount } = request.data as { vendorId: string; amount: number };
  if (!vendorId || !amount || amount < 1) throw new HttpsError("invalid-argument", "Invalid input");

  if (!(await isApprovedVendor(vendorId))) throw new HttpsError("not-found", "Vendor not found or not active");

  const bindingSnap = await db.doc(`corporateBindings/${userId}_${vendorId}`).get();
  if (!bindingSnap.exists || bindingSnap.data()?.status !== "active") {
    throw new HttpsError("failed-precondition", "Not bound to this corporate vendor");
  }

  const uwRef = db.doc(`wallets/${userId}`);
  const vwRef = db.doc(`vendorWallets/${vendorId}`);

  await db.runTransaction(async (tx) => {
    const [uwSnap, vwSnap] = await Promise.all([tx.get(uwRef), tx.get(vwRef)]);
    const workBal = uwSnap.data()?.workBalance ?? 0;
    if (workBal < amount) throw new HttpsError("failed-precondition", "Insufficient work balance");
    const vendorCash = vwSnap.data()?.cashBalance ?? 0;

    tx.set(uwRef, { workBalance: workBal - amount, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(vwRef, { cashBalance: vendorCash + amount, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    recordTransaction(tx, {
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

  await createNotification(userId, "Work Balance Spent", `LKR ${amount} spent from your work balance.`, "work_balance_spend");
  return { success: true };
});

// ─── Lottery Module ───────────────────────────────────────────────────────────

/** Admin creates a lottery. */
export const createLottery = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isAdmin(request.auth.uid))) throw new HttpsError("permission-denied", "Admin only");

  const { title, description, pointsCost, prize, drawDate } = request.data as {
    title: string;
    description: string;
    pointsCost: number;
    prize: string;
    drawDate: number; // epoch ms
  };

  if (!title || !pointsCost || pointsCost < 1 || !prize || !drawDate) {
    throw new HttpsError("invalid-argument", "title, pointsCost, prize, drawDate are required");
  }

  const ref = await db.collection("lotteries").add({
    title,
    description: description ?? "",
    pointsCost,
    prize,
    drawDate: Timestamp.fromMillis(drawDate),
    status: "active",
    entryCount: 0,
    createdBy: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  await createAuditLog(request.auth.uid, "create_lottery", "lottery", ref.id);
  return { lotteryId: ref.id };
});

/** User purchases a lottery ticket with loyalty points. */
export const purchaseLotteryTicket = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const userId = request.auth.uid;

  try {
    await requireKycApproved(userId);
  } catch {
    throw new HttpsError("permission-denied", "KYC verification required", { code: "KYC_REQUIRED" });
  }

  const { lotteryId } = request.data as { lotteryId: string };
  if (!lotteryId) throw new HttpsError("invalid-argument", "lotteryId required");

  const lotterySnap = await db.doc(`lotteries/${lotteryId}`).get();
  if (!lotterySnap.exists) throw new HttpsError("not-found", "Lottery not found");
  const lottery = lotterySnap.data()!;
  if (lottery.status !== "active") throw new HttpsError("failed-precondition", "Lottery not active");

  const existing = await db.collection("lotteryEntries")
    .where("lotteryId", "==", lotteryId)
    .where("userId", "==", userId)
    .limit(1)
    .get();
  if (!existing.empty) throw new HttpsError("already-exists", "Already entered this lottery");

  const uwRef = db.doc(`wallets/${userId}`);

  await db.runTransaction(async (tx) => {
    const uwSnap = await tx.get(uwRef);
    const loyalty = uwSnap.data()?.loyaltyPoints ?? 0;
    if (loyalty < lottery.pointsCost) throw new HttpsError("failed-precondition", "Insufficient loyalty points");

    tx.set(uwRef, { loyaltyPoints: loyalty - lottery.pointsCost, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    const entryRef = db.collection("lotteryEntries").doc();
    tx.set(entryRef, {
      lotteryId,
      userId,
      pointsSpent: lottery.pointsCost,
      enteredAt: FieldValue.serverTimestamp(),
    });

    tx.update(db.doc(`lotteries/${lotteryId}`), { entryCount: FieldValue.increment(1) });

    recordTransaction(tx, {
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

  await createNotification(userId, "Lottery Entry Confirmed", `You entered "${lottery.title}". Good luck!`, "lottery_entry");
  return { success: true };
});

/** Admin draws a random winner for a lottery. */
export const drawLottery = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isAdmin(request.auth.uid))) throw new HttpsError("permission-denied", "Admin only");

  const { lotteryId, bonusPointsPrize } = request.data as { lotteryId: string; bonusPointsPrize?: number };
  if (!lotteryId) throw new HttpsError("invalid-argument", "lotteryId required");

  const lotterySnap = await db.doc(`lotteries/${lotteryId}`).get();
  if (!lotterySnap.exists) throw new HttpsError("not-found", "Lottery not found");
  const lottery = lotterySnap.data()!;
  if (lottery.status !== "active") throw new HttpsError("failed-precondition", "Lottery already drawn or closed");

  const entriesSnap = await db.collection("lotteryEntries")
    .where("lotteryId", "==", lotteryId)
    .get();

  if (entriesSnap.empty) throw new HttpsError("failed-precondition", "No entries in this lottery");

  const randomIndex = Math.floor(Math.random() * entriesSnap.docs.length);
  const winnerEntry = entriesSnap.docs[randomIndex].data();
  const winnerId = winnerEntry.userId as string;

  await db.runTransaction(async (tx) => {
    tx.update(db.doc(`lotteries/${lotteryId}`), {
      status: "drawn",
      winnerId,
      drawnAt: FieldValue.serverTimestamp(),
      drawnBy: request.auth!.uid,
    });

    if (bonusPointsPrize && bonusPointsPrize > 0) {
      const uwRef = db.doc(`wallets/${winnerId}`);
      const uwSnap = await tx.get(uwRef);
      const bonus = uwSnap.data()?.bonusPoints ?? 0;
      tx.set(uwRef, { bonusPoints: bonus + bonusPointsPrize, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      recordTransaction(tx, {
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

  await createNotification(
    winnerId,
    "You Won! 🎉",
    `Congratulations! You won the "${lottery.title}" lottery. Prize: ${lottery.prize}`,
    "lottery_win"
  );
  await createAuditLog(request.auth.uid, "draw_lottery", "lottery", lotteryId, winnerId);
  return { success: true, winnerId };
});

// ─── Points Expiry (Scheduled) ────────────────────────────────────────────────

/**
 * Runs daily. Finds loyalty grants whose earn date + program expiry days < now,
 * deducts those points from users' wallets and marks grants "expired".
 */
export const expireLoyaltyPoints = onSchedule(
  { schedule: "every 24 hours", region: REGION },
  async () => {
    const now = Timestamp.now();

    // Fetch all programs with rolling_days expiry
    const programsSnap = await db
      .collection("loyaltyPrograms")
      .where("expiryPolicy", "==", "rolling_days")
      .get();

    let totalExpired = 0;

    for (const programDoc of programsSnap.docs) {
      const program = programDoc.data();
      const rollingDays: number = program.expiryDays ?? 180;
      const cutoff = Timestamp.fromMillis(now.toMillis() - rollingDays * 86400_000);

      const grantsSnap = await db
        .collection("loyaltyGrants")
        .where("programId", "==", programDoc.id)
        .where("status", "==", "confirmed")
        .where("grantedAt", "<", cutoff)
        .limit(200)
        .get();

      if (grantsSnap.empty) continue;

      // Group deductions by userId
      const deductions: Record<string, number> = {};
      for (const grantDoc of grantsSnap.docs) {
        const g = grantDoc.data();
        const uid = g.userId as string;
        deductions[uid] = (deductions[uid] ?? 0) + (g.pointsGranted as number ?? 0);
      }

      const batch = db.batch();

      // Deduct from each user's wallet
      for (const [uid, pts] of Object.entries(deductions)) {
        if (pts <= 0) continue;
        const uwRef = db.doc(`wallets/${uid}`);
        batch.set(
          uwRef,
          { loyaltyPoints: FieldValue.increment(-pts), updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        // Record expiry transaction
        const txRef = db.collection("transactions").doc();
        batch.set(txRef, {
          userId: uid,
          fromWalletId: `wallets/${uid}`,
          toWalletId: "platform/expiry",
          amount: pts,
          currency: "POINTS",
          type: "points_expiry",
          status: "completed",
          description: `Loyalty points expired (program: ${programDoc.id})`,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      // Mark grants expired
      for (const grantDoc of grantsSnap.docs) {
        batch.update(grantDoc.ref, { status: "expired", expiredAt: FieldValue.serverTimestamp() });
      }

      await batch.commit();
      totalExpired += grantsSnap.size;
    }

    console.log(`Expired loyalty grants: ${totalExpired}`);
  }
);
