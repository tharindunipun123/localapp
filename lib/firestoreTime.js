/** Parse Firestore Timestamp from client SDK or callable JSON */
export function parseFirestoreTime(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const seconds = value.seconds ?? value._seconds;
  if (typeof seconds === "number") return new Date(seconds * 1000);
  return null;
}
