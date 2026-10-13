"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  MapPin,
  Star,
  Users,
  Wallet,
  Settings,
  FileText,
  Menu,
  X,
  Store,
  Gift,
  BadgeCheck,
  ShieldCheck,
  Ticket,
  Heart,
} from "lucide-react";
import { useState, useCallback } from "react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { BrandMark } from "@/components/brand/BrandMark";
import { cn } from "@/lib/utils/cn";
import { claimAdminRole } from "@/lib/services/cloudFunctions";
import { useAuth } from "@/providers/AuthProvider";
import { auth } from "@/lib/firebase/client";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/events", label: "Events", icon: Calendar },
  { href: "/admin/events/pending", label: "Pending Events", icon: Calendar },
  { href: "/admin/places", label: "Places", icon: MapPin },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/vendors", label: "Vendors", icon: Store },
  { href: "/admin/kyc", label: "KYC Queue", icon: BadgeCheck },
  { href: "/admin/chat-reports", label: "Chat reports", icon: FileText },
  { href: "/admin/promos", label: "Promo Codes", icon: Gift },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: Wallet },
  { href: "/admin/transactions", label: "Transactions", icon: Wallet },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/lottery", label: "Lottery", icon: Ticket },
  { href: "/admin/matrimonial", label: "Matrimonial", icon: Heart },
  { href: "/admin/audit", label: "Audit Logs", icon: FileText },
  { href: "/admin/broadcast", label: "Broadcast", icon: FileText },
];

export default function AdminLayout({ children }) {
  return (
    <RoleGuard roles={["admin"]} fallbackUrl="/">
      <AdminShell>{children}</AdminShell>
    </RoleGuard>
  );
}

function AdminShell({ children }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixMsg, setFixMsg] = useState("");
  const { refreshProfile } = useAuth();

  const fixAdminRole = useCallback(async () => {
    setFixing(true);
    setFixMsg("Setting admin role…");
    try {
      const result = await claimAdminRole();
      if (!result.promoted) {
        setFixMsg(result.message ?? "Could not promote");
        return;
      }
      setFixMsg("Custom claim set — refreshing token…");
      // Force the browser to get a new ID token with the admin:true claim
      await auth.currentUser?.getIdToken(true);
      await refreshProfile?.();
      setFixMsg("Done! Reloading…");
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setFixMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setFixing(false);
    }
  }, [refreshProfile]);

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform border-r border-[var(--color-border)] bg-[var(--color-card)] transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-[var(--color-border-light)] bg-[var(--color-ink)] px-4">
          <BrandMark href="/admin" compact invert />
          <Link href="/admin" className="text-sm font-semibold tracking-tight text-white">
            Ops
          </Link>
          <button
            type="button"
            className="ml-auto lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="space-y-0.5 p-3">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-[var(--radius-lg)] px-3 py-2 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-border-light)] hover:text-[var(--color-fg)]"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 space-y-2 border-t border-[var(--color-border-light)] p-3">
          <Link
            href="/"
            className="block text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)]"
          >
            ← Back to site
          </Link>
          <button
            type="button"
            onClick={fixAdminRole}
            disabled={fixing}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-[var(--color-muted)] hover:bg-[var(--color-border-light)] hover:text-[var(--color-primary)] disabled:opacity-50"
          >
            <ShieldCheck className="h-3 w-3 shrink-0" />
            {fixing ? "Fixing…" : "Fix admin role"}
          </button>
          {fixMsg && (
            <p className="px-2 text-xs text-[var(--color-muted)]">{fixMsg}</p>
          )}
          <LogoutButton variant="danger" />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-[var(--color-border)] bg-[var(--color-card)] px-4 lg:px-6">
          <button
            type="button"
            className="mr-3 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-medium text-[var(--color-muted)]">
            Local App Sri Lanka — Admin
          </h1>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}
    </div>
  );
}
