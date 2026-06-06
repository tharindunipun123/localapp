"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useAuth } from "@/providers/AuthProvider";
import { getKycSubmission } from "@/lib/services/kyc";
import { ShieldCheck, Clock, AlertCircle, Loader2 } from "lucide-react";

export default function KycCompletePage() {
  const { profile, refreshProfile } = useAuth();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!profile?.uid) return;

    async function checkStatus() {
      // Didit may still be processing; poll Firestore for up to 15 s
      let attempts = 0;
      while (attempts < 5) {
        await refreshProfile();
        const sub = await getKycSubmission(profile.uid).catch(() => null);
        if (sub?.status === "approved") { setStatus("approved"); return; }
        if (sub?.status === "rejected") { setStatus("rejected"); return; }
        if (sub?.diditStatus === "In Review") { setStatus("in_review"); return; }
        attempts++;
        await new Promise((r) => setTimeout(r, 3000));
      }
      setStatus("pending");
    }

    checkStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid]);

  const sessionId = searchParams?.get("session_id");

  return (
    <PublicLayout>
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-[var(--color-primary)]" />
            <h1 className="text-xl font-semibold text-[var(--color-fg)]">Processing your verification…</h1>
            <p className="mt-2 text-sm text-[var(--color-muted)]">Please wait while we confirm your results.</p>
          </>
        )}

        {status === "approved" && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <ShieldCheck className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-fg)]">Identity Verified!</h1>
            <p className="mt-2 text-[var(--color-muted)]">
              Your identity has been successfully verified. You now have full access to all financial features.
            </p>
            <Link href="/wallet" className="mt-6 inline-block rounded-lg bg-[var(--color-primary)] px-6 py-2 text-sm font-medium text-white hover:opacity-90">
              Go to Wallet
            </Link>
          </>
        )}

        {status === "in_review" && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-fg)]">Under Manual Review</h1>
            <p className="mt-2 text-[var(--color-muted)]">
              Your documents have been submitted and are being reviewed by our team.
              This usually takes 1–2 business days. You&apos;ll receive a notification once approved.
            </p>
            <Link href="/" className="mt-6 inline-block rounded-lg bg-[var(--color-primary)] px-6 py-2 text-sm font-medium text-white hover:opacity-90">
              Back to Home
            </Link>
          </>
        )}

        {status === "pending" && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-fg)]">Verification Submitted</h1>
            <p className="mt-2 text-[var(--color-muted)]">
              Your verification is being processed. We&apos;ll update your status shortly.
              You can check back on your{" "}
              <Link href="/kyc" className="text-[var(--color-primary)] hover:underline">KYC page</Link>.
            </p>
            <Link href="/" className="mt-6 inline-block rounded-lg bg-[var(--color-primary)] px-6 py-2 text-sm font-medium text-white hover:opacity-90">
              Back to Home
            </Link>
          </>
        )}

        {status === "rejected" && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-fg)]">Verification Unsuccessful</h1>
            <p className="mt-2 text-[var(--color-muted)]">
              Unfortunately your verification did not pass. Please try again with a clearer ID document and selfie.
            </p>
            <Link href="/kyc" className="mt-6 inline-block rounded-lg bg-[var(--color-primary)] px-6 py-2 text-sm font-medium text-white hover:opacity-90">
              Try Again
            </Link>
          </>
        )}

        {sessionId && (
          <p className="mt-4 text-xs text-[var(--color-muted)]">Session: {sessionId}</p>
        )}
      </div>
    </PublicLayout>
  );
}
