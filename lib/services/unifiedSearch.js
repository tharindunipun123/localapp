import { searchEventsByTitle } from "./events.js";
import { searchPlaces, searchLandmarks, searchAttractions } from "./places.js";
import { textSearchPlaces } from "./googlePlaces.js";

/** Search events, places, landmarks, attractions in Firestore + Google Maps locations */
export async function unifiedSearch(term) {
  const trimmed = term.trim();
  if (!trimmed) {
    return {
      events: [],
      landmarks: [],
      attractions: [],
      places: [],
      googleLocations: [],
    };
  }

  const [events, landmarks, attractions, places, googleLocations] = await Promise.all([
    searchEventsByTitle(trimmed),
    searchLandmarks(trimmed),
    searchAttractions(trimmed),
    searchPlaces(trimmed),
    textSearchPlaces(trimmed, 8).catch(() => []),
  ]);

  return { events, landmarks, attractions, places, googleLocations };
}

/** Filter a list by text query (title, name, city, tags, etc.) */
export function filterByQuery(items, term, fields) {
  if (!term.trim()) return items;
  const q = term.trim().toLowerCase();
  return items.filter((item) =>
    fields.some((field) => {
      const val = item[field];
      if (Array.isArray(val)) return val.some((v) => String(v).toLowerCase().includes(q));
      return val != null && String(val).toLowerCase().includes(q);
    })
  );
}
