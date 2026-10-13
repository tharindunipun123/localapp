import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/client.js";

const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;

async function emailKey(email) {
  const data = new TextEncoder().encode(String(email).trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function assertLoginNotLocked(email) {
  const key = await emailKey(email);
  const snap = await getDoc(doc(db, "loginAttempts", key));
  if (!snap.exists()) return;
  const lockedUntil = snap.data()?.lockedUntil ?? 0;
  if (lockedUntil > Date.now()) {
    const mins = Math.ceil((lockedUntil - Date.now()) / 60000);
    throw new Error(`Account locked after 5 failed attempts. Try again in ${mins} minute(s).`);
  }
}

export async function recordLoginFailure(email) {
  const key = await emailKey(email);
  const ref = doc(db, "loginAttempts", key);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? Number(snap.data()?.failedCount ?? 0) : 0;
  const failedCount = prev + 1;
  const lockedUntil = failedCount >= MAX_FAILED ? Date.now() + LOCK_MS : 0;
  await setDoc(ref, { failedCount, lockedUntil, updatedAt: serverTimestamp() });
  if (lockedUntil) {
    throw new Error("Too many failed attempts. Account locked for 15 minutes.");
  }
}

export async function clearLoginFailures(email) {
  const key = await emailKey(email);
  await setDoc(doc(db, "loginAttempts", key), {
    failedCount: 0,
    lockedUntil: 0,
    updatedAt: serverTimestamp(),
  });
}
