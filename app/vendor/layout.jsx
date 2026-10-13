"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Gift, ScanLine, Store, Menu, X, Wallet, Building2 } from "lucide-react";
import { useState } from "react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { BrandMark } from "@/components/brand/BrandMark";
import { cn } from "@/lib/utils/cn";

const links = [
  { href: "/vendor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vendor/loyalty", label: "Loyalty Programs", icon: Gift },
  { href: "/vendor/cashier", label: "Cashier", icon: ScanLine },
  { href: "/vendor/corporate", label: "Corporate", icon: Building2 },
  { href: "/vendor/withdrawals", label: "Withdrawals", icon: Wallet },
];

export default function VendorLayout({ children }) {
  const pathname = usePathname();

  if (pathname === "/vendor/onboarding") {
    return children;
  }

  return (
    <RoleGuard requireAuth vendorAccess>
      <VendorShell>{children}</VendorShell>
    </RoleGuard>
  );
}

function VendorShell({ children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <BrandMark href="/" compact />
            <Link href="/vendor/dashboard" className="flex items-center gap-2 text-sm font-semibold text-[var(--color-fg)]">
              <Store className="h-4 w-4 text-[var(--color-primary)]" /> Vendor
            </Link>
          </div>
          <nav className="hidden gap-1 md:flex">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-[var(--radius-lg)] px-3 py-2 text-sm font-medium",
                  pathname.startsWith(href)
                    ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            ))}
          </nav>
          <button type="button" className="md:hidden" onClick={() => setOpen(!open)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <nav className="border-t px-4 py-2 md:hidden">
            {links.map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className="block py-2 text-sm">
                {label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
