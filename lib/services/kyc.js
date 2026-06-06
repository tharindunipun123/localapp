import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/client.js";
import { createKycSession, reviewKyc, getAdminKycQueue } from "./cloudFunctions.js";

export async function getPendingKycSubmissions(limitCount = 50) {
  const rows = await getAdminKycQueue();
  return rows.slice(0, limitCount);
}

export async function getKycSubmission(userId) {
  const snap = await getDoc(doc(db, "kycSubmissions", userId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** Calls the Cloud Function which creates a Didit session and returns { url, sessionId } */
export async function startKycVerification() {
  return createKycSession();
}

export { reviewKyc };
