import { Suspense } from "react";
import MapPageContent from "./MapPageContent";

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary-light)] border-t-[var(--color-primary)]" />
        </div>
      }
    >
      <MapPageContent />
    </Suspense>
  );
}
