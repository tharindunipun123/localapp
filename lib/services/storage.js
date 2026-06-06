import { ref, uploadBytes } from "firebase/storage";
import { storage } from "../firebase/client.js";
import { firebaseConfig } from "@/lib/config";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Public download URL when storage rules allow `read: if true` */
export function getPublicStorageUrl(path) {
  const bucket = firebaseConfig.storageBucket;
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

/** Normalize Firestore image values (full URL, gs:// URI, or storage path) */
export function resolveImageUrl(urlOrPath) {
  if (!urlOrPath) return null;
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    return urlOrPath;
  }
  if (urlOrPath.startsWith("gs://")) {
    const path = urlOrPath.replace(/^gs:\/\/[^/]+\//, "");
    return getPublicStorageUrl(path);
  }
  if (urlOrPath.includes("/")) {
    return getPublicStorageUrl(urlOrPath);
  }
  return urlOrPath;
}

function guessImageContentType(file) {
  if (file.type && file.type.startsWith("image/")) {
    return file.type;
  }
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".svg")) return "image/svg+xml";
  if (name.endsWith(".heic")) return "image/heic";
  if (name.endsWith(".heif")) return "image/heif";
  return "image/jpeg";
}

export function validateImageFile(file) {
  if (!file) throw new Error("No file selected.");
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `"${file.name}" is ${mb} MB. Please use an image under 10 MB (compress or resize it first).`
    );
  }
}

export async function uploadImage(file, path) {
  validateImageFile(file);
  const contentType = guessImageContentType(file);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType });
  return getPublicStorageUrl(path);
}

export async function uploadEventImage(file, eventId, index) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  return uploadImage(file, `events/${eventId}/${index}.${ext}`);
}

export async function uploadPlaceImage(file, placeId, index) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  return uploadImage(file, `places/${placeId}/${index}.${ext}`);
}
