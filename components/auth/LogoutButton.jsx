"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout as firebaseLogout } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils/cn";

export function LogoutButton({
  className,
  variant = "ghost",
  showIcon = true,
  label = "Sign out",
  iconOnly = false,
  onLoggedOut,
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      await firebaseLogout();
      onLoggedOut?.();
      router.replace("/");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setLoading(false);
    }
  }

  const variants = {
    ghost:
      "text-[var(--color-muted)] hover:bg-[var(--color-border-light)] hover:text-[var(--color-fg)]",
    danger:
      "text-[var(--color-danger-fg)] hover:bg-[var(--color-danger-light)] border border-[var(--color-danger)]/20",
    primary:
      "bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)]",
    outline:
      "border border-[var(--color-border)] text-[var(--color-fg)] hover:bg-[var(--color-border-light)]",
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      title={iconOnly ? "Sign out" : undefined}
      aria-label={iconOnly ? "Sign out" : undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-lg)] text-sm font-medium transition-colors disabled:opacity-50",
        iconOnly ? "h-9 w-9 p-0" : "w-full px-3 py-2",
        variants[variant] ?? variants.ghost,
        className
      )}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        showIcon && <LogOut className="h-4 w-4" />
      )}
      {!iconOnly && (loading ? "Signing out…" : label)}
    </button>
  );
}
