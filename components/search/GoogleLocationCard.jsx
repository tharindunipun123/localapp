import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";

export function GoogleLocationCard({ location }) {
  const mapHref = `/map?lat=${location.lat}&lng=${location.lng}&zoom=14&q=${encodeURIComponent(location.name)}`;

  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-sm)]">
      <div className="relative aspect-[16/10] bg-[var(--color-primary-light)]">
        {location.photoUrl ? (
          <Image
            src={location.photoUrl}
            alt={location.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 33vw"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--color-primary)]">
            <MapPin className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-[var(--color-fg)]">{location.name}</h3>
        {location.address && (
          <p className="mt-1 line-clamp-2 text-sm text-[var(--color-muted)]">{location.address}</p>
        )}
        <Link
          href={mapHref}
          className="mt-3 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          View on map →
        </Link>
      </div>
    </div>
  );
}
