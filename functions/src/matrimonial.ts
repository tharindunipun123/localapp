/**
 * Matrimonial Module — REQ-MAT-001 through REQ-MAT-012
 *
 * Collections:
 *   matrimonialProfiles/{uid}          — user's matrimonial profile
 *   matrimonialPhotoQueue/{docId}      — photos awaiting admin moderation
 *   matrimonialProfileViews/{uid}_{tgt}— view history (7-day re-view free)
 *   matrimonialInterests/{from}_{to}   — expressions of interest
 *   matrimonialUnlocks/{uid}_{tgt}     — paid unlocks for paginated search
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  db,
  isAdmin,
  createNotification,
  createAuditLog,
  FieldValue,
  Timestamp,
} from "./helpers";

const REGION = "us-central1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireMatrimonialActive(uid: string) {
  const snap = await db.doc(`matrimonialProfiles/${uid}`).get();
  if (!snap.exists || !snap.data()?.isActive) {
    throw new HttpsError("not-found", "No active matrimonial profile");
  }
  return snap.data()!;
}

async function getCoins(uid: string): Promise<number> {
  const snap = await db.doc(`wallets/${uid}`).get();
  return snap.data()?.coins ?? 0;
}

async function deductCoins(uid: string, amount: number, description: string): Promise<void> {
  const walletRef = db.doc(`wallets/${uid}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(walletRef);
    const coins = snap.data()?.coins ?? 0;
    if (coins < amount) throw new HttpsError("failed-precondition", "Insufficient coins");
    tx.set(walletRef, { coins: coins - amount, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const txRef = db.collection("transactions").doc();
    tx.set(txRef, {
      userId: uid,
      fromWalletId: `wallets/${uid}`,
      toWalletId: "platform/matrimonial",
      amount,
      currency: "COINS",
      type: "matrimonial_spend",
      status: "completed",
      description,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

// ─── Profile CRUD ─────────────────────────────────────────────────────────────

/** REQ-MAT-001, REQ-MAT-002: Create or update matrimonial profile. */
export const createOrUpdateMatrimonialProfile = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;

  const {
    gender,
    dateOfBirth,
    religion,
    ethnicity,
    caste,
    heightCm,
    education,
    occupation,
    incomeRange,
    district,
    city,
    aboutMe,
    hobbies,
    familyDetails,
    expectations,
    privacyShowFullName,
    privacyShowPhotosTo,
  } = request.data as {
    gender: string;
    dateOfBirth: number; // epoch ms
    religion: string;
    ethnicity: string;
    caste?: string;
    heightCm: number;
    education: string;
    occupation: string;
    incomeRange: string;
    district: string;
    city: string;
    aboutMe: string;
    hobbies?: string[];
    familyDetails?: string;
    expectations?: string;
    privacyShowFullName?: boolean;
    privacyShowPhotosTo?: "all" | "matches_only" | "none";
  };

  if (!gender || !dateOfBirth || !religion || !ethnicity || !heightCm || !education || !district) {
    throw new HttpsError("invalid-argument", "Required fields missing");
  }
  if (aboutMe && aboutMe.length > 500) {
    throw new HttpsError("invalid-argument", "About me cannot exceed 500 characters");
  }

  // Get display name from user profile
  const userSnap = await db.doc(`users/${uid}`).get();
  const displayName = userSnap.data()?.displayName ?? "";

  const existing = (await db.doc(`matrimonialProfiles/${uid}`).get()).exists;

  await db.doc(`matrimonialProfiles/${uid}`).set(
    {
      uid,
      gender,
      dateOfBirth: Timestamp.fromMillis(dateOfBirth),
      religion,
      ethnicity,
      caste: caste ?? "",
      heightCm,
      education,
      occupation,
      incomeRange,
      district,
      city,
      aboutMe: aboutMe ?? "",
      hobbies: hobbies ?? [],
      familyDetails: familyDetails ?? "",
      expectations: expectations ?? "",
      privacyShowFullName: privacyShowFullName !== false,
      privacyShowPhotosTo: privacyShowPhotosTo ?? "all",
      photos: existing ? FieldValue.delete() : [],
      isActive: true,
      displayName,
      updatedAt: FieldValue.serverTimestamp(),
      ...(existing ? {} : { createdAt: FieldValue.serverTimestamp(), photos: [] }),
    },
    { merge: true }
  );

  return { success: true, created: !existing };
});

/** REQ-MAT-010: hide or reactivate the matrimonial profile. */
export const setMatrimonialProfileActive = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;
  const { isActive } = request.data as { isActive?: boolean };
  if (typeof isActive !== "boolean") throw new HttpsError("invalid-argument", "isActive required");
  const ref = db.doc(`matrimonialProfiles/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Profile not found");
  await ref.update({ isActive, updatedAt: FieldValue.serverTimestamp() });
  return { success: true, isActive };
});

/** REQ-MAT-002: Submit photo to admin moderation queue. */
export const submitMatrimonialPhoto = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;

  const profile = await db.doc(`matrimonialProfiles/${uid}`).get();
  if (!profile.exists) throw new HttpsError("not-found", "Create a profile first");

  const currentPhotos: string[] = profile.data()?.photos ?? [];
  const pendingSnap = await db
    .collection("matrimonialPhotoQueue")
    .where("uid", "==", uid)
    .where("status", "==", "pending")
    .get();

  if (currentPhotos.length + pendingSnap.size >= 6) {
    throw new HttpsError("failed-precondition", "Maximum 6 photos allowed (including pending)");
  }

  const { storagePath, downloadUrl } = request.data as { storagePath: string; downloadUrl: string };
  if (!storagePath || !downloadUrl) throw new HttpsError("invalid-argument", "storagePath and downloadUrl required");

  const ref = await db.collection("matrimonialPhotoQueue").add({
    uid,
    storagePath,
    downloadUrl,
    status: "pending",
    submittedAt: FieldValue.serverTimestamp(),
  });

  return { queueId: ref.id };
});

/** REQ-MAT-003: Admin moderates a queued photo. */
export const moderateMatrimonialPhoto = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isAdmin(request.auth.uid))) throw new HttpsError("permission-denied", "Admin only");

  const { queueId, action } = request.data as { queueId: string; action: "approve" | "reject" };
  if (!queueId || !["approve", "reject"].includes(action)) {
    throw new HttpsError("invalid-argument", "queueId and action (approve|reject) required");
  }

  const queueRef = db.doc(`matrimonialPhotoQueue/${queueId}`);
  const snap = await queueRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Queue item not found");

  const item = snap.data()!;
  if (item.status !== "pending") throw new HttpsError("failed-precondition", "Already processed");

  await queueRef.update({ status: action === "approve" ? "approved" : "rejected", reviewedAt: FieldValue.serverTimestamp(), reviewedBy: request.auth.uid });

  if (action === "approve") {
    const profileRef = db.doc(`matrimonialProfiles/${item.uid}`);
    const profileSnap = await profileRef.get();
    const existing: string[] = profileSnap.data()?.photos ?? [];
    if (existing.length < 6) {
      await profileRef.update({ photos: [...existing, item.downloadUrl], updatedAt: FieldValue.serverTimestamp() });
    }
    await createNotification(item.uid, "Photo Approved", "Your matrimonial profile photo has been approved.", "mat_photo_approved");
  } else {
    await createNotification(item.uid, "Photo Rejected", "One of your matrimonial photos was not approved. Please upload a different photo.", "mat_photo_rejected");
  }

  await createAuditLog(request.auth.uid, action, "matrimonial_photo", queueId);
  return { success: true };
});

/** REQ-MAT-005, REQ-MAT-006, REQ-MAT-007: Search profiles. Page 1 free; page 2+ costs coins. */
export const searchMatrimonialProfiles = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;

  const {
    gender,
    minAge,
    maxAge,
    religion,
    district,
    ethnicity,
    minHeight,
    maxHeight,
    education,
    page = 1,
  } = request.data as {
    gender?: string;
    minAge?: number;
    maxAge?: number;
    religion?: string;
    district?: string;
    ethnicity?: string;
    minHeight?: number;
    maxHeight?: number;
    education?: string;
    page?: number;
  };

  const PAGE_SIZE = 20;

  // Pages beyond 1 cost coins (REQ-MAT-007)
  if (page > 1) {
    const settings = await db.doc("settings/app").get();
    const searchPageCost: number = settings.data()?.matrimonialSearchPageCost ?? 50;
    const coins = await getCoins(uid);
    if (coins < searchPageCost) {
      throw new HttpsError("resource-exhausted", "Insufficient coins for additional search pages", { coinsRequired: searchPageCost, coinsHeld: coins });
    }
    await deductCoins(uid, searchPageCost, `Matrimonial search page ${page}`);
  }

  // Build Firestore query with exact-match filters
  let q = db.collection("matrimonialProfiles").where("isActive", "==", true).where("uid", "!=", uid);

  if (gender) q = q.where("gender", "==", gender) as typeof q;
  if (religion) q = q.where("religion", "==", religion) as typeof q;
  if (district) q = q.where("district", "==", district) as typeof q;
  if (ethnicity) q = q.where("ethnicity", "==", ethnicity) as typeof q;

  // Age range via dateOfBirth
  if (minAge || maxAge) {
    const now = new Date();
    if (maxAge) {
      const minDob = Timestamp.fromMillis(new Date(now.getFullYear() - maxAge, now.getMonth(), now.getDate()).getTime());
      q = q.where("dateOfBirth", ">=", minDob) as typeof q;
    }
    if (minAge) {
      const maxDob = Timestamp.fromMillis(new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate()).getTime());
      q = q.where("dateOfBirth", "<=", maxDob) as typeof q;
    }
  }

  const snap = await q.limit(PAGE_SIZE * 3).get(); // fetch more so we can filter in memory

  let results = snap.docs.map((d) => d.data());

  // In-memory filters (Firestore only supports one range inequality per query)
  if (minHeight) results = results.filter((p) => (p.heightCm ?? 0) >= minHeight);
  if (maxHeight) results = results.filter((p) => (p.heightCm ?? 0) <= maxHeight);
  if (education) results = results.filter((p) => p.education === education);

  const total = results.length;
  const pageResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Apply privacy settings before returning
  const sanitized = pageResults.map((p) => sanitizeProfile(p, uid, false));

  return { profiles: sanitized, total, page, pageSize: PAGE_SIZE, hasMore: total > page * PAGE_SIZE };
});

function sanitizeProfile(p: Record<string, unknown>, viewerUid: string, isFullView: boolean) {
  const showFullName = p.privacyShowFullName !== false;
  const displayName = showFullName
    ? (p.displayName as string)
    : ((p.displayName as string)?.split(" ")[0] ?? "—");

  const dob = (p.dateOfBirth as { toMillis?: () => number })?.toMillis?.() ?? null;
  const age = dob ? Math.floor((Date.now() - dob) / (365.25 * 86400000)) : null;

  const base = {
    uid: p.uid,
    displayName,
    gender: p.gender,
    age,
    religion: p.religion,
    ethnicity: p.ethnicity,
    district: p.district,
    city: p.city,
    heightCm: p.heightCm,
    education: p.education,
    occupation: p.occupation,
    incomeRange: p.incomeRange,
  };

  if (!isFullView) return { ...base, primaryPhoto: (p.photos as string[])?.[0] ?? null };

  const showPhotos = p.privacyShowPhotosTo as string;
  const photos = showPhotos === "none" ? [] : (p.photos as string[]) ?? [];

  return {
    ...base,
    photos,
    caste: p.caste,
    aboutMe: p.aboutMe,
    hobbies: p.hobbies,
    familyDetails: p.familyDetails,
    expectations: p.expectations,
    incomeRange: p.incomeRange,
  };
}

/** REQ-MAT-007, REQ-MAT-008: Unlock a profile for full view (coins charged once per 7 days). */
export const unlockMatrimonialProfile = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;
  const { profileId } = request.data as { profileId: string };
  if (!profileId) throw new HttpsError("invalid-argument", "profileId required");
  if (profileId === uid) throw new HttpsError("invalid-argument", "Cannot view own profile via unlock");

  const profile = await db.doc(`matrimonialProfiles/${profileId}`).get();
  if (!profile.exists || !profile.data()?.isActive) throw new HttpsError("not-found", "Profile not found");

  const viewRef = db.doc(`matrimonialProfileViews/${uid}_${profileId}`);
  const viewSnap = await viewRef.get();

  // REQ-MAT-008: No re-charge within 7 days
  const sevenDaysMs = 7 * 86400000;
  if (viewSnap.exists) {
    const viewedAt = viewSnap.data()?.viewedAt?.toMillis?.() ?? 0;
    if (Date.now() - viewedAt < sevenDaysMs) {
      // Already unlocked — return full profile for free
      return { profile: sanitizeProfile(profile.data()!, uid, true), coinsCharged: 0 };
    }
  }

  // Deduct coins
  const settings = await db.doc("settings/app").get();
  const unlockCost: number = settings.data()?.matrimonialUnlockCost ?? 50;
  await deductCoins(uid, unlockCost, `View matrimonial profile ${profileId}`);

  // Record view
  await viewRef.set({
    viewerId: uid,
    profileId,
    viewedAt: FieldValue.serverTimestamp(),
    coinsCharged: unlockCost,
  });

  return { profile: sanitizeProfile(profile.data()!, uid, true), coinsCharged: unlockCost };
});

/** REQ-MAT-007: Send expression of interest (costs coins). */
export const sendMatrimonialInterest = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;

  const { profileId, message } = request.data as { profileId: string; message?: string };
  if (!profileId) throw new HttpsError("invalid-argument", "profileId required");

  await requireMatrimonialActive(uid);
  const target = await db.doc(`matrimonialProfiles/${profileId}`).get();
  if (!target.exists || !target.data()?.isActive) throw new HttpsError("not-found", "Profile not found");

  const existingSnap = await db.doc(`matrimonialInterests/${uid}_${profileId}`).get();
  if (existingSnap.exists) throw new HttpsError("already-exists", "Interest already sent");

  const settings = await db.doc("settings/app").get();
  const interestCost: number = settings.data()?.matrimonialInterestCost ?? 50;
  await deductCoins(uid, interestCost, `Expression of interest to ${profileId}`);

  await db.doc(`matrimonialInterests/${uid}_${profileId}`).set({
    fromUserId: uid,
    toUserId: profileId,
    message: message ?? "",
    status: "sent",
    createdAt: FieldValue.serverTimestamp(),
  });

  await createNotification(profileId, "New Interest", "Someone has sent you an expression of interest on Matrimonial.", "mat_interest", { fromUserId: uid });
  return { success: true, coinsCharged: interestCost };
});

/** Respond to a matrimonial interest (accept | reject). */
export const respondToMatrimonialInterest = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;

  const { fromUserId, action } = request.data as { fromUserId: string; action: "accept" | "reject" };
  if (!fromUserId || !["accept", "reject"].includes(action)) {
    throw new HttpsError("invalid-argument", "fromUserId and action required");
  }

  const interestRef = db.doc(`matrimonialInterests/${fromUserId}_${uid}`);
  const snap = await interestRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Interest not found");
  if (snap.data()?.status !== "sent") throw new HttpsError("failed-precondition", "Already responded");

  await interestRef.update({ status: action === "accept" ? "accepted" : "rejected", respondedAt: FieldValue.serverTimestamp() });

  if (action === "accept") {
    await createNotification(fromUserId, "Interest Accepted", "Your expression of interest has been accepted!", "mat_interest_accepted", { toUserId: uid });
  } else {
    await createNotification(fromUserId, "Interest Not Accepted", "Your expression of interest was not accepted.", "mat_interest_rejected");
  }

  return { success: true };
});

/** Admin: credit coins to a user. */
export const adminCreditCoins = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isAdmin(request.auth.uid))) throw new HttpsError("permission-denied", "Admin only");

  const { userId, coins, reason } = request.data as { userId: string; coins: number; reason?: string };
  if (!userId || !coins || coins < 1) throw new HttpsError("invalid-argument", "userId and coins required");

  const walletRef = db.doc(`wallets/${userId}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(walletRef);
    const current = snap.data()?.coins ?? 0;
    tx.set(walletRef, { coins: current + coins, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const txRef = db.collection("transactions").doc();
    tx.set(txRef, {
      userId,
      fromWalletId: "platform/admin",
      toWalletId: `wallets/${userId}`,
      amount: coins,
      currency: "COINS",
      type: "coin_credit",
      status: "completed",
      description: reason ?? "Admin coin credit",
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  await createAuditLog(request.auth.uid, "credit_coins", "user", userId, reason ?? "");
  return { success: true };
});

/** Get my matrimonial profile. */
export const getMyMatrimonialProfile = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const snap = await db.doc(`matrimonialProfiles/${request.auth.uid}`).get();
  if (!snap.exists) return { profile: null };
  return { profile: snap.data() };
});

/**
 * REQ-MAT-011: Register for a matrimonial event using in-app coins.
 * Matrimonial events are regular events with category === "matrimonial".
 */
export const registerMatrimonialEvent = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;

  const { eventId } = request.data as { eventId: string };
  if (!eventId) throw new HttpsError("invalid-argument", "eventId required");

  // Must have an active matrimonial profile
  await requireMatrimonialActive(uid);

  const eventSnap = await db.doc(`events/${eventId}`).get();
  if (!eventSnap.exists) throw new HttpsError("not-found", "Event not found");
  const event = eventSnap.data()!;

  if (event.status !== "approved") throw new HttpsError("failed-precondition", "Event not available");
  if (event.category !== "matrimonial") throw new HttpsError("invalid-argument", "Not a matrimonial event");

  // Check not already registered
  const existing = await db.collection("matrimonialEventRegistrations")
    .where("userId", "==", uid)
    .where("eventId", "==", eventId)
    .limit(1)
    .get();
  if (!existing.empty) throw new HttpsError("already-exists", "Already registered for this event");

  // Deduct coins (configurable via app settings; default 100 coins)
  const settings = await db.doc("settings/app").get();
  const coinCost: number = event.coinCost ?? settings.data()?.matrimonialEventCoinCost ?? 100;

  await deductCoins(uid, coinCost, `Matrimonial event registration: ${event.title ?? eventId}`);

  await db.collection("matrimonialEventRegistrations").add({
    userId: uid,
    eventId,
    coinsPaid: coinCost,
    registeredAt: FieldValue.serverTimestamp(),
  });

  // Auto-join the event chat group if it exists
  const chatGroupSnap = await db.collection("chatGroups").where("eventId", "==", eventId).limit(1).get();
  if (!chatGroupSnap.empty) {
    await chatGroupSnap.docs[0].ref.update({
      memberIds: FieldValue.arrayUnion(uid),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await createNotification(uid, "Registered for Event", `You're registered for "${event.title ?? "matrimonial event"}"!`, "matrimonial_event_reg", { eventId });
  return { success: true, coinsPaid: coinCost };
});

/** Get my matrimonial event registrations. */
export const getMyMatrimonialEventRegistrations = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const snap = await db.collection("matrimonialEventRegistrations")
    .where("userId", "==", request.auth.uid)
    .orderBy("registeredAt", "desc")
    .limit(20)
    .get();
  return { registrations: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
});

/** Get my received interests. */
export const getMyMatrimonialInterests = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;

  const [received, sent] = await Promise.all([
    db.collection("matrimonialInterests").where("toUserId", "==", uid).orderBy("createdAt", "desc").limit(50).get(),
    db.collection("matrimonialInterests").where("fromUserId", "==", uid).orderBy("createdAt", "desc").limit(50).get(),
  ]);

  return {
    received: received.docs.map((d) => ({ id: d.id, ...d.data() })),
    sent: sent.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
});
