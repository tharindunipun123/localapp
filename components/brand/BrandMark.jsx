import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export function BrandMark({ href = "/", compact = false, invert = false }) {
  const src = invert ? "/brand/logo-icon-on-blue.png" : "/brand/logo-icon.png";

  const mark = (
    <span className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 rounded-lg object-cover"
      />
      {!compact && (
        <span className="leading-tight">
          <span
            className={cn(
              "block text-sm font-semibold tracking-tight",
              invert ? "text-white" : "text-[var(--color-fg)]"
            )}
          >
            Local App
          </span>
          <span
            className={cn(
              "block text-[10px] font-semibold uppercase tracking-[0.16em]",
              invert ? "text-sky-200" : "text-[var(--color-primary)]"
            )}
          >
            Sri Lanka
          </span>
        </span>
      )}
    </span>
  );

  if (!href) return mark;
  return (
    <Link href={href} className="inline-flex items-center" aria-label="Local App Sri Lanka">
      {mark}
    </Link>
  );
}
