import { getDocs, collection, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase/client.js";
import { createPromoCode, validatePromoCode } from "./cloudFunctions.js";

export async function getPromoCodes(limitCount = 50) {
  const q = query(collection(db, "promoCodes"), orderBy("createdAt", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getPromoRedemptions(limitCount = 100) {
  const q = query(collection(db, "promoRedemptions"), orderBy("createdAt", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export { createPromoCode, validatePromoCode };
