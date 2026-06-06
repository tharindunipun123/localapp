import Link from "next/link";
import { MapPin } from "lucide-react";

const footerLinks = [
  { href: "/events", label: "Events" },
  { href: "/places", label: "Places" },
  { href: "/map", label: "Map" },
  { href: "/events/create", label: "Create Event" },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--color-border-light)] bg-[var(--color-card)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-bold text-[var(--color-primary)]"
            >
              <MapPin className="h-5 w-5" />
              Local App Sri Lanka
            </Link>
            <p className="mt-2 max-w-sm text-sm text-[var(--color-muted)]">
              Discover local events, landmarks, and attractions across Sri Lanka.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {footerLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-8 border-t border-[var(--color-border-light)] pt-6 text-center text-sm text-[var(--color-muted-fg)]">
          &copy; {new Date().getFullYear()} Local App Sri Lanka. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
