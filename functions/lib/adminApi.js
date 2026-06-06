"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimAdminRole = exports.getAdminUsersList = exports.getAdminDashboardStats = exports.getAdminKycQueue = exports.getAdminVendorData = void 0;
const adminSdk = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("./helpers");
const REGION = "us-central1";
function mapDoc(id, data) {
    return { id, ...data };
}
/** Check custom claim (fast) then fall back to Firestore role */
async function requireAdmin(uid, token) {
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    // Fast path — custom claim set by claimAdminRole
    if ((token === null || token === void 0 ? void 0 : token.admin) === true)
        return;
    // Fallback — Firestore role check
    if (!(await (0, helpers_1.isAdmin)(uid)))
        throw new https_1.HttpsError("permission-denied", "Admin only");
}
/** Admin: vendors list, pending applications, pool top-up queue (enriched with owner KYC status) */
exports.getAdminVendorData = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b;
    await requireAdmin((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid, (_b = request.auth) === null || _b === void 0 ? void 0 : _b.token);
    const [pendingSnap, allSnap, poolSnap] = await Promise.all([
        helpers_1.db.collection("vendors").where("status", "==", "pending").orderBy("createdAt", "desc").limit(100).get(),
        helpers_1.db.collection("vendors").orderBy("createdAt", "desc").limit(200).get(),
        helpers_1.db.collection("poolTopUpRequests").where("status", "==", "pending").orderBy("createdAt", "desc").limit(100).get(),
    ]);
    async function enrichWithOwnerKyc(docs) {
        return Promise.all(docs.map(async (d) => {
            var _a, _b, _c;
            const data = d.data();
            const ownerUid = (_a = data.ownerId) !== null && _a !== void 0 ? _a : d.id;
            try {
                const userSnap = await helpers_1.db.doc(`users/${ownerUid}`).get();
                const ownerKycStatus = (_c = (_b = userSnap.data()) === null || _b === void 0 ? void 0 : _b.kycStatus) !== null && _c !== void 0 ? _c : "none";
                return mapDoc(d.id, { ...data, ownerKycStatus });
            }
            catch (_d) {
                return mapDoc(d.id, data);
            }
        }));
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
exports.getAdminKycQueue = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b;
    await requireAdmin((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid, (_b = request.auth) === null || _b === void 0 ? void 0 : _b.token);
    const snap = await helpers_1.db
        .collection("kycSubmissions")
        .where("status", "==", "pending")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();
    return snap.docs.map((d) => mapDoc(d.id, d.data()));
});
/** Admin: dashboard stats */
exports.getAdminDashboardStats = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b;
    await requireAdmin((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid, (_b = request.auth) === null || _b === void 0 ? void 0 : _b.token);
    const [pending, approved, users, reported] = await Promise.all([
        helpers_1.db.collection("events").where("status", "==", "pending").get(),
        helpers_1.db.collection("events").where("status", "==", "approved").limit(500).get(),
        helpers_1.db.collection("users").limit(500).get(),
        helpers_1.db.collection("reviews").where("status", "==", "reported").get(),
    ]);
    return {
        pendingEvents: pending.size,
        approvedEvents: approved.size,
        totalUsers: users.size,
        reportedReviews: reported.size,
    };
});
/** Admin: all users for management table */
exports.getAdminUsersList = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b;
    await requireAdmin((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid, (_b = request.auth) === null || _b === void 0 ? void 0 : _b.token);
    const snap = await helpers_1.db.collection("users").orderBy("createdAt", "desc").limit(200).get();
    return snap.docs.map((d) => mapDoc(d.id, { uid: d.id, ...d.data() }));
});
/**
 * Bootstrap / repair admin role.
 * - If user's Firestore doc already says "admin" (any case) → set custom claim.
 * - If no admin exists yet → set role + custom claim.
 * - Otherwise → refuse.
 */
exports.claimAdminRole = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b, _c, _d;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const uid = request.auth.uid;
    const email = (_b = (_a = request.auth.token) === null || _a === void 0 ? void 0 : _a.email) !== null && _b !== void 0 ? _b : "";
    const userRef = helpers_1.db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const currentRole = ((_d = (_c = userSnap.data()) === null || _c === void 0 ? void 0 : _c.role) !== null && _d !== void 0 ? _d : "").toString();
    const alreadyAdminInDb = currentRole.toLowerCase() === "admin";
    if (!alreadyAdminInDb) {
        // Check if any other admin already exists
        const adminSnap = await helpers_1.db.collection("users").where("role", "==", "admin").limit(2).get();
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
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    else {
        await userRef.update({ role: "admin", updatedAt: firestore_1.FieldValue.serverTimestamp() });
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
//# sourceMappingURL=adminApi.js.map