import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";
import { firebaseAdmin } from "@/lib/config";

let adminDb = null;

export function getAdminDb() {
  if (adminDb) return adminDb;

  let app;
  if (getApps().length) {
    app = getApps()[0];
  } else if (firebaseAdmin.serviceAccountPath) {
    const saPath = path.resolve(firebaseAdmin.serviceAccountPath);
    const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf8"));
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: firebaseAdmin.projectId,
    });
  } else {
    try {
      app = initializeApp({
        credential: applicationDefault(),
        projectId: firebaseAdmin.projectId,
      });
    } catch {
      app = initializeApp({ projectId: firebaseAdmin.projectId });
    }
  }

  adminDb = getFirestore(app);
  return adminDb;
}
