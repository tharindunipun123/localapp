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
import { getAdminDashboardStats, getAdminUsersList, adminManageUser } from "./cloudFunctions.js";

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
  try {
    await adminManageUser({ userId, action: "set_role", role });
  } catch {
    await updateDoc(doc(db, "users", userId), {
      role,
      updatedAt: serverTimestamp(),
    });
  }
}

export async function disableUser(userId, disabled) {
  try {
    await adminManageUser({ userId, action: disabled ? "disable" : "enable" });
  } catch {
    await updateDoc(doc(db, "users", userId), {
      disabled,
      ...(disabled ? { forceLogoutAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function forceLogoutUser(userId) {
  try {
    await adminManageUser({ userId, action: "force_logout" });
  } catch {
    await updateDoc(doc(db, "users", userId), {
      forceLogoutAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
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

async function loadDashboardFromFirestore() {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const [pending, approved, users, reported, kyc, vendors, withdrawals, lotteries, txSnap] =
    await Promise.all([
      getDocs(query(collection(db, "events"), where("status", "==", "pending"), limit(200))),
      getDocs(query(collection(db, "events"), where("status", "==", "approved"), limit(500))),
      getDocs(query(collection(db, "users"), limit(500))),
      getDocs(query(collection(db, "reviews"), where("status", "==", "reported"), limit(200))),
      getDocs(query(collection(db, "kycSubmissions"), where("status", "==", "pending"), limit(200))),
      getDocs(query(collection(db, "vendors"), where("status", "==", "pending"), limit(200))),
      getDocs(query(collection(db, "withdrawalRequests"), where("status", "==", "pending"), limit(200))),
      getDocs(query(collection(db, "lotteries"), where("status", "==", "active"), limit(50))),
      getDocs(query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(400))).catch(() => null),
    ]);

  let kycApproved = 0;
  let emailVerified = 0;
  users.forEach((d) => {
    const u = d.data();
    if (u.kycStatus === "approved") kycApproved += 1;
    if (u.emailVerified) emailVerified += 1;
  });

  let deposit7d = 0;
  let spend7d = 0;
  let p2p7d = 0;
  txSnap?.forEach((d) => {
    const t = d.data();
    const created = t.createdAt?.toMillis?.() ?? 0;
    if (created < sevenDaysAgo) return;
    const amount = Number(t.amount ?? 0);
    if (t.type === "deposit") deposit7d += amount;
    if (t.type === "ticket_purchase" || t.type === "spend") spend7d += amount;
    if (t.type === "transfer" || t.type === "p2p_transfer") p2p7d += amount;
  });

  let lotteryTickets = 0;
  let lotteryPool = 0;
  lotteries.forEach((d) => {
    const l = d.data();
    lotteryTickets += Number(l.entryCount ?? 0);
    lotteryPool += Number(l.pointsCost ?? 0) * Number(l.entryCount ?? 0);
  });

  return {
    pendingEvents: pending.size,
    approvedEvents: approved.size,
    totalUsers: users.size,
    reportedReviews: reported.size,
    pendingKyc: kyc.size,
    pendingVendors: vendors.size,
    pendingWithdrawals: withdrawals.size,
    kycApproved,
    emailVerified,
    activeLotteries: lotteries.size,
    lotteryTickets,
    lotteryPool,
    deposit7d,
    spend7d,
    p2p7d,
  };
}

export async function getDashboardStats() {
  try {
    const fromFn = await getAdminDashboardStats();
    if (fromFn && typeof fromFn.pendingKyc === "number") return fromFn;
    const extra = await loadDashboardFromFirestore().catch(() => ({}));
    return { ...extra, ...fromFn };
  } catch (err) {
    console.error("getDashboardStats failed:", err);
    try {
      return await loadDashboardFromFirestore();
    } catch {
      return {
        pendingEvents: 0,
        approvedEvents: 0,
        totalUsers: 0,
        reportedReviews: 0,
        pendingKyc: 0,
        pendingVendors: 0,
        pendingWithdrawals: 0,
      };
    }
  }
}
