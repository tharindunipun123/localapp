"use client";

import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getTicketById } from "@/lib/services/wallet";
import { format } from "date-fns";
import { useParams } from "next/navigation";
import QRCode from "qrcode";

export default function TicketDetailPage() {
  return (
    <RoleGuard requireAuth>
      <TicketDetail />
    </RoleGuard>
  );
}

function TicketDetail() {
  const params = useParams();
  const ticketId = params.id;
  const [ticket, setTicket] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    getTicketById(ticketId).then(async (t) => {
      setTicket(t);
      if (t?.qrCodeValue) {
        const url = await QRCode.toDataURL(t.qrCodeValue, { width: 256 });
        setQrDataUrl(url);
      }
    });
  }, [ticketId]);

  if (!ticket) {
    return (
      <PublicLayout>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary-light)] border-t-[var(--color-primary)]" />
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-md px-4 py-8 sm:px-6">
        <Card className="text-center">
          <CardHeader title="Event Ticket" subtitle={`Ticket #${ticket.id.slice(0, 8)}`} />
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="Ticket QR Code"
              className="mx-auto mb-4 rounded-[var(--radius-lg)]"
              width={256}
              height={256}
            />
          )}
          <Badge label={ticket.status} status={ticket.status} />
          <div className="mt-4 space-y-1 text-sm text-[var(--color-muted)]">
            <p>Quantity: {ticket.quantity}</p>
            <p>Total: LKR {ticket.totalPrice.toLocaleString()}</p>
            <p>Purchased: {format(ticket.createdAt.toDate(), "MMM d, yyyy HH:mm")}</p>
          </div>
          <p className="mt-4 text-xs text-[var(--color-muted-fg)]">
            Present this ticket QR at the entrance. Cashiers can also scan your personal wallet QR.
          </p>
        </Card>
      </div>
    </PublicLayout>
  );
}
