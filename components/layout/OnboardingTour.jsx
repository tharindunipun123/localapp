"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Calendar, Wallet, Gift } from "lucide-react";

const SLIDES = [
  {
    icon: Calendar,
    title: "Discover events near you",
    body: "Dansal, shramadana, concerts, and cultural meetups — pin a place on the map or browse nearby.",
  },
  {
    icon: Wallet,
    title: "One wallet for cash and points",
    body: "Deposit LKR after KYC, send money to friends, and spend on tickets. Users cannot withdraw — vendors cash out.",
  },
  {
    icon: Gift,
    title: "Earn loyalty, enter the lottery",
    body: "Scan your rotating QR at a vendor, collect locked loyalty points, and use them for lottery tickets.",
  },
];

const KEY = "localapp_onboarded_v1";

export function OnboardingTour() {
  const { profile, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (loading || !profile) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(KEY)) return;
    setOpen(true);
  }, [profile, loading]);

  function finish() {
    window.localStorage.setItem(KEY, "1");
    setOpen(false);
  }

  if (!open) return null;
  const slide = SLIDES[step];
  const Icon = slide.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-[var(--color-card)] p-6 shadow-xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-secondary)] text-[var(--color-primary)]">
          <Icon className="h-6 w-6" />
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
          Welcome · {step + 1} / {SLIDES.length}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--color-fg)]">{slide.title}</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{slide.body}</p>
        <div className="mt-6 flex gap-2">
          {step < SLIDES.length - 1 ? (
            <Button className="w-full" onClick={() => setStep((s) => s + 1)}>
              Next
            </Button>
          ) : (
            <Button className="w-full" onClick={finish}>
              Start using Local App
            </Button>
          )}
        </div>
        <button type="button" onClick={finish} className="mt-3 w-full text-center text-xs text-[var(--color-muted)]">
          Skip
        </button>
      </div>
    </div>
  );
}
