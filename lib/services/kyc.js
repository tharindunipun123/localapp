import { doc, getDoc } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { db, storage } from "../firebase/client.js";
import {
  createKycSession,
  reviewKyc,
  getAdminKycQueue,
  submitKycDocuments,
  refreshKycDecision,
} from "./cloudFunctions.js";
import { uploadKycImage } from "./storage.js";

export async function getPendingKycSubmissions(limitCount = 50) {
  const rows = await getAdminKycQueue();
  return rows.slice(0, limitCount);
}

export async function getKycSubmission(userId) {
  const snap = await getDoc(doc(db, "kycSubmissions", userId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getKycImageUrl(path) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  try {
    return await getDownloadURL(ref(storage, path));
  } catch {
    return null;
  }
}

export async function startKycVerification() {
  return createKycSession();
}

export async function submitInAppKyc({ userId, frontFile, backFile, selfieFile, identity }) {
  const frontPath = await uploadKycImage(frontFile, userId, "front");
  const selfiePath = await uploadKycImage(selfieFile, userId, "selfie");
  const backPath = backFile ? await uploadKycImage(backFile, userId, "back") : "";
  return submitKycDocuments({
    frontPath,
    selfiePath,
    backPath,
    identity,
  });
}

export { reviewKyc, refreshKycDecision };
