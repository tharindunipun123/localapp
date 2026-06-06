"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Map,
  Search,
  User,
  Wallet,
  Menu,
  X,
  MapPin,
  Shield,
  Heart,
  MessageCircle,
  Ticket,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils/cn";
import { isAdmin } from "@/lib/firebase/auth";
import { LogoutButton } from "@/components/auth/LogoutButton";

const navLinks = [
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/places", label: "Places", icon: MapPin },
  { href: "/map", label: "Map", icon: Map },
  { href: "/search", label: "Search", icon: Search },
  { href: "/matrimonial", label: "Matrimonial", icon: Heart },
  { href: "/lottery", label: "Lottery", icon: Ticket },
];

export function Header() {
  const pathname = usePathname();
  const { profile, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border-light)] bg-[var(--color-card)]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold text-[var(--color-primary)]"
        >
          <MapPin className="h-5 w-5" />
          <span className="hidden sm:inline">Local App</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-[var(--radius-lg)] px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith(href)
                  ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-border-light)] hover:text-[var(--color-fg)]"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {!loading && profile ? (
            <>
              {isAdmin(profile) && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 rounded-[var(--radius-lg)] px-2 py-1.5 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
                  title="Admin Dashboard"
                >
                  <Shield className="h-5 w-5" />
                  <span className="hidden md:inline">Admin</span>
                </Link>
              )}
              <Link
                href="/chat"
                className="hidden rounded-[var(--radius-lg)] p-2 text-[var(--color-muted)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)] sm:block"
                title="Messages"
              >
                <MessageCircle className="h-5 w-5" />
              </Link>
              <Link
                href="/wallet"
                className="hidden rounded-[var(--radius-lg)] p-2 text-[var(--color-muted)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)] sm:block"
                title="Wallet"
              >
                <Wallet className="h-5 w-5" />
              </Link>
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-[var(--radius-lg)] px-2 py-1.5 text-sm font-medium text-[var(--color-fg)] hover:bg-[var(--color-primary-light)]"
              >
                <User className="h-5 w-5" />
                <span className="hidden max-w-[120px] truncate sm:inline">
                  {profile.displayName}
                </span>
              </Link>
              <LogoutButton iconOnly className="hidden sm:flex" />
            </>
          ) : (
            !loading && (
              <Link
                href="/login"
                className="rounded-[var(--radius-lg)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)]"
              >
                Sign in
              </Link>
            )
          )}
          <button
            type="button"
            className="rounded-[var(--radius-lg)] p-2 text-[var(--color-muted)] hover:bg-[var(--color-border-light)] md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-[var(--color-border-light)] bg-[var(--color-card)] px-4 py-3 md:hidden">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-[var(--radius-lg)] px-3 py-2.5 text-sm font-medium",
                pathname.startsWith(href)
                  ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                  : "text-[var(--color-muted)]"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          {profile && (
            <>
              <Link
                href="/chat"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-[var(--radius-lg)] px-3 py-2.5 text-sm text-[var(--color-muted)]"
              >
                <MessageCircle className="h-4 w-4" /> Messages
              </Link>
              <Link
                href="/wallet"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-[var(--radius-lg)] px-3 py-2.5 text-sm text-[var(--color-muted)]"
              >
                <Wallet className="h-4 w-4" /> Wallet
              </Link>
              {isAdmin(profile) && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-[var(--radius-lg)] px-3 py-2.5 text-sm text-[var(--color-muted)]"
                >
                  <Shield className="h-4 w-4" /> Admin
                </Link>
              )}
              <div className="mt-2 border-t border-[var(--color-border-light)] pt-2">
                <LogoutButton onLoggedOut={() => setMobileOpen(false)} />
              </div>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
