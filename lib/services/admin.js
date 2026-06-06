import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/client.js";
import { defaults } from "@/lib/config";
import { getAdminDashboardStats, getAdminUsersList } from "./cloudFunctions.js";

function mapUser(id, data) {
  return { uid: id, ...data };
}

export async function getAllUsers() {
  try {
    return await getAdminUsersList();
  } catch (err) {
    console.error("getAllUsers failed:", err);
    return [];
  }
}

export async function updateUserRole(userId, role) {
  await updateDoc(doc(db, "users", userId), {
    role,
    updatedAt: serverTimestamp(),
  });
}

export async function getAppSettings() {
  const snap = await getDoc(doc(db, "settings", "app"));
  if (!snap.exists()) {
    return {
      featuredEventLimit: defaults.featuredEventLimit,
      nearbyRadiusKm: defaults.nearbyRadiusKm,
    };
  }
  return snap.data();
}

export async function updateAppSettings(settings) {
  await updateDoc(doc(db, "settings", "app"), {
    ...settings,
    updatedAt: serverTimestamp(),
  });
}

export async function getWalletForUser(userId) {
  const snap = await getDoc(doc(db, "wallets", userId));
  if (!snap.exists()) return null;
  return { userId, ...snap.data() };
}

export async function getAuditLogs(limitCount = 50) {
  const q = query(
    collection(db, "auditLogs"),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getDashboardStats() {
  try {
    return await getAdminDashboardStats();
  } catch (err) {
    console.error("getDashboardStats failed:", err);
    return {
      pendingEvents: 0,
      approvedEvents: 0,
      totalUsers: 0,
      reportedReviews: 0,
    };
  }
}
