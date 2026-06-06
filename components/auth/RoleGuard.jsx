"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { isAdmin, hasRole, isVendorOrAdmin } from "@/lib/firebase/auth";

export function RoleGuard({
  children,
  roles,
  vendorAccess = false,
  requireAuth = true,
  fallbackUrl = "/login",
}) {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (requireAuth && !profile) {
      router.replace(fallbackUrl);
      return;
    }
    if (roles && profile && !hasRole(profile, roles)) {
      router.replace("/");
      return;
    }
    if (vendorAccess && profile && !isVendorOrAdmin(profile)) {
      router.replace("/vendor/onboarding");
    }
  }, [loading, profile, roles, vendorAccess, requireAuth, router, fallbackUrl]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary-light)] border-t-[var(--color-primary)]"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (requireAuth && !profile) return null;
  if (roles && profile && !hasRole(profile, roles)) return null;
  if (vendorAccess && profile && !isVendorOrAdmin(profile)) return null;

  return <>{children}</>;
}
