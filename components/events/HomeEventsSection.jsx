"use client";

import { useEffect, useState } from "react";
import { EventCard } from "./EventCard";
import { PlaceCard } from "@/components/places/PlaceCard";
import { EventCardSkeleton } from "@/components/ui/Skeleton";
import {
  getFeaturedEvents,
  getTodayEvents,
  getNearbyEvents,
} from "@/lib/services/events";
import { getAttractions } from "@/lib/services/places";
import { DEFAULT_CENTER } from "@/lib/utils/geohash";

export function HomeEventsSection() {
  const [featured, setFeatured] = useState([]);
  const [today, setToday] = useState([]);
  const [nearby, setNearby] = useState([]);
  const [attractions, setAttractions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      let lat = DEFAULT_CENTER.lat;
      let lng = DEFAULT_CENTER.lng;

      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
            })
          );
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch {
          /* use default center */
        }
      }

      const [f, t, n, a] = await Promise.all([
        getFeaturedEvents(),
        getTodayEvents(),
        getNearbyEvents(lat, lng),
        getAttractions(6),
      ]);
      setFeatured(f);
      setToday(t);
      setNearby(n);
      setAttractions(a);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <>
      <Section title="Featured Events" subtitle="Hand-picked events across Sri Lanka">
        {loading ? (
          <GridSkeleton />
        ) : featured.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <Empty message="No featured events yet." />
        )}
      </Section>

      <Section title="Today's Events" subtitle="Happening today near you">
        {loading ? (
          <GridSkeleton />
        ) : today.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {today.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <Empty message="No events scheduled for today." />
        )}
      </Section>

      <Section title="Nearby Events" subtitle="Within 10 km of your location">
        {loading ? (
          <GridSkeleton />
        ) : nearby.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nearby.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <Empty message="No nearby events found." />
        )}
      </Section>

      <Section title="Top Attractions" subtitle="Explore Sri Lanka's best places">
        {loading ? (
          <GridSkeleton />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {attractions.map((p) => (
              <PlaceCard key={p.id} place={p} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[var(--color-fg)]">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}

function Empty({ message }) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border)] bg-[var(--color-card)] py-12 text-center text-[var(--color-muted)]">
      {message}
    </div>
  );
}
