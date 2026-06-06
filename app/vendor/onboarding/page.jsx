"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { PhoneVerify } from "@/components/auth/PhoneVerify";
import { useAuth } from "@/providers/AuthProvider";
import { sendEmailVerificationLink } from "@/lib/firebase/auth";
import { submitVendorApplication, uploadVendorRegistrationPdf } from "@/lib/services/vendors";
import { syncVerificationStatus } from "@/lib/services/cloudFunctions";
import { isVendorOrAdmin } from "@/lib/firebase/auth";
import { useRouter } from "next/navigation";
import { Mail, Phone, Building2, CheckCircle, ShieldCheck, AlertTriangle } from "lucide-react";

const TOTAL_STEPS = 5; // 1-intro, 2-email, 3-phone, 4-kyc, 5-business, then submitted

const categories = [
  { value: "retail", label: "Retail" },
  { value: "restaurant", label: "Restaurant / Café" },
  { value: "hotel", label: "Hotel / Hospitality" },
  { value: "entertainment", label: "Entertainment" },
  { value: "services", label: "Services" },
  { value: "other", label: "Other" },
];

export default function VendorOnboardingPage() {
  return (
    <RoleGuard requireAuth>
      <OnboardingContent />
    </RoleGuard>
  );
}

function OnboardingContent() {
  const { profile, firebaseUser, refreshProfile } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    category: "retail",
    address: "",
    phone: "",
    email: profile?.email ?? "",
    website: "",
    description: "",
    businessRegistrationNumber: "",
  });
  const [registrationPdf, setRegistrationPdf] = useState(null);

  useEffect(() => {
    if (profile && isVendorOrAdmin(profile)) {
      router.replace("/vendor/dashboard");
    }
  }, [profile, router]);

  useEffect(() => {
    if (profile?.vendorStatus === "pending" || profile?.vendorStatus === "approved") {
      setStep(6);
    }
  }, [profile]);

  async function handleSendEmail() {
    setLoading(true);
    setError("");
    try {
      await sendEmailVerificationLink();
      setEmailSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setLoading(false);
    }
  }

  async function checkEmailVerified() {
    setLoading(true);
    try {
      await firebaseUser?.reload();
      await syncVerificationStatus();
      await refreshProfile?.();
      if (firebaseUser?.emailVerified) setStep(3);
      else setError("Email not verified yet — check your inbox and click the link.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!registrationPdf) {
      setError("Upload your business registration PDF");
      return;
    }
    if (!form.businessRegistrationNumber.trim()) {
      setError("Business registration number is required");
      return;
    }
    if (registrationPdf.type !== "application/pdf") {
      setError("Business registration must be a PDF file");
      return;
    }
    if (registrationPdf.size > 15 * 1024 * 1024) {
      setError("PDF must be under 15 MB");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const registrationPdfPath = await uploadVendorRegistrationPdf(firebaseUser.uid, registrationPdf);
      await submitVendorApplication({ ...form, registrationPdfPath });
      await refreshProfile?.();
      setStep(6);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  }

  const kycStatus = profile?.kycStatus ?? "none";
  const kycApproved = kycStatus === "approved";

  return (
    <PublicLayout>
      <div className="mx-auto max-w-xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold text-[var(--color-fg)]">Become a Vendor</h1>
        <p className="mb-6 text-sm text-[var(--color-muted)]">
          Register your business on Local App. You keep your user account — vendors can also use events, wallet, and more.
        </p>

        {step < 6 && (
          <div className="mb-6 flex gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full ${step >= s ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
              />
            ))}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-[var(--radius-lg)] bg-[var(--color-danger-light)] px-4 py-3 text-sm text-[var(--color-danger-fg)]">
            {error}
          </div>
        )}

        {/* Step 1 — Introduction */}
        {step === 1 && (
          <Card>
            <CardHeader title="Before you start" subtitle="Complete all verification steps" />
            <ul className="space-y-3 text-sm text-[var(--color-muted)]">
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0" /> Verify your email address</li>
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" /> Verify your mobile phone via OTP</li>
              <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0" /> Complete KYC identity verification</li>
              <li className="flex items-center gap-2"><Building2 className="h-4 w-4 shrink-0" /> Submit business details &amp; registration PDF</li>
            </ul>
            <Button className="mt-4 w-full" onClick={() => setStep(2)}>Get Started</Button>
          </Card>
        )}

        {/* Step 2 — Email verification */}
        {step === 2 && (
          <Card>
            <CardHeader title="Step 1 — Verify email" subtitle="We send a confirmation link to your inbox" />
            <p className="mb-3 text-sm text-[var(--color-muted)]">{firebaseUser?.email}</p>
            <Button onClick={handleSendEmail} loading={loading}>
              {emailSent ? "Resend verification email" : "Send verification email"}
            </Button>
            <Button variant="outline" className="mt-3 w-full" onClick={checkEmailVerified} loading={loading}>
              I&apos;ve verified my email
            </Button>
          </Card>
        )}

        {/* Step 3 — Phone OTP */}
        {step === 3 && (
          <Card>
            <CardHeader title="Step 2 — Verify phone" subtitle="OTP sent via Notify.lk SMS" />
            <PhoneVerify onVerified={() => setStep(4)} />
          </Card>
        )}

        {/* Step 4 — KYC */}
        {step === 4 && (
          <Card>
            <CardHeader title="Step 3 — Identity Verification (KYC)" subtitle="Required before submitting your vendor application" />
            {kycApproved ? (
              <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                <p className="flex items-center gap-2 font-medium">
                  <CheckCircle className="h-4 w-4" /> KYC verified — you&apos;re all set!
                </p>
              </div>
            ) : kycStatus === "pending" ? (
              <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <p className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" /> KYC under review
                </p>
                <p className="mt-1">Your KYC submission is being reviewed by our team. You&apos;ll be notified once approved.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <p className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4" /> KYC not completed
                  </p>
                  <p className="mt-1">
                    You must complete identity verification before applying as a vendor. This protects both you and your customers.
                  </p>
                </div>
                <Link href="/kyc">
                  <Button className="w-full">Complete KYC Now</Button>
                </Link>
              </div>
            )}

            <div className="mt-4 flex gap-3">
              {kycApproved && (
                <Button className="flex-1" onClick={() => setStep(5)}>
                  Continue to Business Form
                </Button>
              )}
              {!kycApproved && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={async () => {
                    setLoading(true);
                    await refreshProfile?.();
                    setLoading(false);
                  }}
                  loading={loading}
                >
                  Refresh KYC status
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Step 5 — Business form */}
        {step === 5 && (
          <Card>
            <CardHeader title="Step 4 — Business profile" subtitle="All fields are required for admin review" />
            <div className="space-y-3">
              <Input label="Business name" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} required />
              <Select label="Category" options={categories} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
              <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
              <Input label="Business email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <Input label="Website (optional)" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} required />
              <Input
                label="Business registration number"
                value={form.businessRegistrationNumber}
                onChange={(e) => setForm({ ...form, businessRegistrationNumber: e.target.value })}
                required
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-fg)]">
                  Business registration PDF <span className="text-[var(--color-danger-fg)]">*</span>
                </label>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="block w-full text-sm text-[var(--color-muted)] file:mr-3 file:rounded file:border-0 file:bg-[var(--color-primary)] file:px-3 file:py-2 file:text-sm file:text-white"
                  onChange={(e) => setRegistrationPdf(e.target.files?.[0] ?? null)}
                  required
                />
                {registrationPdf && (
                  <p className="mt-1 text-xs text-green-600">Selected: {registrationPdf.name}</p>
                )}
              </div>
            </div>
            <Button className="mt-4 w-full" onClick={handleSubmit} loading={loading}>
              Submit Application
            </Button>
          </Card>
        )}

        {/* Step 6 — Submitted */}
        {step === 6 && (
          <Card className="text-center py-8">
            <CheckCircle className="mx-auto mb-3 h-14 w-14 text-[var(--color-primary)]" />
            <CardHeader title="Application submitted!" subtitle="Admin will review your vendor profile" />
            <p className="text-sm text-[var(--color-muted)] mt-2">
              Current status: <strong className="capitalize">{profile?.vendorStatus ?? "pending"}</strong>
            </p>
            {profile?.vendorStatus === "approved" && (
              <Link href="/vendor/dashboard">
                <Button className="mt-5">Go to Vendor Dashboard</Button>
              </Link>
            )}
          </Card>
        )}
      </div>
    </PublicLayout>
  );
}
