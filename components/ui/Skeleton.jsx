import { cn } from "@/lib/utils/cn";

export function Skeleton({ className }) {
  return <div className={cn("animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-border)]", className)} />;
}

export function EventCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-light)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-sm)]">
      <Skeleton className="mb-3 h-40 w-full" />
      <Skeleton className="mb-2 h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}
