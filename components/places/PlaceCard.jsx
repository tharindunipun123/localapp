import Link from "next/link";
import Image from "next/image";
import { MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { resolveImageUrl } from "@/lib/services/storage";

export function PlaceCard({ place }) {
  const image = resolveImageUrl(place.images?.[0]);

  return (
    <Link href={`/places/${place.seoSlug}`}>
      <Card
        className="group overflow-hidden p-0 transition-shadow hover:shadow-[var(--shadow-md)]"
        padding={false}
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-[var(--color-primary-light)]">
          {image ? (
            <Image
              src={image}
              alt={place.name}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[var(--color-accent)]">
              <MapPin className="h-10 w-10" />
            </div>
          )}
          <div className="absolute left-3 top-3">
            <Badge label={place.type} status="approved" />
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-[var(--color-fg)] group-hover:text-[var(--color-primary)]">
            {place.name}
          </h3>
          <p className="mt-1 line-clamp-1 text-sm text-[var(--color-muted)]">
            {place.city}, {place.district}
          </p>
          {place.type === "attraction" && place.reviewCount > 0 && (
            <div className="mt-2 flex items-center gap-1 text-sm text-[var(--color-warning)]">
              <Star className="h-3.5 w-3.5 fill-current" />
              {place.averageRating.toFixed(1)} ({place.reviewCount})
            </div>
          )}
          {place.distanceKm !== undefined && (
            <p className="mt-1 text-xs text-[var(--color-primary)]">
              {place.distanceKm.toFixed(1)} km away
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}
