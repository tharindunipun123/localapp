import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "../firebase/client.js";
import { defaults } from "@/lib/config";

function mapMember(data) {
  return data;
}

function mapMessage(id, data) {
  return { id, ...data };
}

export async function getEventGroup(eventId) {
  const snap = await getDoc(doc(db, "eventGroups", eventId));
  if (!snap.exists()) return null;
  return snap.data();
}

/** Create group doc if missing (createdBy must be the event owner uid) */
export async function ensureEventGroup(eventId, eventOwnerId, joinPolicy = "open") {
  const groupRef = doc(db, "eventGroups", eventId);
  const snap = await getDoc(groupRef);
  if (snap.exists()) return snap.data();

  await setDoc(groupRef, {
    eventId,
    createdBy: eventOwnerId,
    joinPolicy,
    memberCount: 0,
    createdAt: serverTimestamp(),
  });
  return getEventGroup(eventId);
}

export async function createEventGroup(eventId, createdBy, joinPolicy = "open") {
  await ensureEventGroup(eventId, createdBy, joinPolicy);
  const memberRef = doc(db, "eventGroups", eventId, "members", createdBy);
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists()) {
    await setDoc(memberRef, {
      userId: createdBy,
      role: "owner",
      status: "active",
      joinedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "eventGroups", eventId), {
      memberCount: increment(1),
    });
  }
}

export async function getMemberStatus(eventId, userId) {
  const snap = await getDoc(doc(db, "eventGroups", eventId, "members", userId));
  if (!snap.exists()) return null;
  return mapMember(snap.data());
}

export async function joinEventGroup(eventId, userId, joinPolicy, eventOwnerId) {
  await ensureEventGroup(eventId, eventOwnerId, joinPolicy ?? "open");

  const memberRef = doc(db, "eventGroups", eventId, "members", userId);
  const existing = await getDoc(memberRef);
  if (existing.exists()) {
    return existing.data().status;
  }

  const status = joinPolicy === "open" ? "active" : "pending";
  await setDoc(memberRef, {
    userId,
    role: "member",
    status,
    joinedAt: serverTimestamp(),
  });

  if (status === "active") {
    await updateDoc(doc(db, "eventGroups", eventId), {
      memberCount: increment(1),
    });
  }
  return status;
}

export async function approveMember(eventId, userId) {
  await updateDoc(doc(db, "eventGroups", eventId, "members", userId), {
    status: "active",
  });
  await updateDoc(doc(db, "eventGroups", eventId), {
    memberCount: increment(1),
  });
}

export async function sendMessage(eventId, senderId, senderName, text, imageUrl, senderPhotoURL) {
  const payload = {
    senderId,
    senderName,
    text: text.slice(0, 2000),
    createdAt: serverTimestamp(),
  };
  if (imageUrl) payload.imageUrl = imageUrl;
  if (senderPhotoURL) payload.senderPhotoURL = senderPhotoURL;

  const ref = await addDoc(collection(db, "eventGroups", eventId, "messages"), payload);
  return ref.id;
}

export async function deleteMessage(eventId, messageId, userId, isModerator) {
  const msgRef = doc(db, "eventGroups", eventId, "messages", messageId);
  const snap = await getDoc(msgRef);
  if (!snap.exists()) return;
  const msg = snap.data();
  if (msg.senderId !== userId && !isModerator) {
    throw new Error("Unauthorized");
  }
  await updateDoc(msgRef, { deletedAt: serverTimestamp(), text: "[deleted]" });
}

export function subscribeToMessages(eventId, callback) {
  const q = query(
    collection(db, "eventGroups", eventId, "messages"),
    orderBy("createdAt", "desc"),
    limit(defaults.chatMessagesPageSize)
  );
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map((d) => mapMessage(d.id, d.data())).reverse();
    callback(messages);
  });
}

export async function getGroupMembers(eventId) {
  const snap = await getDocs(collection(db, "eventGroups", eventId, "members"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function inviteMember(eventId, userId) {
  await setDoc(doc(db, "eventGroups", eventId, "members", userId), {
    userId,
    role: "member",
    status: "invited",
    joinedAt: serverTimestamp(),
  });
}

export async function acceptInvite(eventId, userId) {
  await updateDoc(doc(db, "eventGroups", eventId, "members", userId), {
    status: "active",
  });
  await updateDoc(doc(db, "eventGroups", eventId), {
    memberCount: increment(1),
  });
}
