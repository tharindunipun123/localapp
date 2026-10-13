"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Map, Wallet, User, Home } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const tabs = [
  { href: "/", label: "Home", icon: Home, match: (p) => p === "/" },
  { href: "/events", label: "Events", icon: Calendar, match: (p) => p.startsWith("/events") },
  { href: "/map", label: "Map", icon: Map, match: (p) => p.startsWith("/map") || p.startsWith("/places") },
  { href: "/wallet", label: "Wallet", icon: Wallet, match: (p) => p.startsWith("/wallet") },
  { href: "/profile", label: "Profile", icon: User, match: (p) => p.startsWith("/profile") },
];

export function MobileTabBar() {
  const pathname = usePathname() ?? "/";
  if (pathname.startsWith("/admin") || pathname.startsWith("/vendor") || pathname.startsWith("/chat/")) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border-light)] bg-[var(--color-card)]/95 backdrop-blur md:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto flex h-16 max-w-lg items-stretch justify-around px-1">
        {tabs.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                prefetch
                className={cn(
                  "flex h-full min-w-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-[var(--color-primary)]" : "text-[var(--color-muted)]"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
