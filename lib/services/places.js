import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  GeoPoint,
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

function mapPlace(id, data) {
  return { id, ...data };
}

export async function getPlaceBySlug(slug) {
  const q = query(
    collection(db, "places"),
    where("seoSlug", "==", slug),
    where("status", "==", "active"),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return mapPlace(d.id, d.data());
}

export async function getPlaceById(id) {
  const snap = await getDoc(doc(db, "places", id));
  if (!snap.exists()) return null;
  return mapPlace(snap.id, snap.data());
}

export async function getAttractions(limitCount = defaults.placesPageSize) {
  const q = query(
    collection(db, "places"),
    where("type", "==", "attraction"),
    where("status", "==", "active"),
    orderBy("averageRating", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapPlace(d.id, d.data()));
}

export async function getLandmarks(limitCount = defaults.placesPageSize) {
  const q = query(
    collection(db, "places"),
    where("type", "==", "landmark"),
    where("status", "==", "active"),
    orderBy("name"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapPlace(d.id, d.data()));
}

export async function getAttractionsByLandmark(landmarkId) {
  const q = query(
    collection(db, "places"),
    where("type", "==", "attraction"),
    where("parentLandmarkId", "==", landmarkId),
    where("status", "==", "active"),
    orderBy("name"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapPlace(d.id, d.data()));
}

export async function getNearbyPlaces(
  lat,
  lng,
  type,
  radiusKm = defaults.nearbyRadiusKm,
  limitCount = defaults.placesPageSize
) {
  const bounds = getGeohashBounds(lat, lng, radiusKm);
  const results = [];
  const seen = new Set();

  for (const [start, end] of bounds) {
    const q = type
      ? query(
          collection(db, "places"),
          where("status", "==", "active"),
          where("type", "==", type),
          where("geohash", ">=", start),
          where("geohash", "<=", end),
          orderBy("geohash"),
          limit(limitCount)
        )
      : query(
          collection(db, "places"),
          where("status", "==", "active"),
          where("geohash", ">=", start),
          where("geohash", "<=", end),
          orderBy("geohash"),
          limit(limitCount)
        );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      const place = mapPlace(d.id, d.data());
      const coords = geoPointToLatLng(place.coordinates);
      const dist = distanceKm({ lat, lng }, coords);
      if (dist <= radiusKm) {
        results.push({ ...place, distanceKm: dist });
      }
    }
  }

  return results.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, limitCount);
}

export async function getAllPlacesAdmin(type) {
  let q;
  if (type) {
    q = query(
      collection(db, "places"),
      where("type", "==", type),
      orderBy("name"),
      limit(200)
    );
  } else {
    q = query(collection(db, "places"), orderBy("name"), limit(200));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapPlace(d.id, d.data()));
}

export async function createPlace(input) {
  const geohash = encodeGeohash(input.lat, input.lng);
  const slug = uniqueSlug(input.name);

  const data = {
    name: input.name,
    type: input.type,
    description: input.description,
    coordinates: new GeoPoint(input.lat, input.lng),
    geohash,
    province: input.province,
    district: input.district,
    city: input.city,
    category: input.category,
    images: input.images ?? [],
    websiteUrl: input.websiteUrl ?? "",
    metaTitle: input.metaTitle ?? input.name,
    metaDescription: input.metaDescription ?? input.description.slice(0, 160),
    seoSlug: slug,
    averageRating: 0,
    reviewCount: 0,
    createdBy: input.createdBy,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (input.type === "attraction") {
    if (input.parentLandmarkId) data.parentLandmarkId = input.parentLandmarkId;
    data.operatingHours = input.operatingHours ?? "";
    data.entryFee = input.entryFee ?? 0;
  }
  if (input.type === "landmark" && input.boundingArea) {
    data.boundingArea = input.boundingArea;
  }

  const ref = await addDoc(collection(db, "places"), data);
  return ref.id;
}

export async function updatePlace(placeId, updates) {
  const patch = { updatedAt: serverTimestamp() };
  if (updates.name) patch.name = updates.name;
  if (updates.description) patch.description = updates.description;
  if (updates.lat !== undefined && updates.lng !== undefined) {
    patch.coordinates = new GeoPoint(updates.lat, updates.lng);
    patch.geohash = encodeGeohash(updates.lat, updates.lng);
  }
  if (updates.province) patch.province = updates.province;
  if (updates.district) patch.district = updates.district;
  if (updates.city) patch.city = updates.city;
  if (updates.category) patch.category = updates.category;
  if (updates.images) patch.images = updates.images;
  if (updates.operatingHours !== undefined) patch.operatingHours = updates.operatingHours;
  if (updates.entryFee !== undefined) patch.entryFee = updates.entryFee;
  if (updates.websiteUrl !== undefined) patch.websiteUrl = updates.websiteUrl;
  if (updates.metaTitle) patch.metaTitle = updates.metaTitle;
  if (updates.metaDescription) patch.metaDescription = updates.metaDescription;
  if (updates.parentLandmarkId) patch.parentLandmarkId = updates.parentLandmarkId;
  if (updates.boundingArea) patch.boundingArea = updates.boundingArea;
  if (updates.status) patch.status = updates.status;

  await updateDoc(doc(db, "places", placeId), patch);
}

export async function deletePlace(placeId) {
  await deleteDoc(doc(db, "places", placeId));
}

export async function searchPlaces(term, limitCount = defaults.placesPageSize, type) {
  const q = query(
    collection(db, "places"),
    where("status", "==", "active"),
    orderBy("name"),
    limit(150)
  );
  const snap = await getDocs(q);
  const lower = term.toLowerCase();
  return snap.docs
    .map((d) => mapPlace(d.id, d.data()))
    .filter((p) => {
      if (type && p.type !== type) return false;
      return (
        p.name.toLowerCase().includes(lower) ||
        (p.city ?? "").toLowerCase().includes(lower) ||
        (p.district ?? "").toLowerCase().includes(lower) ||
        (p.province ?? "").toLowerCase().includes(lower) ||
        (p.category ?? "").toLowerCase().includes(lower) ||
        (p.description ?? "").toLowerCase().includes(lower)
      );
    })
    .slice(0, limitCount);
}

export async function searchLandmarks(term, limitCount = defaults.placesPageSize) {
  return searchPlaces(term, limitCount, "landmark");
}

export async function searchAttractions(term, limitCount = defaults.placesPageSize) {
  return searchPlaces(term, limitCount, "attraction");
}

export async function getPlacesPaginated(type, pageSize = defaults.placesPageSize, lastDoc = null) {
  let q = query(
    collection(db, "places"),
    where("type", "==", type),
    where("status", "==", "active"),
    orderBy("name"),
    limit(pageSize)
  );
  if (lastDoc) q = query(q, startAfter(lastDoc));
  const snap = await getDocs(q);
  return {
    places: snap.docs.map((d) => mapPlace(d.id, d.data())),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
  };
}
