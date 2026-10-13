"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { PageHero } from "@/components/layout/PageHero";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { KycDocumentCapture } from "@/components/kyc/KycDocumentCapture";
import { useAuth } from "@/providers/AuthProvider";
import {
  getKycSubmission,
  startKycVerification,
  submitInAppKyc,
  refreshKycDecision,
} from "@/lib/services/kyc";
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
  const [hostedLoading, setHostedLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [selfieFile, setSelfieFile] = useState(null);
  const [result, setResult] = useState(null);
  const [identity, setIdentity] = useState({
    fullLegalName: "",
    nicNumber: "",
    dateOfBirth: "",
    phone: "",
    address: "",
    bankName: "",
    bankAccount: "",
  });

  useEffect(() => {
    if (!profile?.uid) return;
    getKycSubmission(profile.uid)
      .then(setSubmission)
      .catch(() => setSubmission(null))
      .finally(() => setChecking(false));
  }, [profile]);

  async function handleSubmitDocuments() {
    if (!profile?.uid) return;
    if (!frontFile || !selfieFile) {
      setError("Photograph the front of your ID and take a selfie to continue.");
      return;
    }
    if (!identity.fullLegalName || !identity.nicNumber || !identity.dateOfBirth || !identity.phone) {
      setError("Enter your legal name, NIC, date of birth, and phone number.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await submitInAppKyc({
        userId: profile.uid,
        frontFile,
        backFile,
        selfieFile,
        identity,
      });
      if (res?.fallbackUrl) {
        window.location.href = res.fallbackUrl;
        return;
      }
      setResult(res);
      await refreshProfile();
      const sub = await getKycSubmission(profile.uid).catch(() => null);
      setSubmission(sub);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify documents. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleHostedVerification() {
    setHostedLoading(true);
    setError("");
    try {
      const { url } = await startKycVerification();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start verification. Please try again.");
      setHostedLoading(false);
    }
  }

  async function handleRefresh() {
    setChecking(true);
    try {
      await refreshKycDecision().catch(() => null);
      await refreshProfile();
      if (profile?.uid) {
        const sub = await getKycSubmission(profile.uid).catch(() => null);
        setSubmission(sub);
      }
    } finally {
      setChecking(false);
    }
  }

  const approved = isKycApproved(profile);
  const showForm = !approved && submission?.status !== "pending";

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
      <PageHero
        compact
        segment="kyc"
        image="/images/hero-kyc.png"
        eyebrow="Compliance"
        title="Identity verification"
        subtitle="Photograph your National ID and take a live selfie. Didit checks the card, liveness, and face match."
      />
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="mb-6 text-sm text-[var(--color-muted)]">
          Required before wallet deposits, transfers, and ticket purchases.
        </p>

        {approved && (
          <Card className="mb-6 border-[var(--color-primary-light)] bg-[var(--color-secondary)]">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-[var(--color-primary)]" />
              <div>
                <p className="font-semibold text-[var(--color-primary)]">Identity Verified</p>
                <p className="text-sm text-[var(--color-muted)]">You can use all financial features.</p>
                {(submission?.extracted?.fullName || submission?.fullName) && (
                  <p className="mt-1 text-sm text-[var(--color-fg)]">
                    {submission.extracted?.fullName || submission.fullName}
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {!approved && submission?.status === "pending" && (
          <Card className="mb-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-warning-light)]">
                <Clock className="h-4 w-4 text-[var(--color-warning-fg)]" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[var(--color-fg)]">Verification in Progress</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {submission.diditStatus === "In Review"
                    ? "Your documents are under review. This usually takes a few minutes to 1–2 business days."
                    : submission.diditStatus === "In Progress"
                    ? "You've started verification — complete the ID and selfie steps."
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

        {submission?.status === "rejected" && (
          <Card className="mb-6 border-[var(--color-danger)]">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-danger-fg)]" />
              <div>
                <p className="font-semibold text-[var(--color-danger-fg)]">Verification Declined</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {submission.diditStatus === "Abandoned"
                    ? "Your session expired before completion."
                    : "The ID or selfie did not pass the identity check."}{" "}
                  Photograph the full card in good light and try again.
                </p>
              </div>
            </div>
          </Card>
        )}

        {result?.status === "approved" && !approved && (
          <Card className="mb-6 border-[var(--color-primary-light)]">
            <p className="text-sm font-medium text-[var(--color-primary)]">Didit approved your documents. Refreshing your account…</p>
          </Card>
        )}

        {showForm && (
          <Card>
            <CardHeader
              title="Verify with ID + selfie"
              subtitle="Didit reads the card (OCR), checks the photo is live, and matches your face to the ID portrait."
            />

            {error && (
              <div className="mb-4 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-light)] p-3 text-sm text-[var(--color-danger-fg)]">
                {error}
              </div>
            )}

            <div className="mb-4 rounded-lg bg-[var(--color-secondary)] p-4 text-sm text-[var(--color-muted)] space-y-1.5">
              <p className="font-medium text-[var(--color-fg)]">What you need</p>
              <p>• Sri Lankan National ID or passport — all four corners visible</p>
              <p>• Legal name, NIC, date of birth (18+), phone, and bank details</p>
              <p>• A live selfie in good light, face fully visible</p>
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              <Input
                label="Full legal name"
                value={identity.fullLegalName}
                onChange={(e) => setIdentity({ ...identity, fullLegalName: e.target.value })}
                required
              />
              <Input
                label="NIC number"
                placeholder="123456789V or 12 digits"
                value={identity.nicNumber}
                onChange={(e) => setIdentity({ ...identity, nicNumber: e.target.value })}
                required
              />
              <Input
                label="Date of birth"
                type="date"
                value={identity.dateOfBirth}
                onChange={(e) => setIdentity({ ...identity, dateOfBirth: e.target.value })}
                required
              />
              <Input
                label="Phone (+94 7X XXXXXXX)"
                value={identity.phone}
                onChange={(e) => setIdentity({ ...identity, phone: e.target.value })}
                required
              />
              <Input
                label="Address"
                value={identity.address}
                onChange={(e) => setIdentity({ ...identity, address: e.target.value })}
                className="sm:col-span-2"
              />
              <Input
                label="Bank name"
                value={identity.bankName}
                onChange={(e) => setIdentity({ ...identity, bankName: e.target.value })}
              />
              <Input
                label="Bank account number"
                value={identity.bankAccount}
                onChange={(e) => setIdentity({ ...identity, bankAccount: e.target.value })}
              />
            </div>

            <div className="space-y-4">
              <KycDocumentCapture
                label="ID front"
                hint="Photograph the photo side of your NIC or the passport bio page."
                facing="environment"
                file={frontFile}
                onChange={setFrontFile}
              />
              <KycDocumentCapture
                label="ID back (optional)"
                hint="Add the reverse of the NIC if you have it."
                facing="environment"
                file={backFile}
                onChange={setBackFile}
              />
              <KycDocumentCapture
                label="Live selfie"
                hint="Hold the phone at eye level. Look at the camera."
                facing="user"
                file={selfieFile}
                onChange={setSelfieFile}
              />
            </div>

            <Button onClick={handleSubmitDocuments} loading={loading} className="mt-5 w-full">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Submit for identity check
            </Button>

            <div className="relative my-5 text-center text-xs text-[var(--color-muted)]">
              <span className="bg-white px-2">or</span>
            </div>

            <Button
              variant="outline"
              onClick={handleHostedVerification}
              loading={hostedLoading}
              className="w-full"
            >
              Use Didit camera verification
            </Button>

            <p className="mt-3 text-center text-xs text-[var(--color-muted)]">
              Identity checks are processed by Didit (500 free KYC sessions / month). Your data is handled per their{" "}
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
