import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/wallet", label: "Wallet" },
      { href: "/kyc", label: "Identity" },
      { href: "/events", label: "Events" },
      { href: "/lottery", label: "Lottery" },
    ],
  },
  {
    title: "Discover",
    links: [
      { href: "/places", label: "Places" },
      { href: "/map", label: "Map" },
      { href: "/matrimonial", label: "Matrimonial" },
      { href: "/events/create", label: "Host an event" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/profile", label: "Profile" },
      { href: "/profile/family", label: "Family" },
      { href: "/tickets", label: "Tickets" },
      { href: "/vendor/dashboard", label: "Vendor portal" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--color-border-light)] bg-[var(--color-ink)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <BrandMark invert href="/" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/65">
              One ledger for wallets, identity, vendors, and local events across Sri Lanka.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                {col.title}
              </p>
              <nav className="mt-3 flex flex-col gap-2">
                {col.links.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-sm text-white/75 transition-colors hover:text-white"
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
          ))}
        </div>
        <p className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-white/45">
          &copy; {new Date().getFullYear()} Local App Sri Lanka. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
