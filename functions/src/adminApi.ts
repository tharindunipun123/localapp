import * as adminSdk from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db, isAdmin } from "./helpers";

const REGION = "us-central1";

function mapDoc(id: string, data: FirebaseFirestore.DocumentData) {
  return { id, ...data };
}

/** Check custom claim (fast) then fall back to Firestore role */
async function requireAdmin(
  uid: string | undefined,
  token?: Record<string, unknown>
): Promise<void> {
  if (!uid) throw new HttpsError("unauthenticated", "Must be signed in");
  // Fast path — custom claim set by claimAdminRole
  if (token?.admin === true) return;
  // Fallback — Firestore role check
  if (!(await isAdmin(uid))) throw new HttpsError("permission-denied", "Admin only");
}

/** Admin: vendors list, pending applications, pool top-up queue (enriched with owner KYC status) */
export const getAdminVendorData = onCall({ region: REGION }, async (request) => {
  await requireAdmin(request.auth?.uid, request.auth?.token as Record<string, unknown>);

  const [pendingSnap, allSnap, poolSnap] = await Promise.all([
    db.collection("vendors").where("status", "==", "pending").orderBy("createdAt", "desc").limit(100).get(),
    db.collection("vendors").orderBy("createdAt", "desc").limit(200).get(),
    db.collection("poolTopUpRequests").where("status", "==", "pending").orderBy("createdAt", "desc").limit(100).get(),
  ]);

  async function enrichWithOwnerKyc(docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
    return Promise.all(
      docs.map(async (d) => {
        const data = d.data();
        const ownerUid: string = data.ownerId ?? d.id;
        try {
          const userSnap = await db.doc(`users/${ownerUid}`).get();
          const ownerKycStatus = userSnap.data()?.kycStatus ?? "none";
          return mapDoc(d.id, { ...data, ownerKycStatus });
        } catch {
          return mapDoc(d.id, data);
        }
      })
    );
  }

  const [pending, all] = await Promise.all([
    enrichWithOwnerKyc(pendingSnap.docs),
    enrichWithOwnerKyc(allSnap.docs),
  ]);

  return {
    pending,
    all,
    poolTopUpRequests: poolSnap.docs.map((d) => mapDoc(d.id, d.data())),
  };
});

/** Admin: pending KYC submissions */
export const getAdminKycQueue = onCall({ region: REGION }, async (request) => {
  await requireAdmin(request.auth?.uid, request.auth?.token as Record<string, unknown>);

  const snap = await db
    .collection("kycSubmissions")
    .where("status", "==", "pending")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  return snap.docs.map((d) => mapDoc(d.id, d.data()));
});

/** Admin: dashboard stats */
export const getAdminDashboardStats = onCall({ region: REGION }, async (request) => {
  await requireAdmin(request.auth?.uid, request.auth?.token as Record<string, unknown>);

  const [pending, approved, users, reported] = await Promise.all([
    db.collection("events").where("status", "==", "pending").get(),
    db.collection("events").where("status", "==", "approved").limit(500).get(),
    db.collection("users").limit(500).get(),
    db.collection("reviews").where("status", "==", "reported").get(),
  ]);

  return {
    pendingEvents: pending.size,
    approvedEvents: approved.size,
    totalUsers: users.size,
    reportedReviews: reported.size,
  };
});

/** Admin: all users for management table */
export const getAdminUsersList = onCall({ region: REGION }, async (request) => {
  await requireAdmin(request.auth?.uid, request.auth?.token as Record<string, unknown>);

  const snap = await db.collection("users").orderBy("createdAt", "desc").limit(200).get();
  return snap.docs.map((d) => mapDoc(d.id, { uid: d.id, ...d.data() }));
});

/**
 * Bootstrap / repair admin role.
 * - If user's Firestore doc already says "admin" (any case) → set custom claim.
 * - If no admin exists yet → set role + custom claim.
 * - Otherwise → refuse.
 */
export const claimAdminRole = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const uid = request.auth.uid;
  const email = request.auth.token?.email ?? "";

  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const currentRole: string = (userSnap.data()?.role ?? "").toString();
  const alreadyAdminInDb = currentRole.toLowerCase() === "admin";

  if (!alreadyAdminInDb) {
    // Check if any other admin already exists
    const adminSnap = await db.collection("users").where("role", "==", "admin").limit(2).get();
    const otherAdmins = adminSnap.docs.filter((d) => d.id !== uid);
    if (otherAdmins.length > 0) {
      return {
        uid,
        email,
        currentRole,
        promoted: false,
        message: `Another admin already exists. Your current role is "${currentRole}". Ask that admin to promote you via the Users page.`,
      };
    }
  }

  // Write role to Firestore
  if (!userSnap.exists) {
    await userRef.set({
      uid,
      email,
      role: "admin",
      kycStatus: "none",
      vendorStatus: "none",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await userRef.update({ role: "admin", updatedAt: FieldValue.serverTimestamp() });
  }

  // Set Firebase Auth custom claim — no more Firestore reads needed for admin check
  await adminSdk.auth().setCustomUserClaims(uid, { admin: true });

  return {
    uid,
    email,
    currentRole: "admin",
    promoted: true,
    message: "Admin role set. The page will reload with full access.",
  };
});
