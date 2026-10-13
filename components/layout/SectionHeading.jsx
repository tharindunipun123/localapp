import { cn } from "@/lib/utils/cn";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
  className,
}) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
