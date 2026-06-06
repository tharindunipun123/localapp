"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/providers/AuthProvider";
import { getUserTickets } from "@/lib/services/wallet";
import { format } from "date-fns";

export default function TicketsPage() {
  return (
    <RoleGuard requireAuth>
      <TicketsList />
    </RoleGuard>
  );
}

function TicketsList() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    if (profile) getUserTickets(profile.uid).then(setTickets);
  }, [profile]);

  return (
    <PublicLayout>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-bold text-[var(--color-fg)]">My Tickets</h1>

        <Card>
          <CardHeader title="Tickets" subtitle="Your purchased event tickets" />
          {tickets.length === 0 ? (
            <p className="text-[var(--color-muted)]">
              No tickets yet. Browse{" "}
              <Link href="/events" className="text-[var(--color-primary)] hover:underline">
                events
              </Link>{" "}
              to purchase tickets.
            </p>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/tickets/${t.id}`}
                  className="block rounded-[var(--radius-lg)] border border-[var(--color-border-light)] p-4 transition-shadow hover:shadow-[var(--shadow-sm)]"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-[var(--color-fg)]">
                        Ticket #{t.id.slice(0, 8)}
                      </p>
                      <p className="text-sm text-[var(--color-muted)]">
                        {format(t.createdAt.toDate(), "MMM d, yyyy")} · Qty: {t.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[var(--color-primary)]">
                        LKR {t.totalPrice.toLocaleString()}
                      </p>
                      <Badge label={t.status} status={t.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PublicLayout>
  );
}
