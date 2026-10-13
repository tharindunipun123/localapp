"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyMatrimonialInterests = exports.getMyMatrimonialEventRegistrations = exports.registerMatrimonialEvent = exports.getMyMatrimonialProfile = exports.adminCreditCoins = exports.respondToMatrimonialInterest = exports.sendMatrimonialInterest = exports.unlockMatrimonialProfile = exports.searchMatrimonialProfiles = exports.moderateMatrimonialPhoto = exports.submitMatrimonialPhoto = exports.setMatrimonialProfileActive = exports.createOrUpdateMatrimonialProfile = void 0;
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
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
const REGION = "us-central1";
// ─── Helpers ──────────────────────────────────────────────────────────────────
async function requireMatrimonialActive(uid) {
    var _a;
    const snap = await helpers_1.db.doc(`matrimonialProfiles/${uid}`).get();
    if (!snap.exists || !((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.isActive)) {
        throw new https_1.HttpsError("not-found", "No active matrimonial profile");
    }
    return snap.data();
}
async function getCoins(uid) {
    var _a, _b;
    const snap = await helpers_1.db.doc(`wallets/${uid}`).get();
    return (_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.coins) !== null && _b !== void 0 ? _b : 0;
}
async function deductCoins(uid, amount, description) {
    const walletRef = helpers_1.db.doc(`wallets/${uid}`);
    await helpers_1.db.runTransaction(async (tx) => {
        var _a, _b;
        const snap = await tx.get(walletRef);
        const coins = (_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.coins) !== null && _b !== void 0 ? _b : 0;
        if (coins < amount)
            throw new https_1.HttpsError("failed-precondition", "Insufficient coins");
        tx.set(walletRef, { coins: coins - amount, updatedAt: helpers_1.FieldValue.serverTimestamp() }, { merge: true });
        const txRef = helpers_1.db.collection("transactions").doc();
        tx.set(txRef, {
            userId: uid,
            fromWalletId: `wallets/${uid}`,
            toWalletId: "platform/matrimonial",
            amount,
            currency: "COINS",
            type: "matrimonial_spend",
            status: "completed",
            description,
            createdAt: helpers_1.FieldValue.serverTimestamp(),
        });
    });
}
// ─── Profile CRUD ─────────────────────────────────────────────────────────────
/** REQ-MAT-001, REQ-MAT-002: Create or update matrimonial profile. */
exports.createOrUpdateMatrimonialProfile = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const { gender, dateOfBirth, religion, ethnicity, caste, heightCm, education, occupation, incomeRange, district, city, aboutMe, hobbies, familyDetails, expectations, privacyShowFullName, privacyShowPhotosTo, } = request.data;
    if (!gender || !dateOfBirth || !religion || !ethnicity || !heightCm || !education || !district) {
        throw new https_1.HttpsError("invalid-argument", "Required fields missing");
    }
    if (aboutMe && aboutMe.length > 500) {
        throw new https_1.HttpsError("invalid-argument", "About me cannot exceed 500 characters");
    }
    // Get display name from user profile
    const userSnap = await helpers_1.db.doc(`users/${uid}`).get();
    const displayName = (_b = (_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.displayName) !== null && _b !== void 0 ? _b : "";
    const existing = (await helpers_1.db.doc(`matrimonialProfiles/${uid}`).get()).exists;
    await helpers_1.db.doc(`matrimonialProfiles/${uid}`).set({
        uid,
        gender,
        dateOfBirth: helpers_1.Timestamp.fromMillis(dateOfBirth),
        religion,
        ethnicity,
        caste: caste !== null && caste !== void 0 ? caste : "",
        heightCm,
        education,
        occupation,
        incomeRange,
        district,
        city,
        aboutMe: aboutMe !== null && aboutMe !== void 0 ? aboutMe : "",
        hobbies: hobbies !== null && hobbies !== void 0 ? hobbies : [],
        familyDetails: familyDetails !== null && familyDetails !== void 0 ? familyDetails : "",
        expectations: expectations !== null && expectations !== void 0 ? expectations : "",
        privacyShowFullName: privacyShowFullName !== false,
        privacyShowPhotosTo: privacyShowPhotosTo !== null && privacyShowPhotosTo !== void 0 ? privacyShowPhotosTo : "all",
        photos: existing ? helpers_1.FieldValue.delete() : [],
        isActive: true,
        displayName,
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
        ...(existing ? {} : { createdAt: helpers_1.FieldValue.serverTimestamp(), photos: [] }),
    }, { merge: true });
    return { success: true, created: !existing };
});
/** REQ-MAT-010: hide or reactivate the matrimonial profile. */
exports.setMatrimonialProfileActive = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const { isActive } = request.data;
    if (typeof isActive !== "boolean")
        throw new https_1.HttpsError("invalid-argument", "isActive required");
    const ref = helpers_1.db.doc(`matrimonialProfiles/${uid}`);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError("not-found", "Profile not found");
    await ref.update({ isActive, updatedAt: helpers_1.FieldValue.serverTimestamp() });
    return { success: true, isActive };
});
/** REQ-MAT-002: Submit photo to admin moderation queue. */
exports.submitMatrimonialPhoto = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const profile = await helpers_1.db.doc(`matrimonialProfiles/${uid}`).get();
    if (!profile.exists)
        throw new https_1.HttpsError("not-found", "Create a profile first");
    const currentPhotos = (_b = (_a = profile.data()) === null || _a === void 0 ? void 0 : _a.photos) !== null && _b !== void 0 ? _b : [];
    const pendingSnap = await helpers_1.db
        .collection("matrimonialPhotoQueue")
        .where("uid", "==", uid)
        .where("status", "==", "pending")
        .get();
    if (currentPhotos.length + pendingSnap.size >= 6) {
        throw new https_1.HttpsError("failed-precondition", "Maximum 6 photos allowed (including pending)");
    }
    const { storagePath, downloadUrl } = request.data;
    if (!storagePath || !downloadUrl)
        throw new https_1.HttpsError("invalid-argument", "storagePath and downloadUrl required");
    const ref = await helpers_1.db.collection("matrimonialPhotoQueue").add({
        uid,
        storagePath,
        downloadUrl,
        status: "pending",
        submittedAt: helpers_1.FieldValue.serverTimestamp(),
    });
    return { queueId: ref.id };
});
/** REQ-MAT-003: Admin moderates a queued photo. */
exports.moderateMatrimonialPhoto = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isAdmin)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Admin only");
    const { queueId, action } = request.data;
    if (!queueId || !["approve", "reject"].includes(action)) {
        throw new https_1.HttpsError("invalid-argument", "queueId and action (approve|reject) required");
    }
    const queueRef = helpers_1.db.doc(`matrimonialPhotoQueue/${queueId}`);
    const snap = await queueRef.get();
    if (!snap.exists)
        throw new https_1.HttpsError("not-found", "Queue item not found");
    const item = snap.data();
    if (item.status !== "pending")
        throw new https_1.HttpsError("failed-precondition", "Already processed");
    await queueRef.update({ status: action === "approve" ? "approved" : "rejected", reviewedAt: helpers_1.FieldValue.serverTimestamp(), reviewedBy: request.auth.uid });
    if (action === "approve") {
        const profileRef = helpers_1.db.doc(`matrimonialProfiles/${item.uid}`);
        const profileSnap = await profileRef.get();
        const existing = (_b = (_a = profileSnap.data()) === null || _a === void 0 ? void 0 : _a.photos) !== null && _b !== void 0 ? _b : [];
        if (existing.length < 6) {
            await profileRef.update({ photos: [...existing, item.downloadUrl], updatedAt: helpers_1.FieldValue.serverTimestamp() });
        }
        await (0, helpers_1.createNotification)(item.uid, "Photo Approved", "Your matrimonial profile photo has been approved.", "mat_photo_approved");
    }
    else {
        await (0, helpers_1.createNotification)(item.uid, "Photo Rejected", "One of your matrimonial photos was not approved. Please upload a different photo.", "mat_photo_rejected");
    }
    await (0, helpers_1.createAuditLog)(request.auth.uid, action, "matrimonial_photo", queueId);
    return { success: true };
});
/** REQ-MAT-005, REQ-MAT-006, REQ-MAT-007: Search profiles. Page 1 free; page 2+ costs coins. */
exports.searchMatrimonialProfiles = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const { gender, minAge, maxAge, religion, district, ethnicity, minHeight, maxHeight, education, page = 1, } = request.data;
    const PAGE_SIZE = 20;
    // Pages beyond 1 cost coins (REQ-MAT-007)
    if (page > 1) {
        const settings = await helpers_1.db.doc("settings/app").get();
        const searchPageCost = (_b = (_a = settings.data()) === null || _a === void 0 ? void 0 : _a.matrimonialSearchPageCost) !== null && _b !== void 0 ? _b : 50;
        const coins = await getCoins(uid);
        if (coins < searchPageCost) {
            throw new https_1.HttpsError("resource-exhausted", "Insufficient coins for additional search pages", { coinsRequired: searchPageCost, coinsHeld: coins });
        }
        await deductCoins(uid, searchPageCost, `Matrimonial search page ${page}`);
    }
    // Build Firestore query with exact-match filters
    let q = helpers_1.db.collection("matrimonialProfiles").where("isActive", "==", true).where("uid", "!=", uid);
    if (gender)
        q = q.where("gender", "==", gender);
    if (religion)
        q = q.where("religion", "==", religion);
    if (district)
        q = q.where("district", "==", district);
    if (ethnicity)
        q = q.where("ethnicity", "==", ethnicity);
    // Age range via dateOfBirth
    if (minAge || maxAge) {
        const now = new Date();
        if (maxAge) {
            const minDob = helpers_1.Timestamp.fromMillis(new Date(now.getFullYear() - maxAge, now.getMonth(), now.getDate()).getTime());
            q = q.where("dateOfBirth", ">=", minDob);
        }
        if (minAge) {
            const maxDob = helpers_1.Timestamp.fromMillis(new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate()).getTime());
            q = q.where("dateOfBirth", "<=", maxDob);
        }
    }
    const snap = await q.limit(PAGE_SIZE * 3).get(); // fetch more so we can filter in memory
    let results = snap.docs.map((d) => d.data());
    // In-memory filters (Firestore only supports one range inequality per query)
    if (minHeight)
        results = results.filter((p) => { var _a; return ((_a = p.heightCm) !== null && _a !== void 0 ? _a : 0) >= minHeight; });
    if (maxHeight)
        results = results.filter((p) => { var _a; return ((_a = p.heightCm) !== null && _a !== void 0 ? _a : 0) <= maxHeight; });
    if (education)
        results = results.filter((p) => p.education === education);
    const total = results.length;
    const pageResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    // Apply privacy settings before returning
    const sanitized = pageResults.map((p) => sanitizeProfile(p, uid, false));
    return { profiles: sanitized, total, page, pageSize: PAGE_SIZE, hasMore: total > page * PAGE_SIZE };
});
function sanitizeProfile(p, viewerUid, isFullView) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const showFullName = p.privacyShowFullName !== false;
    const displayName = showFullName
        ? p.displayName
        : ((_b = (_a = p.displayName) === null || _a === void 0 ? void 0 : _a.split(" ")[0]) !== null && _b !== void 0 ? _b : "—");
    const dob = (_e = (_d = (_c = p.dateOfBirth) === null || _c === void 0 ? void 0 : _c.toMillis) === null || _d === void 0 ? void 0 : _d.call(_c)) !== null && _e !== void 0 ? _e : null;
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
    if (!isFullView)
        return { ...base, primaryPhoto: (_g = (_f = p.photos) === null || _f === void 0 ? void 0 : _f[0]) !== null && _g !== void 0 ? _g : null };
    const showPhotos = p.privacyShowPhotosTo;
    const photos = showPhotos === "none" ? [] : (_h = p.photos) !== null && _h !== void 0 ? _h : [];
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
exports.unlockMatrimonialProfile = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const { profileId } = request.data;
    if (!profileId)
        throw new https_1.HttpsError("invalid-argument", "profileId required");
    if (profileId === uid)
        throw new https_1.HttpsError("invalid-argument", "Cannot view own profile via unlock");
    const profile = await helpers_1.db.doc(`matrimonialProfiles/${profileId}`).get();
    if (!profile.exists || !((_a = profile.data()) === null || _a === void 0 ? void 0 : _a.isActive))
        throw new https_1.HttpsError("not-found", "Profile not found");
    const viewRef = helpers_1.db.doc(`matrimonialProfileViews/${uid}_${profileId}`);
    const viewSnap = await viewRef.get();
    // REQ-MAT-008: No re-charge within 7 days
    const sevenDaysMs = 7 * 86400000;
    if (viewSnap.exists) {
        const viewedAt = (_e = (_d = (_c = (_b = viewSnap.data()) === null || _b === void 0 ? void 0 : _b.viewedAt) === null || _c === void 0 ? void 0 : _c.toMillis) === null || _d === void 0 ? void 0 : _d.call(_c)) !== null && _e !== void 0 ? _e : 0;
        if (Date.now() - viewedAt < sevenDaysMs) {
            // Already unlocked — return full profile for free
            return { profile: sanitizeProfile(profile.data(), uid, true), coinsCharged: 0 };
        }
    }
    // Deduct coins
    const settings = await helpers_1.db.doc("settings/app").get();
    const unlockCost = (_g = (_f = settings.data()) === null || _f === void 0 ? void 0 : _f.matrimonialUnlockCost) !== null && _g !== void 0 ? _g : 50;
    await deductCoins(uid, unlockCost, `View matrimonial profile ${profileId}`);
    // Record view
    await viewRef.set({
        viewerId: uid,
        profileId,
        viewedAt: helpers_1.FieldValue.serverTimestamp(),
        coinsCharged: unlockCost,
    });
    return { profile: sanitizeProfile(profile.data(), uid, true), coinsCharged: unlockCost };
});
/** REQ-MAT-007: Send expression of interest (costs coins). */
exports.sendMatrimonialInterest = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b, _c;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const { profileId, message } = request.data;
    if (!profileId)
        throw new https_1.HttpsError("invalid-argument", "profileId required");
    await requireMatrimonialActive(uid);
    const target = await helpers_1.db.doc(`matrimonialProfiles/${profileId}`).get();
    if (!target.exists || !((_a = target.data()) === null || _a === void 0 ? void 0 : _a.isActive))
        throw new https_1.HttpsError("not-found", "Profile not found");
    const existingSnap = await helpers_1.db.doc(`matrimonialInterests/${uid}_${profileId}`).get();
    if (existingSnap.exists)
        throw new https_1.HttpsError("already-exists", "Interest already sent");
    const settings = await helpers_1.db.doc("settings/app").get();
    const interestCost = (_c = (_b = settings.data()) === null || _b === void 0 ? void 0 : _b.matrimonialInterestCost) !== null && _c !== void 0 ? _c : 50;
    await deductCoins(uid, interestCost, `Expression of interest to ${profileId}`);
    await helpers_1.db.doc(`matrimonialInterests/${uid}_${profileId}`).set({
        fromUserId: uid,
        toUserId: profileId,
        message: message !== null && message !== void 0 ? message : "",
        status: "sent",
        createdAt: helpers_1.FieldValue.serverTimestamp(),
    });
    await (0, helpers_1.createNotification)(profileId, "New Interest", "Someone has sent you an expression of interest on Matrimonial.", "mat_interest", { fromUserId: uid });
    return { success: true, coinsCharged: interestCost };
});
/** Respond to a matrimonial interest (accept | reject). */
exports.respondToMatrimonialInterest = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const { fromUserId, action } = request.data;
    if (!fromUserId || !["accept", "reject"].includes(action)) {
        throw new https_1.HttpsError("invalid-argument", "fromUserId and action required");
    }
    const interestRef = helpers_1.db.doc(`matrimonialInterests/${fromUserId}_${uid}`);
    const snap = await interestRef.get();
    if (!snap.exists)
        throw new https_1.HttpsError("not-found", "Interest not found");
    if (((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.status) !== "sent")
        throw new https_1.HttpsError("failed-precondition", "Already responded");
    await interestRef.update({ status: action === "accept" ? "accepted" : "rejected", respondedAt: helpers_1.FieldValue.serverTimestamp() });
    if (action === "accept") {
        await (0, helpers_1.createNotification)(fromUserId, "Interest Accepted", "Your expression of interest has been accepted!", "mat_interest_accepted", { toUserId: uid });
    }
    else {
        await (0, helpers_1.createNotification)(fromUserId, "Interest Not Accepted", "Your expression of interest was not accepted.", "mat_interest_rejected");
    }
    return { success: true };
});
/** Admin: credit coins to a user. */
exports.adminCreditCoins = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isAdmin)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Admin only");
    const { userId, coins, reason } = request.data;
    if (!userId || !coins || coins < 1)
        throw new https_1.HttpsError("invalid-argument", "userId and coins required");
    const walletRef = helpers_1.db.doc(`wallets/${userId}`);
    await helpers_1.db.runTransaction(async (tx) => {
        var _a, _b;
        const snap = await tx.get(walletRef);
        const current = (_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.coins) !== null && _b !== void 0 ? _b : 0;
        tx.set(walletRef, { coins: current + coins, updatedAt: helpers_1.FieldValue.serverTimestamp() }, { merge: true });
        const txRef = helpers_1.db.collection("transactions").doc();
        tx.set(txRef, {
            userId,
            fromWalletId: "platform/admin",
            toWalletId: `wallets/${userId}`,
            amount: coins,
            currency: "COINS",
            type: "coin_credit",
            status: "completed",
            description: reason !== null && reason !== void 0 ? reason : "Admin coin credit",
            createdAt: helpers_1.FieldValue.serverTimestamp(),
        });
    });
    await (0, helpers_1.createAuditLog)(request.auth.uid, "credit_coins", "user", userId, reason !== null && reason !== void 0 ? reason : "");
    return { success: true };
});
/** Get my matrimonial profile. */
exports.getMyMatrimonialProfile = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const snap = await helpers_1.db.doc(`matrimonialProfiles/${request.auth.uid}`).get();
    if (!snap.exists)
        return { profile: null };
    return { profile: snap.data() };
});
/**
 * REQ-MAT-011: Register for a matrimonial event using in-app coins.
 * Matrimonial events are regular events with category === "matrimonial".
 */
exports.registerMatrimonialEvent = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b, _c, _d, _e;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const { eventId } = request.data;
    if (!eventId)
        throw new https_1.HttpsError("invalid-argument", "eventId required");
    // Must have an active matrimonial profile
    await requireMatrimonialActive(uid);
    const eventSnap = await helpers_1.db.doc(`events/${eventId}`).get();
    if (!eventSnap.exists)
        throw new https_1.HttpsError("not-found", "Event not found");
    const event = eventSnap.data();
    if (event.status !== "approved")
        throw new https_1.HttpsError("failed-precondition", "Event not available");
    if (event.category !== "matrimonial")
        throw new https_1.HttpsError("invalid-argument", "Not a matrimonial event");
    // Check not already registered
    const existing = await helpers_1.db.collection("matrimonialEventRegistrations")
        .where("userId", "==", uid)
        .where("eventId", "==", eventId)
        .limit(1)
        .get();
    if (!existing.empty)
        throw new https_1.HttpsError("already-exists", "Already registered for this event");
    // Deduct coins (configurable via app settings; default 100 coins)
    const settings = await helpers_1.db.doc("settings/app").get();
    const coinCost = (_c = (_a = event.coinCost) !== null && _a !== void 0 ? _a : (_b = settings.data()) === null || _b === void 0 ? void 0 : _b.matrimonialEventCoinCost) !== null && _c !== void 0 ? _c : 100;
    await deductCoins(uid, coinCost, `Matrimonial event registration: ${(_d = event.title) !== null && _d !== void 0 ? _d : eventId}`);
    await helpers_1.db.collection("matrimonialEventRegistrations").add({
        userId: uid,
        eventId,
        coinsPaid: coinCost,
        registeredAt: helpers_1.FieldValue.serverTimestamp(),
    });
    // Auto-join the event chat group if it exists
    const chatGroupSnap = await helpers_1.db.collection("chatGroups").where("eventId", "==", eventId).limit(1).get();
    if (!chatGroupSnap.empty) {
        await chatGroupSnap.docs[0].ref.update({
            memberIds: helpers_1.FieldValue.arrayUnion(uid),
            updatedAt: helpers_1.FieldValue.serverTimestamp(),
        });
    }
    await (0, helpers_1.createNotification)(uid, "Registered for Event", `You're registered for "${(_e = event.title) !== null && _e !== void 0 ? _e : "matrimonial event"}"!`, "matrimonial_event_reg", { eventId });
    return { success: true, coinsPaid: coinCost };
});
/** Get my matrimonial event registrations. */
exports.getMyMatrimonialEventRegistrations = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const snap = await helpers_1.db.collection("matrimonialEventRegistrations")
        .where("userId", "==", request.auth.uid)
        .orderBy("registeredAt", "desc")
        .limit(20)
        .get();
    return { registrations: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
});
/** Get my received interests. */
exports.getMyMatrimonialInterests = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const [received, sent] = await Promise.all([
        helpers_1.db.collection("matrimonialInterests").where("toUserId", "==", uid).orderBy("createdAt", "desc").limit(50).get(),
        helpers_1.db.collection("matrimonialInterests").where("fromUserId", "==", uid).orderBy("createdAt", "desc").limit(50).get(),
    ]);
    return {
        received: received.docs.map((d) => ({ id: d.id, ...d.data() })),
        sent: sent.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
});
//# sourceMappingURL=matrimonial.js.map