"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { PageHero } from "@/components/layout/PageHero";
import { MapView } from "@/components/maps/MapView";
import { Card } from "@/components/ui/Card";
import { resolveImageUrl } from "@/lib/services/storage";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { LocationSearchInput } from "@/components/search/LocationSearchInput";
import { getNearbyEvents } from "@/lib/services/events";
import { getNearbyPlaces } from "@/lib/services/places";
import { DEFAULT_CENTER, geoPointToLatLng } from "@/lib/utils/geohash";
import { getAppSettings } from "@/lib/services/admin";
import { Calendar, MapPin, Star, X } from "lucide-react";

function getEventStart(event) {
  if (event.startDatetime?.toDate) return event.startDatetime.toDate();
  if (event.startDatetime) return new Date(event.startDatetime);
  return null;
}

export default function MapPageContent() {
  const searchParams = useSearchParams();
  const paramLat = searchParams.get("lat");
  const paramLng = searchParams.get("lng");
  const paramZoom = searchParams.get("zoom");
  const paramQ = searchParams.get("q");

  const [lat, setLat] = useState(
    paramLat ? Number(paramLat) : DEFAULT_CENTER.lat
  );
  const [lng, setLng] = useState(
    paramLng ? Number(paramLng) : DEFAULT_CENTER.lng
  );
  const [mapZoom, setMapZoom] = useState(paramZoom ? Number(paramZoom) : 12);
  const [events, setEvents] = useState([]);
  const [places, setPlaces] = useState([]);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [searchLocation, setSearchLocation] = useState(
    paramQ && paramLat && paramLng
      ? { name: paramQ, address: paramQ, lat: Number(paramLat), lng: Number(paramLng) }
      : null
  );

  useEffect(() => {
    getAppSettings()
      .then((s) => {
        const r = Number(s?.nearbyRadiusKm);
        if (r >= 1 && r <= 50) setRadiusKm(r);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (paramLat && paramLng) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
        },
        () => {}
      );
    }
  }, [paramLat, paramLng]);

  useEffect(() => {
    async function load() {
      const placeType =
        filter === "landmark" ? "landmark" : filter === "attraction" ? "attraction" : undefined;
      const [e, p] = await Promise.all([
        filter !== "places" ? getNearbyEvents(lat, lng, radiusKm, 30) : Promise.resolve([]),
        filter !== "events" ? getNearbyPlaces(lat, lng, placeType, radiusKm, 30) : Promise.resolve([]),
      ]);
      setEvents(e);
      setPlaces(p);
    }
    load();
  }, [lat, lng, filter, radiusKm]);

  function handleLocationSelect(place) {
    setLat(place.lat);
    setLng(place.lng);
    setMapZoom(14);
    setSearchLocation(place);
    setSelected(null);

    const params = new URLSearchParams({
      lat: String(place.lat),
      lng: String(place.lng),
      zoom: "14",
      q: place.name,
    });
    window.history.replaceState(null, "", `/map?${params.toString()}`);
  }

  const markers = useMemo(() => {
    const list = [
      ...events.map((e) => ({
        id: `event-${e.id}`,
        lat: geoPointToLatLng(e.location).lat,
        lng: geoPointToLatLng(e.location).lng,
        title: e.title,
        subtitle: e.locationLabel,
        type: "event",
        slug: e.seoSlug,
        imageUrl: resolveImageUrl(e.images?.[0]),
        distanceKm: e.distanceKm,
        href: `/events/${e.seoSlug}`,
        data: e,
      })),
      ...places.map((p) => ({
        id: `place-${p.id}`,
        lat: geoPointToLatLng(p.coordinates).lat,
        lng: geoPointToLatLng(p.coordinates).lng,
        title: p.name,
        subtitle: `${p.city}, ${p.district}`,
        type: p.type,
        slug: p.seoSlug,
        imageUrl: resolveImageUrl(p.images?.[0]),
        distanceKm: p.distanceKm,
        href: `/places/${p.seoSlug}`,
        data: p,
      })),
    ];

    if (searchLocation) {
      list.unshift({
        id: "search-location",
        lat: searchLocation.lat,
        lng: searchLocation.lng,
        title: searchLocation.name,
        subtitle: searchLocation.address,
        type: "search",
        imageUrl: searchLocation.photoUrl,
      });
    }

    return list;
  }, [events, places, searchLocation]);

  return (
    <PublicLayout>
      <PageHero
        compact
        segment="places"
        image="/images/hero-places.png"
        eyebrow="Explore"
        title="Live map of Sri Lanka"
        subtitle="Search cities, events, and attractions. The map follows your selection."
      />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Select
              options={[
                { value: "all", label: "All" },
                { value: "events", label: "Events only" },
                { value: "places", label: "Places only" },
                { value: "landmark", label: "Landmarks" },
                { value: "attraction", label: "Attractions" },
              ]}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setSelected(null);
              }}
              className="w-44"
            />
          </div>

          <LocationSearchInput
            placeholder="Search cities, landmarks, attractions, addresses in Sri Lanka…"
            onSelect={handleLocationSelect}
            initialValue={searchLocation?.name ?? ""}
          />

          {searchLocation && (
            <p className="text-sm text-[var(--color-primary)]">
              Showing area near <strong>{searchLocation.name}</strong>
              {searchLocation.address && searchLocation.address !== searchLocation.name && (
                <span className="text-[var(--color-muted)]"> · {searchLocation.address}</span>
              )}
            </p>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card padding={false} className="overflow-hidden">
            <MapView
              lat={lat}
              lng={lng}
              zoom={mapZoom}
              className="h-[60vh] min-h-[400px] w-full"
              markers={markers}
              selectedId={selected?.id}
              onMarkerClick={setSelected}
            />
          </Card>

          <div className="space-y-4">
            {selected ? (
              <MapDetailPanel item={selected} onClose={() => setSelected(null)} />
            ) : (
              <>
                <Card>
                  <h3 className="mb-2 font-semibold text-[var(--color-fg)]">
                    Nearby Events ({events.length})
                  </h3>
                  <ul className="max-h-48 space-y-2 overflow-y-auto">
                    {events.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setSelected({
                              id: `event-${e.id}`,
                              type: "event",
                              title: e.title,
                              subtitle: e.locationLabel,
                              imageUrl: resolveImageUrl(e.images?.[0]),
                              distanceKm: e.distanceKm,
                              href: `/events/${e.seoSlug}`,
                              data: e,
                            })
                          }
                          className="w-full text-left text-sm text-[var(--color-primary)] hover:underline"
                        >
                          {e.title}
                        </button>
                      </li>
                    ))}
                    {events.length === 0 && (
                      <li className="text-sm text-[var(--color-muted)]">No nearby events</li>
                    )}
                  </ul>
                </Card>
                <Card>
                  <h3 className="mb-2 font-semibold text-[var(--color-fg)]">
                    Nearby Places ({places.length})
                  </h3>
                  <ul className="max-h-48 space-y-2 overflow-y-auto">
                    {places.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setSelected({
                              id: `place-${p.id}`,
                              type: p.type,
                              title: p.name,
                              subtitle: `${p.city}, ${p.district}`,
                              imageUrl: resolveImageUrl(p.images?.[0]),
                              distanceKm: p.distanceKm,
                              href: `/places/${p.seoSlug}`,
                              data: p,
                            })
                          }
                          className="w-full text-left text-sm text-[var(--color-primary)] hover:underline"
                        >
                          {p.name}
                        </button>
                      </li>
                    ))}
                    {places.length === 0 && (
                      <li className="text-sm text-[var(--color-muted)]">No nearby places</li>
                    )}
                  </ul>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

function MapDetailPanel({ item, onClose }) {
  const isEvent = item.type === "event";
  const isSearch = item.type === "search";
  const data = item.data;
  const start = isEvent ? getEventStart(data) : null;

  return (
    <Card className="relative overflow-hidden p-0">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 z-10 rounded-full bg-black/40 p-1 text-white hover:bg-black/60"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>

      {!isSearch && (
        <div className="relative aspect-[16/10] bg-[var(--color-primary-light)]">
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt={item.title} fill className="object-cover" sizes="320px" />
          ) : (
            <div className="flex h-full items-center justify-center text-[var(--color-accent)]">
              {isEvent ? <Calendar className="h-10 w-10" /> : <MapPin className="h-10 w-10" />}
            </div>
          )}
          <div className="absolute left-3 top-3">
            <Badge
              label={isEvent ? "Event" : item.type}
              status={isEvent ? "approved" : item.type}
            />
          </div>
        </div>
      )}

      <div className="p-4">
        <h3 className="font-semibold text-[var(--color-fg)]">{item.title}</h3>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{item.subtitle}</p>

        {item.distanceKm !== undefined && (
          <p className="mt-1 text-sm font-medium text-[var(--color-primary)]">
            {item.distanceKm.toFixed(1)} km away
          </p>
        )}

        {isEvent && start && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--color-muted)]">
            <Calendar className="h-3.5 w-3.5" />
            {format(start, "EEE, MMM d · h:mm a")}
          </p>
        )}

        {!isEvent && !isSearch && data?.reviewCount > 0 && (
          <p className="mt-2 flex items-center gap-1 text-sm text-[var(--color-warning)]">
            <Star className="h-3.5 w-3.5 fill-current" />
            {data.averageRating.toFixed(1)} ({data.reviewCount} reviews)
          </p>
        )}

        {data?.description && (
          <p className="mt-3 line-clamp-3 text-sm text-[var(--color-muted-fg)]">
            {data.description}
          </p>
        )}

        {item.href && (
          <Link
            href={item.href}
            className="mt-4 inline-block rounded-[var(--radius-lg)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)]"
          >
            View details
          </Link>
        )}
      </div>
    </Card>
  );
}
