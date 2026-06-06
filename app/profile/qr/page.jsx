"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/providers/AuthProvider";
import { generateUserQr } from "@/lib/services/qr";
import { format } from "date-fns";

export default function UserQrPage() {
  return (
    <RoleGuard requireAuth>
      <QrContent />
    </RoleGuard>
  );
}

function QrContent() {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrValue, setQrValue] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const result = await generateUserQr();
      setQrValue(result.qrValue);
      setExpiresAt(result.expiresAt);
      const url = await QRCode.toDataURL(result.qrValue, { width: 280, margin: 2 });
      setQrDataUrl(url);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <PublicLayout>
      <div className="mx-auto max-w-md px-4 py-8">
        <Card className="text-center">
          <CardHeader
            title="Your QR Code"
            subtitle="Used for loyalty points, promos, and event check-in (refreshes every 24h)"
          />
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="User QR code" className="mx-auto rounded-[var(--radius-lg)]" />
          ) : (
            <div className="mx-auto h-[280px] w-[280px] animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-border-light)]" />
          )}
          {expiresAt && (
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              Expires {format(new Date(expiresAt), "MMM d, yyyy HH:mm")}
            </p>
          )}
          <Button className="mt-4" onClick={refresh} loading={loading}>
            Refresh QR
          </Button>
          <p className="mt-4 text-xs text-[var(--color-muted)] break-all">{qrValue}</p>
        </Card>

        <div className="mt-4 text-center">
          <Link href="/profile" className="text-sm text-[var(--color-primary)] hover:underline">
            ← Back to profile
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
