import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./client";

const googleProvider = new GoogleAuthProvider();

export async function ensureUserDocument(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    if (data.disabled) {
      throw new Error("This account has been disabled by an administrator.");
    }
    const emailVerified = !!user.emailVerified;
    if (data.emailVerified !== emailVerified) {
      await updateDoc(ref, { emailVerified, updatedAt: serverTimestamp() }).catch(() => {});
    }
    return { uid: user.uid, ...data, emailVerified };
  }

  const newUser = {
    email: user.email ?? "",
    displayName: user.displayName ?? user.email?.split("@")[0] ?? "User",
    role: "user",
    kycStatus: "none",
    vendorStatus: "none",
    emailVerified: !!user.emailVerified,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (user.photoURL) {
    newUser.photoURL = user.photoURL;
  }

  await setDoc(ref, newUser);
  return { uid: user.uid, ...newUser };
}

export async function registerWithEmail(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await cred.user.reload();
  return ensureUserDocument(cred.user);
}

export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return ensureUserDocument(cred.user);
}

export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  return ensureUserDocument(cred.user);
}

export async function logout() {
  await signOut(auth);
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() };
}

export function hasRole(user, roles) {
  if (!user?.role) return false;
  const role = String(user.role).trim().toLowerCase();
  return roles.some((r) => r.toLowerCase() === role);
}

export function isAdmin(user) {
  return hasRole(user, ["admin"]);
}

export function isVendorOrAdmin(user) {
  return hasRole(user, ["vendor", "admin"]) || user?.vendorStatus === "approved";
}

export function isVendor(user) {
  return user?.vendorStatus === "approved" || user?.role === "vendor";
}

export function isKycApproved(user) {
  return user?.kycStatus === "approved";
}

export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function sendEmailVerificationLink() {
  const { sendEmailVerification } = await import("firebase/auth");
  const { auth } = await import("./client");
  if (!auth.currentUser) throw new Error("Not signed in");
  await sendEmailVerification(auth.currentUser, {
    url: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
  });
}
