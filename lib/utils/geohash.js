import { geohashForLocation, geohashQueryBounds, distanceBetween } from "geofire-common";

export function encodeGeohash(lat, lng) {
  return geohashForLocation([lat, lng]);
}

export function getGeohashBounds(lat, lng, radiusKm) {
  return geohashQueryBounds([lat, lng], radiusKm * 1000);
}

export function distanceKm(from, to) {
  return distanceBetween([from.lat, from.lng], [to.lat, to.lng]) / 1000;
}

export function geoPointToLatLng(point) {
  return { lat: point.latitude, lng: point.longitude };
}

export const DEFAULT_CENTER = { lat: 6.9271, lng: 79.8612 };
