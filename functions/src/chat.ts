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
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  db,
  isAdmin,
  createAuditLog,
  FieldValue,
  Timestamp,
} from "./helpers";

const REGION = "us-central1";

// ─── Group creation ───────────────────────────────────────────────────────────

/** REQ-CHT-001: Create an event chat group. Called when chat_enabled event is approved. */
export const createEventChatGroup = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");

  const { eventId } = request.data as { eventId: string };
  if (!eventId) throw new HttpsError("invalid-argument", "eventId required");

  const eventSnap = await db.doc(`events/${eventId}`).get();
  if (!eventSnap.exists) throw new HttpsError("not-found", "Event not found");
  const event = eventSnap.data()!;

  // Only event creator or admin can create the group
  const adminCaller = await isAdmin(request.auth.uid);
  if (!adminCaller && event.createdBy !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Only event creator or admin can create chat group");
  }

  const existing = await db.collection("chatGroups").where("eventId", "==", eventId).limit(1).get();
  if (!existing.empty) return { groupId: existing.docs[0].id, exists: true };

  const archiveAt = event.endDatetime
    ? Timestamp.fromMillis(event.endDatetime.toMillis() + 7 * 86400000)
    : null;

  const ref = await db.collection("chatGroups").add({
    type: "event_group",
    eventId,
    name: event.title ?? "Event Chat",
    createdBy: request.auth.uid,
    memberIds: [event.createdBy],
    isArchived: false,
    isPublic: true,
    archiveAt,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.doc(`events/${eventId}`).update({ chatGroupId: ref.id, updatedAt: FieldValue.serverTimestamp() });
  return { groupId: ref.id, exists: false };
});

/** REQ-CHT-003: Create or get a direct-message channel between two users. */
export const createOrGetDirectMessage = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;
  const { targetUserId } = request.data as { targetUserId: string };
  if (!targetUserId || targetUserId === uid) throw new HttpsError("invalid-argument", "targetUserId required");

  // Canonical DM ID: sorted UIDs to avoid duplicates
  const sorted = [uid, targetUserId].sort();
  const dmId = `dm_${sorted[0]}_${sorted[1]}`;

  const existing = await db.doc(`chatGroups/${dmId}`).get();
  if (existing.exists) return { groupId: dmId, exists: true };

  // Get display names
  const [u1, u2] = await Promise.all([
    db.doc(`users/${sorted[0]}`).get(),
    db.doc(`users/${sorted[1]}`).get(),
  ]);

  await db.doc(`chatGroups/${dmId}`).set({
    type: "direct_message",
    name: `${u1.data()?.displayName ?? "User"} & ${u2.data()?.displayName ?? "User"}`,
    memberIds: [sorted[0], sorted[1]],
    isArchived: false,
    isPublic: false,
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { groupId: dmId, exists: false };
});

/** REQ-CHT-002: Join a public event chat group. */
export const joinEventChatGroup = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;
  const { groupId } = request.data as { groupId: string };
  if (!groupId) throw new HttpsError("invalid-argument", "groupId required");

  const groupSnap = await db.doc(`chatGroups/${groupId}`).get();
  if (!groupSnap.exists) throw new HttpsError("not-found", "Group not found");
  const group = groupSnap.data()!;

  if (!group.isPublic) throw new HttpsError("permission-denied", "Group is not public");
  if (group.isArchived) throw new HttpsError("failed-precondition", "Group is archived");

  const members: string[] = group.memberIds ?? [];
  if (members.includes(uid)) return { success: true, alreadyMember: true };

  await db.doc(`chatGroups/${groupId}`).update({
    memberIds: FieldValue.arrayUnion(uid),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { success: true, alreadyMember: false };
});

/** REQ-CHT-007: Report a chat message. */
export const reportChatMessage = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");

  const { groupId, messageId, reason } = request.data as {
    groupId: string;
    messageId: string;
    reason: string;
  };
  if (!groupId || !messageId || !reason) {
    throw new HttpsError("invalid-argument", "groupId, messageId and reason required");
  }

  const msgRef = db.doc(`chatGroups/${groupId}/messages/${messageId}`);
  const msgSnap = await msgRef.get();
  if (!msgSnap.exists) throw new HttpsError("not-found", "Message not found");

  await msgRef.update({ reported: true, reportReason: reason, reportedBy: request.auth.uid, reportedAt: FieldValue.serverTimestamp() });

  await db.collection("chatMessageReports").add({
    groupId,
    messageId,
    reporterId: request.auth.uid,
    reason,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  });

  return { success: true };
});

/** Admin: review a reported chat message (remove | dismiss). */
export const reviewChatReport = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  if (!(await isAdmin(request.auth.uid))) throw new HttpsError("permission-denied", "Admin only");

  const { reportId, action } = request.data as { reportId: string; action: "remove" | "dismiss" };
  if (!reportId || !["remove", "dismiss"].includes(action)) {
    throw new HttpsError("invalid-argument", "reportId and action required");
  }

  const reportSnap = await db.doc(`chatMessageReports/${reportId}`).get();
  if (!reportSnap.exists) throw new HttpsError("not-found", "Report not found");
  const report = reportSnap.data()!;

  if (action === "remove") {
    const msgRef = db.doc(`chatGroups/${report.groupId}/messages/${report.messageId}`);
    await msgRef.update({ content: "[Message removed by admin]", type: "system", removedAt: FieldValue.serverTimestamp() });
  }

  await db.doc(`chatMessageReports/${reportId}`).update({
    status: action === "remove" ? "removed" : "dismissed",
    reviewedBy: request.auth.uid,
    reviewedAt: FieldValue.serverTimestamp(),
  });

  await createAuditLog(request.auth.uid, action, "chat_message", report.messageId, report.groupId);
  return { success: true };
});

/** Get my chat groups. */
export const getMyChatGroups = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;

  const snap = await db
    .collection("chatGroups")
    .where("memberIds", "array-contains", uid)
    .orderBy("updatedAt", "desc")
    .limit(50)
    .get();

  return { groups: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
});

// ─── Scheduled: archive event chats ──────────────────────────────────────────

/** REQ-CHT-006: Archive event chat groups 7 days after event end. */
export const archiveExpiredEventChats = onSchedule(
  { schedule: "every 24 hours", region: REGION },
  async () => {
    const now = Timestamp.now();
    const snap = await db
      .collection("chatGroups")
      .where("type", "==", "event_group")
      .where("isArchived", "==", false)
      .where("archiveAt", "<", now)
      .limit(100)
      .get();

    if (snap.empty) return;

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.update(doc.ref, {
        isArchived: true,
        archivedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      // Post a system message
      const msgRef = doc.ref.collection("messages").doc();
      batch.set(msgRef, {
        senderId: "system",
        content: "This event chat has been archived and is now read-only.",
        type: "system",
        createdAt: FieldValue.serverTimestamp(),
        readBy: [],
      });
    }

    await batch.commit();
    console.log(`Archived ${snap.size} event chat groups`);
  }
);
