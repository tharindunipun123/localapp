"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { EventCard } from "@/components/events/EventCard";
import { EventCardSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { DiscoverSearchBar } from "@/components/search/DiscoverSearchBar";
import { getApprovedEvents, getNearbyEvents, searchEventsByTitle } from "@/lib/services/events";
import { filterByQuery } from "@/lib/services/unifiedSearch";
import { Plus } from "lucide-react";

const categories = [
  { value: "", label: "All categories" },
  { value: "musical", label: "Musical" },
  { value: "dansal", label: "Dansal" },
  { value: "shramadana", label: "Shramadana" },
  { value: "cultural", label: "Cultural" },
  { value: "sports", label: "Sports" },
  { value: "meetup", label: "Meetup" },
  { value: "matrimonial", label: "Matrimonial" },
  { value: "other", label: "Other" },
];

const EVENT_FILTER_FIELDS = ["title", "locationLabel", "description", "category", "tags"];

export default function EventsPageContent() {
  const searchParams = useSearchParams();
  const categoryFilter = searchParams.get("category") ?? "";
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(categoryFilter);
  const [textQuery, setTextQuery] = useState("");
  const [nearLocation, setNearLocation] = useState(null);

  useEffect(() => {
    loadDefault();
  }, []);

  async function loadDefault() {
    setLoading(true);
    setNearLocation(null);
    const { events: data } = await getApprovedEvents(24);
    setEvents(data);
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
        data = await getNearbyEvents(nearLocation.lat, nearLocation.lng, 25, 40);
        if (term) {
          data = filterByQuery(data, term, EVENT_FILTER_FIELDS);
        }
      } else {
        data = await searchEventsByTitle(term);
      }
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleLocationSelect(place) {
    setNearLocation(place);
    setLoading(true);
    try {
      let data = await getNearbyEvents(place.lat, place.lng, 25, 40);
      const term = textQuery.trim();
      if (term) {
        data = filterByQuery(data, term, EVENT_FILTER_FIELDS);
      }
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(
    () => (category ? events.filter((e) => e.category === category) : events),
    [events, category]
  );

  return (
    <PublicLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-fg)]">Events</h1>
            <p className="mt-1 text-[var(--color-muted)]">
              Discover happenings across Sri Lanka
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              options={categories}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-44"
            />
            <Link href="/events/create">
              <Button>
                <Plus className="h-4 w-4" /> Create
              </Button>
            </Link>
          </div>
        </div>

        <div className="mb-8">
          <DiscoverSearchBar
            textQuery={textQuery}
            onTextQueryChange={setTextQuery}
            onTextSearch={handleTextSearch}
            onLocationSelect={handleLocationSelect}
            loading={loading}
            textPlaceholder="Search events by title, location, category, tags…"
            locationPlaceholder="Or search a location in Sri Lanka to find nearby events…"
          />
          {nearLocation && (
            <p className="mt-2 text-sm text-[var(--color-primary)]">
              Showing events near <strong>{nearLocation.name}</strong>
            </p>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border)] py-16 text-center text-[var(--color-muted)]">
            No events found. Be the first to{" "}
            <Link
              href="/events/create"
              className="text-[var(--color-primary)] hover:underline"
            >
              create one
            </Link>
            .
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
