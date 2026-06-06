import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/client.js";
import {
  submitVendorApplication,
  moderateVendor,
  setVendorCorporate,
  generateWebhookApiKey,
  approvePointsPoolTopUp,
  getAdminVendorData,
} from "./cloudFunctions.js";

export async function uploadVendorRegistrationPdf(userId, file) {
  const path = `vendors/${userId}/registration/business-registration.pdf`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: "application/pdf" });
  await getDownloadURL(storageRef);
  return path;
}

export async function getVendorRegistrationPdfUrl(path) {
  if (!path) return null;
  return getDownloadURL(ref(storage, path));
}

export async function getVendor(vendorId) {
  const snap = await getDoc(doc(db, "vendors", vendorId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getVendorWallet(vendorId) {
  const snap = await getDoc(doc(db, "vendorWallets", vendorId));
  if (!snap.exists()) return { cashBalance: 0, pointsPool: 0, currency: "LKR" };
  return { vendorId, ...snap.data() };
}

export async function getVendorPrograms(vendorId) {
  const q = query(
    collection(db, "loyaltyPrograms"),
    where("vendorId", "==", vendorId),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getVendorGrants(vendorId, limitCount = 30) {
  const q = query(
    collection(db, "loyaltyGrants"),
    where("vendorId", "==", vendorId),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getVendorTransactions(vendorId, limitCount = 50) {
  const q = query(
    collection(db, "transactions"),
    where("vendorId", "==", vendorId),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getLinkedUsersSummary(vendorId) {
  const grants = await getVendorGrants(vendorId, 200);
  const userMap = new Map();
  grants.forEach((g) => {
    if (!g.userId) return;
    const existing = userMap.get(g.userId) ?? { userId: g.userId, grants: 0, points: 0 };
    existing.grants += 1;
    if (g.status === "confirmed") existing.points += g.pointsCalculated ?? 0;
    userMap.set(g.userId, existing);
  });
  return Array.from(userMap.values());
}

export async function getPendingPoolTopUps(limitCount = 50) {
  const data = await getAdminVendorData();
  return (data.poolTopUpRequests ?? []).slice(0, limitCount);
}

export async function loadAdminVendorPageData() {
  const data = await getAdminVendorData();
  return {
    pending: data.pending ?? [],
    all: data.all ?? [],
    poolTopUpRequests: data.poolTopUpRequests ?? [],
  };
}

export async function getPendingWithdrawals(limitCount = 50) {
  const q = query(
    collection(db, "withdrawalRequests"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getCorporateBindings(vendorId) {
  const q = query(collection(db, "corporateBindings"), where("vendorId", "==", vendorId), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getCorporateWorkTransactions(vendorId, limitCount = 50) {
  const q = query(
    collection(db, "transactions"),
    where("vendorId", "==", vendorId),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((t) => t.metadata?.ledger === "work_balance" || t.type === "corporate_topup");
}

export async function getPendingVendors(limitCount = 50) {
  const data = await getAdminVendorData();
  return (data.pending ?? []).slice(0, limitCount);
}

export async function getAllVendors(limitCount = 100) {
  const data = await getAdminVendorData();
  return (data.all ?? []).slice(0, limitCount);
}

export {
  submitVendorApplication,
  moderateVendor,
  setVendorCorporate,
  generateWebhookApiKey,
  approvePointsPoolTopUp,
};
