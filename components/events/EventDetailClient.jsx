"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  Calendar,
  MapPin,
  ExternalLink,
  MessageCircle,
  Ticket,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MapView } from "@/components/maps/MapView";
import { ImageGallery } from "@/components/ui/ImageGallery";
import { EventCard } from "@/components/events/EventCard";
import { useAuth } from "@/providers/AuthProvider";
import { Input } from "@/components/ui/Input";
import { purchaseTicket } from "@/lib/services/wallet";
import { validatePromoCode } from "@/lib/services/promo";
import { geoPointToLatLng } from "@/lib/utils/geohash";
import { getEventsNearPlace } from "@/lib/services/events";
import { resolveImageUrl } from "@/lib/services/storage";
import { Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

function deserializeEvent(raw) {
  if (!raw) return null;

  const result = { ...raw };

  if (raw.startDatetime?.seconds !== undefined) {
    result.startDatetime = new Timestamp(
      raw.startDatetime.seconds,
      raw.startDatetime.nanoseconds ?? 0
    );
  }
  if (raw.endDatetime?.seconds !== undefined) {
    result.endDatetime = new Timestamp(
      raw.endDatetime.seconds,
      raw.endDatetime.nanoseconds ?? 0
    );
  }
  if (raw.location?.latitude !== undefined) {
    result.location = {
      latitude: raw.location.latitude,
      longitude: raw.location.longitude,
    };
  }

  return result;
}

export function EventDetailClient({ event: initialEvent, slug: slugProp }) {
  const router = useRouter();
  const params = useParams();
  const { profile } = useAuth();

  const slug = slugProp ?? params?.slug;
  const [eventData, setEventData] = useState(
    initialEvent ? deserializeEvent(initialEvent) : null
  );
  const [loading, setLoading] = useState(!initialEvent && !!slug);
  const [nearby, setNearby] = useState([]);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(null);

  useEffect(() => {
    if (initialEvent) return;

    let cancelled = false;

    import("@/lib/services/events").then(({ getEventBySlug }) => {
      getEventBySlug(slug).then((e) => {
        if (cancelled) return;
        if (e && (e.status === "approved" || e.status === "expired")) {
          setEventData(e);
        }
        setLoading(false);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [initialEvent, slug]);

  useEffect(() => {
    if (!eventData) return;

    const coords = geoPointToLatLng(eventData.location);
    getEventsNearPlace(coords.lat, coords.lng).then((events) =>
      setNearby(events.filter((e) => e.id !== eventData.id).slice(0, 3))
    );
  }, [eventData]);

  async function handleApplyPromo() {
    if (!promoCode.trim() || !eventData?.ticketPrice) return;
    setError("");
    try {
      const result = await validatePromoCode({
        code: promoCode.trim(),
        purchaseAmount: eventData.ticketPrice,
        context: "events",
      });
      setPromoDiscount(result.discount);
    } catch (err) {
      setPromoDiscount(null);
      setError(err instanceof Error ? err.message : "Invalid promo code");
    }
  }

  async function handleBuyTicket() {
    if (!profile) {
      router.push("/login");
      return;
    }
    if (!eventData) return;

    setBuying(true);
    setError("");
    try {
      const { ticketId } = await purchaseTicket(eventData.id, 1, promoCode.trim() || undefined);
      router.push(`/tickets/${ticketId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to purchase ticket");
    } finally {
      setBuying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary-light)] border-t-[var(--color-primary)]"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-[var(--color-muted)]">
        Event not found or not yet approved.
      </div>
    );
  }

  const coords = geoPointToLatLng(eventData.location);
  const start = eventData.startDatetime?.toDate?.() ?? new Date();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ImageGallery
            images={eventData.images ?? []}
            alt={eventData.title}
            fallbackIcon={Calendar}
          />

          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge label={eventData.category} status={eventData.category} />
              <Badge
                label={eventData.eventType.replace("_", " ")}
                status={eventData.eventType}
              />
              {eventData.isFeatured && <Badge label="Featured" status="approved" />}
            </div>
            <h1 className="text-3xl font-bold text-[var(--color-fg)]">{eventData.title}</h1>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--color-muted)]">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {format(start, "EEEE, MMMM d, yyyy · h:mm a")}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {eventData.locationLabel}
              </span>
            </div>
          </div>

          <Card>
            <h2 className="mb-2 font-semibold text-[var(--color-fg)]">About</h2>
            <p className="whitespace-pre-wrap text-[var(--color-muted)]">
              {eventData.description}
            </p>
            {eventData.tags?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {eventData.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-[var(--color-primary-light)] px-2.5 py-0.5 text-xs text-[var(--color-primary)]"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card padding={false}>
            <MapView
              lat={coords.lat}
              lng={coords.lng}
              zoom={14}
              className="h-72 w-full rounded-[var(--radius-xl)]"
              interactive={false}
              markers={[
                {
                  id: eventData.id,
                  lat: coords.lat,
                  lng: coords.lng,
                  title: eventData.title,
                  subtitle: eventData.locationLabel,
                  imageUrl: resolveImageUrl(eventData.images?.[0]),
                  type: "event",
                  href: `/events/${eventData.seoSlug}`,
                },
              ]}
            />
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="mb-4 font-semibold text-[var(--color-fg)]">Actions</h3>
            {error && (
              <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>
            )}
            {eventData.eventType === "free" && (
              <p className="mb-3 font-medium text-[var(--color-success)]">
                Free event — no ticket required
              </p>
            )}
            {eventData.eventType === "paid_external" && eventData.externalLink && (
              <a
                href={eventData.externalLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="w-full">
                  <ExternalLink className="h-4 w-4" /> Go to Buy
                </Button>
              </a>
            )}
            {eventData.eventType === "paid_inapp" && (
              <div>
                <p className="mb-3 text-lg font-bold text-[var(--color-fg)]">
                  LKR {eventData.ticketPrice?.toLocaleString()}
                  {promoDiscount != null && (
                    <span className="ml-2 text-sm font-normal text-[var(--color-success)]">
                      − LKR {promoDiscount} with promo
                    </span>
                  )}
                </p>
                <div className="mb-3 flex gap-2">
                  <Input
                    placeholder="Promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={handleApplyPromo}>Apply</Button>
                </div>
                <Button className="w-full" onClick={handleBuyTicket} loading={buying}>
                  <Ticket className="h-4 w-4" /> Buy Ticket
                </Button>
              </div>
            )}
            {eventData.chatEnabled && (
              <Link href={`/events/${eventData.seoSlug}/chat`} className="mt-3 block">
                <Button variant="outline" className="w-full">
                  <MessageCircle className="h-4 w-4" /> Event Chat
                </Button>
              </Link>
            )}
          </Card>
        </div>
      </div>

      {nearby.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-bold text-[var(--color-fg)]">Nearby Events</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nearby.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
