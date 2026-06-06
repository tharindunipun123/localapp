import { getAdminDb } from "../../firebase/admin.js";

function mapPlace(id, data) {
  return { id, ...data };
}

export async function getPlaceBySlugSSR(slug) {
  try {
    const snap = await getAdminDb()
      .collection("places")
      .where("seoSlug", "==", slug)
      .where("status", "==", "active")
      .limit(1)
      .get();
    if (snap.empty) return null;
    const d = snap.docs[0];
    return mapPlace(d.id, d.data());
  } catch {
    return null;
  }
}

export async function getAttractionsSSR(limitCount = 12) {
  const snap = await getAdminDb()
    .collection("places")
    .where("type", "==", "attraction")
    .where("status", "==", "active")
    .orderBy("averageRating", "desc")
    .limit(limitCount)
    .get();
  return snap.docs.map((d) => mapPlace(d.id, d.data()));
}
