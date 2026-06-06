"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/providers/AuthProvider";
import { getKycSubmission, startKycVerification } from "@/lib/services/kyc";
import { isKycApproved } from "@/lib/firebase/auth";
import { ShieldCheck, Clock, AlertCircle, ExternalLink, RefreshCw } from "lucide-react";

export default function KycPage() {
  return (
    <RoleGuard requireAuth>
      <KycContent />
    </RoleGuard>
  );
}

function KycContent() {
  const { profile, refreshProfile } = useAuth();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;
    getKycSubmission(profile.uid)
      .then(setSubmission)
      .catch(() => setSubmission(null))
      .finally(() => setChecking(false));
  }, [profile]);

  async function handleStartVerification() {
    setLoading(true);
    setError("");
    try {
      const { url } = await startKycVerification();
      // Redirect the user to Didit's hosted verification page
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start verification. Please try again.");
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setChecking(true);
    await refreshProfile();
    if (profile?.uid) {
      const sub = await getKycSubmission(profile.uid).catch(() => null);
      setSubmission(sub);
    }
    setChecking(false);
  }

  const approved = isKycApproved(profile);

  if (checking) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-xl px-4 py-16 text-center text-[var(--color-muted)]">
          Checking verification status…
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold text-[var(--color-fg)]">Identity Verification (KYC)</h1>
        <p className="mb-6 text-sm text-[var(--color-muted)]">
          Required before wallet deposits, transfers, and ticket purchases.
          Verification is powered by{" "}
          <a href="https://didit.me" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
            Didit
          </a>
          {" "}— a secure, privacy-first identity platform.
        </p>

        {/* Approved */}
        {approved && (
          <Card className="mb-6 border-[var(--color-primary-light)] bg-[var(--color-secondary)]">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-[var(--color-primary)]" />
              <div>
                <p className="font-semibold text-[var(--color-primary)]">Identity Verified</p>
                <p className="text-sm text-[var(--color-muted)]">You can use all financial features.</p>
              </div>
            </div>
          </Card>
        )}

        {/* Pending / In Review */}
        {!approved && submission?.status === "pending" && (
          <Card className="mb-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-100">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[var(--color-fg)]">Verification in Progress</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {submission.diditStatus === "In Review"
                    ? "Your documents are under manual review by our team. This usually takes 1–2 business days."
                    : submission.diditStatus === "In Progress"
                    ? "You've started verification — please complete it using the link below."
                    : "Your submission is being processed. This usually takes a few minutes."}
                </p>

                {submission.diditStatus === "In Progress" && submission.sessionId && (
                  <a
                    href={`https://verify.didit.me/session/${submission.sessionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
                  >
                    Continue verification <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}

                <button
                  onClick={handleRefresh}
                  className="mt-3 flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                >
                  <RefreshCw className="h-3 w-3" /> Check status
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* Rejected */}
        {submission?.status === "rejected" && (
          <Card className="mb-6 border-[var(--color-danger)]">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-danger-fg)]" />
              <div>
                <p className="font-semibold text-[var(--color-danger-fg)]">Verification Declined</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {submission.diditStatus === "Abandoned"
                    ? "Your session expired before completion."
                    : "Your verification was not successful."}{" "}
                  Please start a new verification below.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Start / Restart verification */}
        {!approved && submission?.status !== "pending" && (
          <Card>
            <CardHeader
              title="Verify your identity"
              subtitle="You'll be guided through a quick document + selfie check on Didit's secure platform."
            />

            {error && (
              <div className="mb-4 rounded-lg border border-[var(--color-danger)] bg-red-50 p-3 text-sm text-[var(--color-danger-fg)]">
                {error}
              </div>
            )}

            <div className="mb-4 rounded-lg bg-[var(--color-secondary)] p-4 text-sm text-[var(--color-muted)] space-y-1.5">
              <p className="font-medium text-[var(--color-fg)]">What you&apos;ll need:</p>
              <p>• A valid National ID card or Passport</p>
              <p>• A selfie / front-facing camera</p>
              <p>• Good lighting and a clear background</p>
            </div>

            <Button
              onClick={handleStartVerification}
              loading={loading}
              className="w-full"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Start Identity Verification
            </Button>

            <p className="mt-3 text-center text-xs text-[var(--color-muted)]">
              You will be taken to Didit&apos;s secure verification page. Your data is handled per their{" "}
              <a href="https://didit.me/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline">
                Privacy Policy
              </a>
              .
            </p>
          </Card>
        )}

        <p className="mt-6 text-center text-sm">
          <Link href="/wallet" className="text-[var(--color-primary)] hover:underline">← Back to wallet</Link>
        </p>
      </div>
    </PublicLayout>
  );
}
