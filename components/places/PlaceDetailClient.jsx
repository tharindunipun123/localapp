"use client";

import { useEffect, useState } from "react";
import { MapPin, Star, Clock, Globe } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { MapView } from "@/components/maps/MapView";
import { ImageGallery } from "@/components/ui/ImageGallery";
import { EventCard } from "@/components/events/EventCard";
import { PlaceCard } from "@/components/places/PlaceCard";
import { useAuth } from "@/providers/AuthProvider";
import { geoPointToLatLng } from "@/lib/utils/geohash";
import { getEventsNearPlace } from "@/lib/services/events";
import {
  getReviewsForAttraction,
  createReview,
  reportReview,
} from "@/lib/services/reviews";
import { getAttractionsByLandmark } from "@/lib/services/places";
import { resolveImageUrl } from "@/lib/services/storage";
import { useRouter, useParams } from "next/navigation";

function deserializePlace(raw) {
  if (!raw) return null;

  const result = { ...raw };

  if (raw.coordinates?.latitude !== undefined) {
    result.coordinates = {
      latitude: raw.coordinates.latitude,
      longitude: raw.coordinates.longitude,
    };
  }

  return result;
}

export function PlaceDetailClient({ place: initialPlace, slug: slugProp }) {
  const params = useParams();
  const { profile } = useAuth();
  const router = useRouter();

  const slug = slugProp ?? params?.slug;
  const [placeData, setPlaceData] = useState(
    initialPlace ? deserializePlace(initialPlace) : null
  );
  const [loading, setLoading] = useState(!initialPlace && !!slug);
  const [nearbyEvents, setNearbyEvents] = useState([]);
  const [childAttractions, setChildAttractions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialPlace) return;

    let cancelled = false;

    import("@/lib/services/places").then(({ getPlaceBySlug }) => {
      getPlaceBySlug(slug).then((p) => {
        if (cancelled) return;
        setPlaceData(p);
        setLoading(false);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [initialPlace, slug]);

  useEffect(() => {
    if (!placeData) return;

    const coords = geoPointToLatLng(placeData.coordinates);
    getEventsNearPlace(coords.lat, coords.lng).then(setNearbyEvents);

    if (placeData.type === "landmark") {
      getAttractionsByLandmark(placeData.id).then(setChildAttractions);
    }
    if (placeData.type === "attraction") {
      getReviewsForAttraction(placeData.id).then(setReviews);
    }
  }, [placeData]);

  async function handleReview(e) {
    e.preventDefault();
    if (!profile || !placeData) {
      router.push("/login");
      return;
    }

    setSubmitting(true);
    await createReview({
      attractionId: placeData.id,
      userId: profile.uid,
      userDisplayName: profile.displayName,
      rating,
      comment,
    });
    const updated = await getReviewsForAttraction(placeData.id);
    setReviews(updated);
    setComment("");
    setSubmitting(false);
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

  if (!placeData) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-[var(--color-muted)]">
        Place not found.
      </div>
    );
  }

  const coords = geoPointToLatLng(placeData.coordinates);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ImageGallery
            images={placeData.images ?? []}
            alt={placeData.name}
            fallbackIcon={MapPin}
          />

          <div>
            <Badge label={placeData.type} status="approved" />
            <h1 className="mt-2 text-3xl font-bold text-[var(--color-fg)]">
              {placeData.name}
            </h1>
            <p className="mt-2 flex items-center gap-1.5 text-[var(--color-muted)]">
              <MapPin className="h-4 w-4" />
              {placeData.city}, {placeData.district}, {placeData.province}
            </p>
            {placeData.type === "attraction" && placeData.reviewCount > 0 && (
              <div className="mt-2 flex items-center gap-1 text-[var(--color-warning)]">
                <Star className="h-4 w-4 fill-current" />
                {placeData.averageRating.toFixed(1)} · {placeData.reviewCount} reviews
              </div>
            )}
          </div>

          <Card>
            <h2 className="mb-2 font-semibold text-[var(--color-fg)]">About</h2>
            <p className="whitespace-pre-wrap text-[var(--color-muted)]">
              {placeData.description}
            </p>
          </Card>

          {placeData.type === "attraction" && (
            <div className="grid gap-4 sm:grid-cols-2">
              {placeData.operatingHours && (
                <Card className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-[var(--color-primary)]" />
                  <div>
                    <p className="text-xs text-[var(--color-muted)]">Hours</p>
                    <p className="text-sm font-medium text-[var(--color-fg)]">
                      {placeData.operatingHours}
                    </p>
                  </div>
                </Card>
              )}
              {placeData.entryFee !== undefined && placeData.entryFee > 0 && (
                <Card>
                  <p className="text-xs text-[var(--color-muted)]">Entry Fee</p>
                  <p className="text-sm font-medium text-[var(--color-fg)]">
                    LKR {placeData.entryFee.toLocaleString()}
                  </p>
                </Card>
              )}
              {placeData.websiteUrl && (
                <Card className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-[var(--color-primary)]" />
                  <a
                    href={placeData.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--color-primary)] hover:underline"
                  >
                    Visit website
                  </a>
                </Card>
              )}
            </div>
          )}

          <Card padding={false}>
            <MapView
              lat={coords.lat}
              lng={coords.lng}
              zoom={14}
              className="h-72 w-full rounded-[var(--radius-xl)]"
              interactive={false}
              markers={[
                {
                  id: placeData.id,
                  lat: coords.lat,
                  lng: coords.lng,
                  title: placeData.name,
                  subtitle: `${placeData.city}, ${placeData.district}`,
                  imageUrl: resolveImageUrl(placeData.images?.[0]),
                  type: placeData.type,
                  href: `/places/${placeData.seoSlug}`,
                },
              ]}
            />
          </Card>

          {placeData.type === "attraction" && (
            <Card>
              <h2 className="mb-4 font-semibold text-[var(--color-fg)]">Reviews</h2>
              {reviews.length > 0 ? (
                <div className="mb-6 space-y-4">
                  {reviews.map((r) => (
                    <div
                      key={r.id}
                      className="border-b border-[var(--color-border-light)] pb-4 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex text-[var(--color-warning)]">
                          {Array.from({ length: r.rating }).map((_, i) => (
                            <Star key={i} className="h-3.5 w-3.5 fill-current" />
                          ))}
                        </div>
                        <span className="text-sm font-medium text-[var(--color-fg)]">
                          {r.userDisplayName ?? "Anonymous"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">{r.comment}</p>
                      {profile && profile.uid !== r.userId && (
                        <button
                          type="button"
                          onClick={() => reportReview(r.id)}
                          className="mt-1 text-xs text-[var(--color-muted-fg)] hover:text-[var(--color-danger)]"
                        >
                          Report
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-4 text-sm text-[var(--color-muted)]">No reviews yet.</p>
              )}
              <form
                onSubmit={handleReview}
                className="space-y-3 border-t border-[var(--color-border-light)] pt-4"
              >
                <div>
                  <label className="text-sm font-medium text-[var(--color-fg)]">
                    Rating
                  </label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="ml-2 rounded-[var(--radius-md)] border border-[var(--color-input)] bg-[var(--color-card)] px-2 py-1 text-sm text-[var(--color-fg)]"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} stars
                      </option>
                    ))}
                  </select>
                </div>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share your experience..."
                  required
                />
                <Button type="submit" loading={submitting}>
                  Submit Review
                </Button>
              </form>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {nearbyEvents.length > 0 && (
            <div>
              <h3 className="mb-3 font-semibold text-[var(--color-fg)]">Nearby Events</h3>
              <div className="space-y-3">
                {nearbyEvents.slice(0, 5).map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {placeData.type === "landmark" && childAttractions.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-bold text-[var(--color-fg)]">
            Attractions in this area
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {childAttractions.map((a) => (
              <PlaceCard key={a.id} place={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
