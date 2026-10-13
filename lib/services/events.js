import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  GeoPoint,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase/client.js";
import {
  encodeGeohash,
  getGeohashBounds,
  distanceKm,
  geoPointToLatLng,
} from "../utils/geohash.js";
import { uniqueSlug } from "../utils/slug.js";
import { defaults } from "@/lib/config";

function mapEvent(id, data) {
  return { id, ...data };
}

export async function getEventBySlug(slug) {
  const q = query(
    collection(db, "events"),
    where("seoSlug", "==", slug),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return mapEvent(d.id, d.data());
}

export async function getEventById(id) {
  const snap = await getDoc(doc(db, "events", id));
  if (!snap.exists()) return null;
  return mapEvent(snap.id, snap.data());
}

export async function getFeaturedEvents(limitCount = defaults.featuredEventLimit) {
  const now = Timestamp.now();
  const q = query(
    collection(db, "events"),
    where("status", "==", "approved"),
    where("isFeatured", "==", true),
    where("endDatetime", ">=", now),
    orderBy("endDatetime"),
    orderBy("startDatetime"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapEvent(d.id, d.data()));
}

export async function getTodayEvents(limitCount = defaults.eventsPageSize) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const q = query(
    collection(db, "events"),
    where("status", "==", "approved"),
    where("startDatetime", ">=", Timestamp.fromDate(startOfDay)),
    where("startDatetime", "<", Timestamp.fromDate(endOfDay)),
    orderBy("startDatetime"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapEvent(d.id, d.data()));
}

export async function getNearbyEvents(
  lat,
  lng,
  radiusKm = defaults.nearbyRadiusKm,
  limitCount = defaults.eventsPageSize
) {
  const bounds = getGeohashBounds(lat, lng, radiusKm);
  const now = Timestamp.now();
  const results = [];
  const seen = new Set();

  for (const [start, end] of bounds) {
    const q = query(
      collection(db, "events"),
      where("status", "==", "approved"),
      where("geohash", ">=", start),
      where("geohash", "<=", end),
      orderBy("geohash"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      const event = mapEvent(d.id, d.data());
      if (event.endDatetime && event.endDatetime.toMillis() < now.toMillis()) {
        continue;
      }
      const coords = geoPointToLatLng(event.location);
      const dist = distanceKm({ lat, lng }, coords);
      if (dist <= radiusKm) {
        results.push({ ...event, distanceKm: dist });
      }
    }
  }

  return results
    .sort(
      (a, b) =>
        a.distanceKm - b.distanceKm ||
        a.startDatetime.toMillis() - b.startDatetime.toMillis()
    )
    .slice(0, limitCount);
}

export async function getApprovedEvents(
  pageSize = defaults.eventsPageSize,
  lastDoc = null
) {
  const now = Timestamp.now();
  let q = query(
    collection(db, "events"),
    where("status", "==", "approved"),
    where("endDatetime", ">=", now),
    orderBy("endDatetime"),
    orderBy("startDatetime"),
    limit(pageSize)
  );
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }
  const snap = await getDocs(q);
  const events = snap.docs.map((d) => mapEvent(d.id, d.data()));
  const newLast = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
  return { events, lastDoc: newLast };
}

export async function getApprovedEventsByCategory(category, pageSize = 40) {
  if (!category) {
    const { events } = await getApprovedEvents(pageSize);
    return events;
  }
  const now = Timestamp.now();
  const q = query(
    collection(db, "events"),
    where("status", "==", "approved"),
    where("category", "==", category),
    where("endDatetime", ">=", now),
    orderBy("endDatetime"),
    orderBy("startDatetime"),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapEvent(d.id, d.data()));
}

export async function getUserEvents(userId) {
  const q = query(
    collection(db, "events"),
    where("createdBy", "==", userId),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapEvent(d.id, d.data()));
}

export async function getPendingEvents() {
  const q = query(
    collection(db, "events"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapEvent(d.id, d.data()));
}

export async function getAllEventsAdmin(status) {
  let q;
  if (status) {
    q = query(
      collection(db, "events"),
      where("status", "==", status),
      orderBy("createdAt", "desc"),
      limit(100)
    );
  } else {
    q = query(collection(db, "events"), orderBy("createdAt", "desc"), limit(100));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapEvent(d.id, d.data()));
}

export async function createEvent(input) {
  const geohash = encodeGeohash(input.lat, input.lng);
  const slug = uniqueSlug(input.title, Date.now().toString(36));

  const data = {
    title: input.title.slice(0, 120),
    description: input.description.slice(0, 2000),
    category: input.category,
    eventType: input.eventType,
    location: new GeoPoint(input.lat, input.lng),
    geohash,
    locationLabel: input.locationLabel,
    startDatetime: Timestamp.fromDate(input.startDatetime),
    endDatetime: Timestamp.fromDate(input.endDatetime),
    status: "pending",
    createdBy: input.createdBy,
    images: input.images ?? [],
    maxAttendees: input.maxAttendees ?? null,
    tags: input.tags ?? [],
    isFeatured: false,
    chatEnabled: input.chatEnabled ?? true,
    seoSlug: slug,
    attendeeCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (input.eventType === "paid_inapp") {
    data.ticketPrice = input.ticketPrice ?? 0;
  }
  if (input.eventType === "paid_external") {
    data.externalLink = input.externalLink ?? "";
  }
  if (input.attractionRef) data.attractionRef = input.attractionRef;
  if (input.landmarkRef) data.landmarkRef = input.landmarkRef;

  const ref = await addDoc(collection(db, "events"), data);
  return ref.id;
}

export async function updateEventImages(eventId, imageUrls) {
  await updateDoc(doc(db, "events", eventId), {
    images: imageUrls,
    updatedAt: serverTimestamp(),
  });
}

export async function updateUserEvent(eventId, userId, updates) {
  const snap = await getDoc(doc(db, "events", eventId));
  if (!snap.exists()) throw new Error("Event not found");
  const event = snap.data();
  if (event.createdBy !== userId) throw new Error("Unauthorized");
  if (!["pending", "rejected"].includes(event.status)) {
    throw new Error("Cannot edit this event");
  }

  const patch = { updatedAt: serverTimestamp(), status: "pending" };
  if (updates.title) patch.title = updates.title.slice(0, 120);
  if (updates.description) patch.description = updates.description.slice(0, 2000);
  if (updates.category) patch.category = updates.category;
  if (updates.eventType) patch.eventType = updates.eventType;
  if (updates.lat !== undefined && updates.lng !== undefined) {
    patch.location = new GeoPoint(updates.lat, updates.lng);
    patch.geohash = encodeGeohash(updates.lat, updates.lng);
  }
  if (updates.locationLabel) patch.locationLabel = updates.locationLabel;
  if (updates.startDatetime) {
    patch.startDatetime = Timestamp.fromDate(updates.startDatetime);
  }
  if (updates.endDatetime) {
    patch.endDatetime = Timestamp.fromDate(updates.endDatetime);
  }
  if (updates.images) patch.images = updates.images;
  if (updates.tags) patch.tags = updates.tags;
  if (updates.maxAttendees !== undefined) patch.maxAttendees = updates.maxAttendees;
  if (updates.chatEnabled !== undefined) patch.chatEnabled = updates.chatEnabled;

  await updateDoc(doc(db, "events", eventId), patch);
}

export async function searchEventsByTitle(term, limitCount = defaults.eventsPageSize) {
  const q = query(
    collection(db, "events"),
    where("status", "==", "approved"),
    orderBy("startDatetime", "desc"),
    limit(150)
  );
  const snap = await getDocs(q);
  const lower = term.toLowerCase();
  return snap.docs
    .map((d) => mapEvent(d.id, d.data()))
    .filter(
      (e) =>
        e.title.toLowerCase().includes(lower) ||
        (e.tags ?? []).some((t) => t.toLowerCase().includes(lower)) ||
        (e.locationLabel ?? "").toLowerCase().includes(lower) ||
        (e.description ?? "").toLowerCase().includes(lower) ||
        (e.category ?? "").toLowerCase().includes(lower)
    )
    .slice(0, limitCount);
}

export async function getEventsNearPlace(
  lat,
  lng,
  radiusKm = defaults.nearbyRadiusKm
) {
  return getNearbyEvents(lat, lng, radiusKm, 20);
}
