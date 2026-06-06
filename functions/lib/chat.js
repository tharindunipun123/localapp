"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.archiveExpiredEventChats = exports.getMyChatGroups = exports.reviewChatReport = exports.reportChatMessage = exports.joinEventChatGroup = exports.createOrGetDirectMessage = exports.createEventChatGroup = void 0;
/**
 * Chat & Group Module — REQ-CHT-001 through REQ-CHT-008
 *
 * Collections:
 *   chatGroups/{groupId}               — group metadata
 *   chatGroups/{groupId}/messages/{id} — messages (real-time via client onSnapshot)
 *
 * Clients write messages directly via Firestore rules (fast path).
 * Cloud Functions handle group creation, archiving, reporting.
 */
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const helpers_1 = require("./helpers");
const REGION = "us-central1";
// ─── Group creation ───────────────────────────────────────────────────────────
/** REQ-CHT-001: Create an event chat group. Called when chat_enabled event is approved. */
exports.createEventChatGroup = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const { eventId } = request.data;
    if (!eventId)
        throw new https_1.HttpsError("invalid-argument", "eventId required");
    const eventSnap = await helpers_1.db.doc(`events/${eventId}`).get();
    if (!eventSnap.exists)
        throw new https_1.HttpsError("not-found", "Event not found");
    const event = eventSnap.data();
    // Only event creator or admin can create the group
    const adminCaller = await (0, helpers_1.isAdmin)(request.auth.uid);
    if (!adminCaller && event.createdBy !== request.auth.uid) {
        throw new https_1.HttpsError("permission-denied", "Only event creator or admin can create chat group");
    }
    const existing = await helpers_1.db.collection("chatGroups").where("eventId", "==", eventId).limit(1).get();
    if (!existing.empty)
        return { groupId: existing.docs[0].id, exists: true };
    const archiveAt = event.endDatetime
        ? helpers_1.Timestamp.fromMillis(event.endDatetime.toMillis() + 7 * 86400000)
        : null;
    const ref = await helpers_1.db.collection("chatGroups").add({
        type: "event_group",
        eventId,
        name: (_a = event.title) !== null && _a !== void 0 ? _a : "Event Chat",
        createdBy: request.auth.uid,
        memberIds: [event.createdBy],
        isArchived: false,
        isPublic: true,
        archiveAt,
        createdAt: helpers_1.FieldValue.serverTimestamp(),
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    });
    await helpers_1.db.doc(`events/${eventId}`).update({ chatGroupId: ref.id, updatedAt: helpers_1.FieldValue.serverTimestamp() });
    return { groupId: ref.id, exists: false };
});
/** REQ-CHT-003: Create or get a direct-message channel between two users. */
exports.createOrGetDirectMessage = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b, _c, _d;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const { targetUserId } = request.data;
    if (!targetUserId || targetUserId === uid)
        throw new https_1.HttpsError("invalid-argument", "targetUserId required");
    // Canonical DM ID: sorted UIDs to avoid duplicates
    const sorted = [uid, targetUserId].sort();
    const dmId = `dm_${sorted[0]}_${sorted[1]}`;
    const existing = await helpers_1.db.doc(`chatGroups/${dmId}`).get();
    if (existing.exists)
        return { groupId: dmId, exists: true };
    // Get display names
    const [u1, u2] = await Promise.all([
        helpers_1.db.doc(`users/${sorted[0]}`).get(),
        helpers_1.db.doc(`users/${sorted[1]}`).get(),
    ]);
    await helpers_1.db.doc(`chatGroups/${dmId}`).set({
        type: "direct_message",
        name: `${(_b = (_a = u1.data()) === null || _a === void 0 ? void 0 : _a.displayName) !== null && _b !== void 0 ? _b : "User"} & ${(_d = (_c = u2.data()) === null || _c === void 0 ? void 0 : _c.displayName) !== null && _d !== void 0 ? _d : "User"}`,
        memberIds: [sorted[0], sorted[1]],
        isArchived: false,
        isPublic: false,
        createdBy: uid,
        createdAt: helpers_1.FieldValue.serverTimestamp(),
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    });
    return { groupId: dmId, exists: false };
});
/** REQ-CHT-002: Join a public event chat group. */
exports.joinEventChatGroup = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const { groupId } = request.data;
    if (!groupId)
        throw new https_1.HttpsError("invalid-argument", "groupId required");
    const groupSnap = await helpers_1.db.doc(`chatGroups/${groupId}`).get();
    if (!groupSnap.exists)
        throw new https_1.HttpsError("not-found", "Group not found");
    const group = groupSnap.data();
    if (!group.isPublic)
        throw new https_1.HttpsError("permission-denied", "Group is not public");
    if (group.isArchived)
        throw new https_1.HttpsError("failed-precondition", "Group is archived");
    const members = (_a = group.memberIds) !== null && _a !== void 0 ? _a : [];
    if (members.includes(uid))
        return { success: true, alreadyMember: true };
    await helpers_1.db.doc(`chatGroups/${groupId}`).update({
        memberIds: helpers_1.FieldValue.arrayUnion(uid),
        updatedAt: helpers_1.FieldValue.serverTimestamp(),
    });
    return { success: true, alreadyMember: false };
});
/** REQ-CHT-007: Report a chat message. */
exports.reportChatMessage = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const { groupId, messageId, reason } = request.data;
    if (!groupId || !messageId || !reason) {
        throw new https_1.HttpsError("invalid-argument", "groupId, messageId and reason required");
    }
    const msgRef = helpers_1.db.doc(`chatGroups/${groupId}/messages/${messageId}`);
    const msgSnap = await msgRef.get();
    if (!msgSnap.exists)
        throw new https_1.HttpsError("not-found", "Message not found");
    await msgRef.update({ reported: true, reportReason: reason, reportedBy: request.auth.uid, reportedAt: helpers_1.FieldValue.serverTimestamp() });
    await helpers_1.db.collection("chatMessageReports").add({
        groupId,
        messageId,
        reporterId: request.auth.uid,
        reason,
        status: "pending",
        createdAt: helpers_1.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
/** Admin: review a reported chat message (remove | dismiss). */
exports.reviewChatReport = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    if (!(await (0, helpers_1.isAdmin)(request.auth.uid)))
        throw new https_1.HttpsError("permission-denied", "Admin only");
    const { reportId, action } = request.data;
    if (!reportId || !["remove", "dismiss"].includes(action)) {
        throw new https_1.HttpsError("invalid-argument", "reportId and action required");
    }
    const reportSnap = await helpers_1.db.doc(`chatMessageReports/${reportId}`).get();
    if (!reportSnap.exists)
        throw new https_1.HttpsError("not-found", "Report not found");
    const report = reportSnap.data();
    if (action === "remove") {
        const msgRef = helpers_1.db.doc(`chatGroups/${report.groupId}/messages/${report.messageId}`);
        await msgRef.update({ content: "[Message removed by admin]", type: "system", removedAt: helpers_1.FieldValue.serverTimestamp() });
    }
    await helpers_1.db.doc(`chatMessageReports/${reportId}`).update({
        status: action === "remove" ? "removed" : "dismissed",
        reviewedBy: request.auth.uid,
        reviewedAt: helpers_1.FieldValue.serverTimestamp(),
    });
    await (0, helpers_1.createAuditLog)(request.auth.uid, action, "chat_message", report.messageId, report.groupId);
    return { success: true };
});
/** Get my chat groups. */
exports.getMyChatGroups = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const snap = await helpers_1.db
        .collection("chatGroups")
        .where("memberIds", "array-contains", uid)
        .orderBy("updatedAt", "desc")
        .limit(50)
        .get();
    return { groups: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
});
// ─── Scheduled: archive event chats ──────────────────────────────────────────
/** REQ-CHT-006: Archive event chat groups 7 days after event end. */
exports.archiveExpiredEventChats = (0, scheduler_1.onSchedule)({ schedule: "every 24 hours", region: REGION }, async () => {
    const now = helpers_1.Timestamp.now();
    const snap = await helpers_1.db
        .collection("chatGroups")
        .where("type", "==", "event_group")
        .where("isArchived", "==", false)
        .where("archiveAt", "<", now)
        .limit(100)
        .get();
    if (snap.empty)
        return;
    const batch = helpers_1.db.batch();
    for (const doc of snap.docs) {
        batch.update(doc.ref, {
            isArchived: true,
            archivedAt: helpers_1.FieldValue.serverTimestamp(),
            updatedAt: helpers_1.FieldValue.serverTimestamp(),
        });
        // Post a system message
        const msgRef = doc.ref.collection("messages").doc();
        batch.set(msgRef, {
            senderId: "system",
            content: "This event chat has been archived and is now read-only.",
            type: "system",
            createdAt: helpers_1.FieldValue.serverTimestamp(),
            readBy: [],
        });
    }
    await batch.commit();
    console.log(`Archived ${snap.size} event chat groups`);
});
//# sourceMappingURL=chat.js.map