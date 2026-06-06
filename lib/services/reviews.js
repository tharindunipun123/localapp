import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/client.js";
import { defaults } from "@/lib/config";

function mapReview(id, data) {
  return { id, ...data };
}

export async function getReviewsForAttraction(
  attractionId,
  pageSize = defaults.reviewsPageSize
) {
  const q = query(
    collection(db, "reviews"),
    where("attractionId", "==", attractionId),
    where("status", "==", "published"),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapReview(d.id, d.data()));
}

export async function getUserReviewForAttraction(userId, attractionId) {
  const q = query(
    collection(db, "reviews"),
    where("attractionId", "==", attractionId),
    where("userId", "==", userId),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return mapReview(d.id, d.data());
}

export async function createReview(input) {
  const existing = await getUserReviewForAttraction(input.userId, input.attractionId);
  if (existing) {
    await updateDoc(doc(db, "reviews", existing.id), {
      rating: Math.min(5, Math.max(1, input.rating)),
      comment: input.comment.slice(0, 1000),
      userDisplayName: input.userDisplayName,
      status: "published",
      updatedAt: serverTimestamp(),
    });
    return existing.id;
  }

  const ref = await addDoc(collection(db, "reviews"), {
    attractionId: input.attractionId,
    userId: input.userId,
    userDisplayName: input.userDisplayName,
    rating: Math.min(5, Math.max(1, input.rating)),
    comment: input.comment.slice(0, 1000),
    status: "published",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function reportReview(reviewId) {
  await updateDoc(doc(db, "reviews", reviewId), {
    status: "reported",
    updatedAt: serverTimestamp(),
  });
}

export async function hideReview(reviewId) {
  await updateDoc(doc(db, "reviews", reviewId), {
    status: "hidden",
    updatedAt: serverTimestamp(),
  });
}

export async function getReportedReviews() {
  const q = query(
    collection(db, "reviews"),
    where("status", "==", "reported"),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapReview(d.id, d.data()));
}

export async function getAllReviewsAdmin() {
  const q = query(
    collection(db, "reviews"),
    orderBy("createdAt", "desc"),
    limit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapReview(d.id, d.data()));
}
