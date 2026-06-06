"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { EventCard } from "@/components/events/EventCard";
import { PlaceCard } from "@/components/places/PlaceCard";
import { DiscoverSearchBar } from "@/components/search/DiscoverSearchBar";
import { GoogleLocationCard } from "@/components/search/GoogleLocationCard";
import { unifiedSearch } from "@/lib/services/unifiedSearch";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { id: "all", label: "All" },
  { id: "events", label: "Events" },
  { id: "landmarks", label: "Landmarks" },
  { id: "attractions", label: "Attractions" },
  { id: "places", label: "All Places" },
  { id: "locations", label: "Google Locations" },
];

export default function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") ?? "";
  const initialTab = searchParams.get("tab") ?? "all";

  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState(initialTab);
  const [events, setEvents] = useState([]);
  const [landmarks, setLandmarks] = useState([]);
  const [attractions, setAttractions] = useState([]);
  const [places, setPlaces] = useState([]);
  const [googleLocations, setGoogleLocations] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialQuery) {
      runSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(term) {
    if (!term.trim()) return;
    setLoading(true);
    setError("");
    try {
      const results = await unifiedSearch(term.trim());
      setEvents(results.events);
      setLandmarks(results.landmarks);
      setAttractions(results.attractions);
      setPlaces(results.places);
      setGoogleLocations(results.googleLocations);
      setSearched(true);

      const params = new URLSearchParams({ q: term.trim(), tab });
      window.history.replaceState(null, "", `/search?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    await runSearch(query);
  }

  function handleLocationSelect(place) {
    router.push(
      `/map?lat=${place.lat}&lng=${place.lng}&zoom=14&q=${encodeURIComponent(place.name)}`
    );
  }

  const totalCount =
    events.length +
    landmarks.length +
    attractions.length +
    places.length +
    googleLocations.length;

  const resultCount =
    tab === "all"
      ? totalCount
      : tab === "events"
        ? events.length
        : tab === "landmarks"
          ? landmarks.length
          : tab === "attractions"
            ? attractions.length
            : tab === "locations"
              ? googleLocations.length
              : places.length;

  return (
    <PublicLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="mb-2 text-2xl font-bold text-[var(--color-fg)]">Search</h1>
        <p className="mb-6 text-sm text-[var(--color-muted)]">
          Find events, landmarks, attractions, places, and Google Maps locations across Sri Lanka
        </p>

        <div className="mb-6">
          <DiscoverSearchBar
            textQuery={query}
            onTextQueryChange={setQuery}
            onTextSearch={handleSearch}
            onLocationSelect={handleLocationSelect}
            loading={loading}
            textPlaceholder="Search by name, city, category, tags…"
            locationPlaceholder="Or pick a location to open on the map…"
          />
        </div>

        {error && (
          <div className="mb-6 rounded-[var(--radius-lg)] bg-[var(--color-danger-light)] px-4 py-3 text-sm text-[var(--color-danger-fg)]">
            {error}
          </div>
        )}

        {searched && (
          <>
            <div className="mb-6 flex flex-wrap gap-2 border-b border-[var(--color-border-light)] pb-4">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    tab === t.id
                      ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]"
                      : "bg-[var(--color-border-light)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                  )}
                >
                  {t.label}
                </button>
              ))}
              <span className="ml-auto self-center text-sm text-[var(--color-muted)]">
                {resultCount} result{resultCount !== 1 ? "s" : ""}
              </span>
            </div>

            {(tab === "all" || tab === "events") && (
              <SearchSection title="Events" count={events.length} empty="No events found.">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {events.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              </SearchSection>
            )}

            {(tab === "all" || tab === "landmarks") && (
              <SearchSection title="Landmarks" count={landmarks.length} empty="No landmarks found.">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {landmarks.map((p) => (
                    <PlaceCard key={p.id} place={p} />
                  ))}
                </div>
              </SearchSection>
            )}

            {(tab === "all" || tab === "attractions") && (
              <SearchSection
                title="Attractions"
                count={attractions.length}
                empty="No attractions found."
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {attractions.map((p) => (
                    <PlaceCard key={p.id} place={p} />
                  ))}
                </div>
              </SearchSection>
            )}

            {tab === "places" && (
              <SearchSection title="All Places" count={places.length} empty="No places found.">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {places.map((p) => (
                    <PlaceCard key={p.id} place={p} />
                  ))}
                </div>
              </SearchSection>
            )}

            {(tab === "all" || tab === "locations") && (
              <SearchSection
                title="Google Locations"
                count={googleLocations.length}
                empty="No Google Maps locations found. Try a city, landmark, or attraction name."
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {googleLocations.map((loc) => (
                    <GoogleLocationCard key={loc.placeId} location={loc} />
                  ))}
                </div>
              </SearchSection>
            )}
          </>
        )}
      </div>
    </PublicLayout>
  );
}

function SearchSection({ title, count, empty, children }) {
  if (count === 0) {
    return (
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-fg)]">
          {title} (0)
        </h2>
        <p className="text-[var(--color-muted)]">{empty}</p>
      </section>
    );
  }

  return (
    <section className="mb-10">
      <h2 className="mb-4 text-lg font-semibold text-[var(--color-fg)]">
        {title} ({count})
      </h2>
      {children}
    </section>
  );
}
