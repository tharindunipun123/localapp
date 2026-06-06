"use client";

import { useState } from "react";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PhoneVerify } from "@/components/auth/PhoneVerify";
import { confirmCorporateBinding } from "@/lib/services/cloudFunctions";

export default function CorporateBindingPage() {
  return (
    <RoleGuard requireAuth>
      <BindingContent />
    </RoleGuard>
  );
}

function BindingContent() {
  const [vendorId, setVendorId] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleBind() {
    if (!otpVerified) {
      setMessage("Verify your phone with OTP first.");
      return;
    }
    setLoading(true);
    try {
      await confirmCorporateBinding(vendorId.trim(), true);
      setMessage("Successfully bound to corporate vendor.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Binding failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-md px-4 py-8">
        <Card>
          <CardHeader title="Bind to corporate account" subtitle="REQ-WAL-012 — OTP consent required" />
          <div className="space-y-4">
            <Input label="Corporate vendor ID" value={vendorId} onChange={(e) => setVendorId(e.target.value)} placeholder="Vendor UID from your employer" />
            <div>
              <p className="mb-2 text-sm font-medium">Verify phone (OTP)</p>
              <PhoneVerify onVerified={() => setOtpVerified(true)} />
              {otpVerified && <p className="mt-2 text-sm text-[var(--color-success)]">Phone verified ✓</p>}
            </div>
            <Button onClick={handleBind} loading={loading} className="w-full">Confirm binding</Button>
            {message && <p className="text-sm text-[var(--color-primary)]">{message}</p>}
          </div>
        </Card>
        <p className="mt-4 text-center text-sm">
          <Link href="/profile" className="text-[var(--color-primary)] hover:underline">← Profile</Link>
        </p>
      </div>
    </PublicLayout>
  );
}
