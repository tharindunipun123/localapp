import { cn } from "@/lib/utils/cn";

const overlayBySegment = {
  default: "from-[var(--color-ink)]/88 via-[var(--color-primary)]/55 to-[var(--color-accent)]/25",
  wallet: "from-[var(--color-ink)]/90 via-[var(--color-primary)]/58 to-[var(--color-accent)]/28",
  lottery: "from-[var(--color-ink)]/88 via-[var(--color-primary)]/52 to-[var(--color-accent)]/30",
  matrimonial: "from-[var(--color-ink)]/88 via-[var(--color-primary)]/55 to-[var(--color-accent)]/26",
  kyc: "from-[var(--color-ink)]/90 via-[var(--color-ink-soft)]/60 to-[var(--color-primary)]/28",
  family: "from-[var(--color-ink)]/88 via-[var(--color-primary)]/55 to-[var(--color-accent)]/26",
  places: "from-[var(--color-ink)]/86 via-[var(--color-primary)]/50 to-[var(--color-accent)]/28",
  events: "from-[var(--color-ink)]/88 via-[var(--color-primary)]/56 to-[var(--color-accent)]/28",
};

export function PageHero({
  eyebrow,
  title,
  subtitle,
  image,
  actions,
  compact = false,
  segment = "default",
}) {
  return (
    <section className="relative overflow-hidden">
      <div
        className={cn(
          "relative",
          compact ? "min-h-[220px] sm:min-h-[280px]" : "min-h-[340px] sm:min-h-[460px]"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-r",
            overlayBySegment[segment] ?? overlayBySegment.default
          )}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-ink)]/70 via-transparent to-transparent" />
        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-4 py-10 sm:px-6 sm:py-14">
          {eyebrow && (
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/90">
              {eyebrow}
            </p>
          )}
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-sky-50/90 sm:text-base">
              {subtitle}
            </p>
          )}
          {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
        </div>
      </div>
    </section>
  );
}
