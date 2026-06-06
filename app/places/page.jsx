import { Suspense } from "react";
import PlacesPageContent from "./PlacesPageContent";
import { EventCardSkeleton } from "@/components/ui/Skeleton";

export default function PlacesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      }
    >
      <PlacesPageContent />
    </Suspense>
  );
}
