import Link from "next/link";
import Image from "next/image";
import { Calendar, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { resolveImageUrl } from "@/lib/services/storage";
import { format } from "date-fns";

function getEventStart(event) {
  if (event.startDatetime?.toDate) return event.startDatetime.toDate();
  if (event.startDatetime) return new Date(event.startDatetime);
  return new Date(0);
}

export function EventCard({ event }) {
  const start = getEventStart(event);
  const image = resolveImageUrl(event.images?.[0]);

  return (
    <Link href={`/events/${event.seoSlug}`}>
      <Card
        className="group overflow-hidden p-0 transition-shadow hover:shadow-[var(--shadow-md)]"
        padding={false}
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-[var(--color-primary-light)]">
          {image ? (
            <Image
              src={image}
              alt={event.title}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[var(--color-accent)]">
              <Calendar className="h-12 w-12" />
            </div>
          )}
          <div className="absolute left-3 top-3 flex gap-1.5">
            <Badge label={event.category} status={event.category} />
            <Badge label={event.eventType.replace("_", " ")} status={event.eventType} />
          </div>
        </div>
        <div className="p-4">
          <h3 className="line-clamp-2 font-semibold text-[var(--color-fg)] group-hover:text-[var(--color-primary)]">
            {event.title}
          </h3>
          <div className="mt-2 flex items-center gap-1.5 text-sm text-[var(--color-muted)]">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            {format(start, "EEE, MMM d · h:mm a")}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-[var(--color-muted)]">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">{event.locationLabel}</span>
            {event.distanceKm !== undefined && (
              <span className="ml-auto shrink-0 text-[var(--color-primary)]">
                {event.distanceKm.toFixed(1)} km
              </span>
            )}
          </div>
          {event.maxAttendees && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-muted-fg)]">
              <Users className="h-3.5 w-3.5" />
              Max {event.maxAttendees} attendees
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
