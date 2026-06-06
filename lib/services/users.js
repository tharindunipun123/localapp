import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/client.js";

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() };
}

export async function getUserProfiles(uids) {
  const unique = [...new Set(uids.filter(Boolean))];
  const profiles = await Promise.all(unique.map((uid) => getUserProfile(uid)));
  const map = {};
  for (const profile of profiles) {
    if (profile) map[profile.uid] = profile;
  }
  return map;
}
