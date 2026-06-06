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
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase/client.js";

function mapWallet(data) {
  return data;
}

function mapTransaction(id, data) {
  return { id, ...data };
}

function mapTicket(id, data) {
  return { id, ...data };
}

export async function getWallet(userId) {
  const snap = await getDoc(doc(db, "wallets", userId));
  if (!snap.exists()) {
    return {
      userId,
      cashBalance: 0,
      balance: 0,
      loyaltyPoints: 0,
      bonusPoints: 0,
      workBalance: 0,
      currency: "LKR",
    };
  }
  const data = snap.data();
  const cash = data.cashBalance ?? data.balance ?? 0;
  return {
    ...data,
    userId,
    cashBalance: cash,
    balance: cash,
    loyaltyPoints: data.loyaltyPoints ?? 0,
    bonusPoints: data.bonusPoints ?? 0,
    workBalance: data.workBalance ?? 0,
  };
}

export async function getUserTransactions(userId, limitCount = 50) {
  const q = query(
    collection(db, "transactions"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapTransaction(d.id, d.data()));
}

export async function getUserTickets(userId) {
  const q = query(
    collection(db, "tickets"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapTicket(d.id, d.data()));
}

export async function getTicketById(ticketId) {
  const snap = await getDoc(doc(db, "tickets", ticketId));
  if (!snap.exists()) return null;
  return mapTicket(snap.id, snap.data());
}

export async function purchaseTicket(eventId, quantity = 1, promoCode) {
  const fn = httpsCallable(functions, "purchaseTicket");
  const result = await fn({ eventId, quantity, promoCode });
  return result.data;
}

export async function topUpWallet(amount) {
  const fn = httpsCallable(functions, "topUpWallet");
  await fn({ amount });
}

export async function getAllTransactionsAdmin(limitCount = 200, sortDirection = "desc") {
  const q = query(
    collection(db, "transactions"),
    orderBy("createdAt", sortDirection),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapTransaction(d.id, d.data()));
}

export async function getAllTransactionsAdminWithUsers(
  limitCount = 200,
  sortDirection = "desc"
) {
  const { getUserProfiles } = await import("./users.js");
  const transactions = await getAllTransactionsAdmin(limitCount, sortDirection);
  const userIds = transactions.map((t) => t.userId).filter(Boolean);
  const profiles = await getUserProfiles(userIds);

  return transactions.map((t) => {
    const user = profiles[t.userId];
    return {
      ...t,
      userDisplayName: user?.displayName ?? "—",
      userEmail: user?.email ?? "—",
    };
  });
}
