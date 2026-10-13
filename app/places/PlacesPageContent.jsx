"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { PageHero } from "@/components/layout/PageHero";
import { PlaceCard } from "@/components/places/PlaceCard";
import { EventCardSkeleton } from "@/components/ui/Skeleton";
import { Select } from "@/components/ui/Select";
import { DiscoverSearchBar } from "@/components/search/DiscoverSearchBar";
import {
  getAttractions,
  getLandmarks,
  getNearbyPlaces,
  searchAttractions,
  searchLandmarks,
} from "@/lib/services/places";
import { filterByQuery } from "@/lib/services/unifiedSearch";

const PLACE_FILTER_FIELDS = ["name", "city", "district", "description", "tags"];

export default function PlacesPageContent() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type") ?? "attraction";
  const [type, setType] = useState(typeParam === "landmark" ? "landmark" : "attraction");
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [textQuery, setTextQuery] = useState("");
  const [nearLocation, setNearLocation] = useState(null);

  useEffect(() => {
    loadDefault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function loadDefault() {
    setLoading(true);
    setNearLocation(null);
    const data = type === "attraction" ? await getAttractions(24) : await getLandmarks(24);
    setPlaces(data);
    setLoading(false);
  }

  async function handleTextSearch(e) {
    e.preventDefault();
    const term = textQuery.trim();

    if (!term && !nearLocation) {
      await loadDefault();
      return;
    }

    setLoading(true);
    try {
      let data;
      if (nearLocation) {
        data = await getNearbyPlaces(nearLocation.lat, nearLocation.lng, type, 25, 40);
        if (term) {
          data = filterByQuery(data, term, PLACE_FILTER_FIELDS);
        }
      } else {
        data =
          type === "landmark"
            ? await searchLandmarks(term)
            : await searchAttractions(term);
      }
      setPlaces(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleLocationSelect(place) {
    setNearLocation(place);
    setLoading(true);
    try {
      let data = await getNearbyPlaces(place.lat, place.lng, type, 25, 40);
      const term = textQuery.trim();
      if (term) {
        data = filterByQuery(data, term, PLACE_FILTER_FIELDS);
      }
      setPlaces(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicLayout>
      <PageHero
        compact
        segment="places"
        image="/images/hero-places.png"
        eyebrow="Discover"
        title="Landmarks and attractions"
        subtitle="Explore Sri Lanka with curated places and nearby search."
      />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
          <Select
            options={[
              { value: "attraction", label: "Attractions" },
              { value: "landmark", label: "Landmarks" },
            ]}
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-44"
          />
        </div>

        <div className="mb-8">
          <DiscoverSearchBar
            textQuery={textQuery}
            onTextQueryChange={setTextQuery}
            onTextSearch={handleTextSearch}
            onLocationSelect={handleLocationSelect}
            loading={loading}
            textPlaceholder="Search by name, city, district, tags…"
            locationPlaceholder="Or search a location in Sri Lanka to find nearby places…"
          />
          {nearLocation && (
            <p className="mt-2 text-sm text-[var(--color-primary)]">
              Showing {type === "landmark" ? "landmarks" : "attractions"} near{" "}
              <strong>{nearLocation.name}</strong>
            </p>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : places.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {places.map((p) => (
              <PlaceCard key={p.id} place={p} />
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border)] py-16 text-center text-[var(--color-muted)]">
            No places found.
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
