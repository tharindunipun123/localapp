import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { firebaseConfig, functionsRegion } from "@/lib/config";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, functionsRegion);

/** Connect to local emulators when NEXT_PUBLIC_USE_EMULATORS=1 */
if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_EMULATORS === "1"
) {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

export { app };
