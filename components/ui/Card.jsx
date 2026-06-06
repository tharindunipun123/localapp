import { cn } from "@/lib/utils/cn";

export function Card({ children, className, padding = true }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] border border-[var(--color-border-light)] bg-[var(--color-card)] shadow-[var(--shadow-sm)]",
        padding && "p-4 sm:p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-[var(--color-fg)]">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>}
    </div>
  );
}
