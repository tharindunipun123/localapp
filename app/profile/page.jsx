"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { UserAvatar } from "@/components/chat/UserAvatar";
import { useAuth } from "@/providers/AuthProvider";
import { Calendar, Ticket, Wallet, Plus, Shield, Store, QrCode, BadgeCheck, Building2 } from "lucide-react";
import { isVendorOrAdmin, isAdmin } from "@/lib/firebase/auth";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default function ProfilePage() {
  return (
    <RoleGuard requireAuth>
      <ProfileContent />
    </RoleGuard>
  );
}

function ProfileContent() {
  const { profile, firebaseUser, refreshProfile } = useAuth();
  const [showPhoto, setShowPhoto] = useState(false);

  useEffect(() => {
    refreshProfile?.();
  }, [refreshProfile]);

  const links = [
    ...(isAdmin(profile)
      ? [{ href: "/admin", label: "Admin Dashboard", icon: Shield, highlight: true }]
      : []),
    { href: "/profile/events", label: "My Events", icon: Calendar },
    { href: "/tickets", label: "My Tickets", icon: Ticket },
    { href: "/wallet", label: "Wallet", icon: Wallet },
    { href: "/profile/qr", label: "My QR Code", icon: QrCode },
    { href: "/kyc", label: "KYC Verification", icon: BadgeCheck },
    { href: "/profile/corporate", label: "Corporate Binding", icon: Building2 },
    { href: "/events/create", label: "Create Event", icon: Plus },
  ];

  return (
    <PublicLayout>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Card>
          <CardHeader title="Profile" subtitle="Manage your account" />
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => profile?.photoURL && setShowPhoto(true)}
              className={profile?.photoURL ? "cursor-zoom-in" : "cursor-default"}
              aria-label={profile?.photoURL ? "View profile photo" : undefined}
            >
              <UserAvatar user={profile} size="lg" />
            </button>
            <div>
              <p className="text-lg font-semibold text-[var(--color-fg)]">
                {profile?.displayName ?? "User"}
              </p>
              <p className="text-sm text-[var(--color-muted)]">
                {firebaseUser?.email ?? profile?.email}
              </p>
              <Badge label={profile?.role ?? "user"} status="approved" />
            </div>
          </div>
        </Card>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {links.map(({ href, label, icon: Icon, highlight }) => (
            <Link key={href} href={href}>
              <Card
                className={`flex items-center gap-3 transition-shadow hover:shadow-[var(--shadow-md)] ${
                  highlight ? "border-[var(--color-primary-light)] bg-[var(--color-secondary)]" : ""
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] ${
                    highlight
                      ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]"
                      : "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`font-medium ${highlight ? "text-[var(--color-primary)]" : "text-[var(--color-fg)]"}`}>
                  {label}
                </span>
              </Card>
            </Link>
          ))}
        </div>

        {isVendorOrAdmin(profile) ? (
          <Link href="/vendor/dashboard" className="mt-3 block">
            <Card className="flex items-center gap-3 border-[var(--color-primary-light)]">
              <Store className="h-5 w-5 text-[var(--color-primary)]" />
              <span className="font-medium text-[var(--color-primary)]">Vendor Dashboard</span>
            </Card>
          </Link>
        ) : (
          <Link href="/vendor/onboarding" className="mt-3 block">
            <Card className="flex items-center gap-3">
              <Store className="h-5 w-5 text-[var(--color-muted)]" />
              <span className="font-medium text-[var(--color-fg)]">Register as Vendor</span>
            </Card>
          </Link>
        )}

        <div className="mt-6">
          <LogoutButton variant="outline" />
        </div>
      </div>

      {showPhoto && profile?.photoURL && (
        <ImageLightbox images={[profile.photoURL]} onClose={() => setShowPhoto(false)} />
      )}
    </PublicLayout>
  );
}
