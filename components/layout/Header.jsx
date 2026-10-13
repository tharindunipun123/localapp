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
import { BrandMark } from "@/components/brand/BrandMark";

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
  const { profile, loading, firebaseUser } = useAuth();
  const firebaseEmailUnverified = Boolean(firebaseUser && !firebaseUser.emailVerified && firebaseUser.email);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border-light)] bg-[var(--color-secondary)]/90 backdrop-blur-md">
      {profile && firebaseEmailUnverified && (
        <div className="bg-[var(--color-warning-light)] px-4 py-2 text-center text-xs text-[var(--color-warning-fg)]">
          Verify your email to keep this account active.{" "}
          <button type="button" className="font-semibold underline" onClick={() => import("@/lib/firebase/auth").then((m) => m.sendEmailVerificationLink())}>
            Resend link
          </button>
        </div>
      )}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <BrandMark />

        <nav className="hidden items-center gap-0.5 lg:flex">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              prefetch
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

        <div className="flex items-center gap-1.5 sm:gap-2">
          {!loading && profile ? (
            <>
              {isAdmin(profile) && (
                <Link
                  href="/admin"
                  className="hidden items-center gap-1.5 rounded-[var(--radius-lg)] px-2 py-1.5 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] sm:flex"
                  title="Admin"
                >
                  <Shield className="h-4 w-4" />
                  <span className="hidden xl:inline">Admin</span>
                </Link>
              )}
              <Link
                href="/chat"
                className="relative rounded-[var(--radius-lg)] p-2 text-[var(--color-muted)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]"
                title="Messages"
              >
                <MessageCircle className="h-5 w-5" />
              </Link>
              <Link
                href="/wallet"
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)]"
                title="Wallet"
              >
                <Wallet className="h-3.5 w-3.5 text-sky-100" />
                Wallet
              </Link>
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-[var(--radius-lg)] px-2 py-1.5 text-sm font-medium text-[var(--color-fg)] hover:bg-[var(--color-primary-light)]"
              >
                <User className="h-5 w-5" />
                <span className="hidden max-w-[120px] truncate md:inline">
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
            className="rounded-[var(--radius-lg)] p-2 text-[var(--color-muted)] hover:bg-[var(--color-border-light)] lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-[var(--color-border-light)] bg-[var(--color-card)] px-4 py-3 lg:hidden">
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
                href="/profile/family"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-[var(--radius-lg)] px-3 py-2.5 text-sm text-[var(--color-muted)]"
              >
                Family account
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
