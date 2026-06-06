import { getAdminDb } from "../../firebase/admin.js";
import { Timestamp } from "firebase-admin/firestore";

function mapEvent(id, data) {
  return { id, ...data };
}

export async function getEventBySlugSSR(slug) {
  try {
    const snap = await getAdminDb()
      .collection("events")
      .where("seoSlug", "==", slug)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const d = snap.docs[0];
    return mapEvent(d.id, d.data());
  } catch {
    return null;
  }
}

export async function getFeaturedEventsSSR(limitCount = 6) {
  const now = Timestamp.now();
  const snap = await getAdminDb()
    .collection("events")
    .where("status", "==", "approved")
    .where("isFeatured", "==", true)
    .where("endDatetime", ">=", now)
    .orderBy("endDatetime")
    .orderBy("startDatetime")
    .limit(limitCount)
    .get();
  return snap.docs.map((d) => mapEvent(d.id, d.data()));
}

export async function getApprovedPublicEventSSR(slug) {
  const event = await getEventBySlugSSR(slug);
  if (!event) return null;
  if (event.status === "approved") return event;
  if (event.status === "expired" && event.eventType !== "free") return event;
  return null;
}
