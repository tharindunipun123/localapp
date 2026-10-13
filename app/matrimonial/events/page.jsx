"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { PageHero } from "@/components/layout/PageHero";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getApprovedEventsByCategory } from "@/lib/services/events";
import { registerMatrimonialEvent, getMyMatrimonialEventRegistrations } from "@/lib/services/cloudFunctions";
import { format } from "date-fns";
import { CalendarHeart, Coins } from "lucide-react";

export default function MatrimonialEventsPage() {
  return (
    <RoleGuard requireAuth>
      <EventsContent />
    </RoleGuard>
  );
}

function EventsContent() {
  const [events, setEvents] = useState([]);
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      getApprovedEventsByCategory("matrimonial"),
      getMyMatrimonialEventRegistrations().catch(() => ({ registrations: [] })),
    ])
      .then(([ev, mine]) => {
        setEvents(ev);
        setRegs(mine.registrations ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load events"))
      .finally(() => setLoading(false));
  }, []);

  const registeredIds = new Set(regs.map((r) => r.eventId));

  async function handleRegister(eventId) {
    setBusy(eventId);
    setError("");
    try {
      const res = await registerMatrimonialEvent(eventId);
      setMessage(`Registered. ${res.coinsPaid} coins charged.`);
      const mine = await getMyMatrimonialEventRegistrations();
      setRegs(mine.registrations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <PublicLayout>
      <PageHero
        compact
        segment="matrimonial"
        image="/images/hero-matrimonial.png"
        eyebrow="Members"
        title="Matrimonial evenings"
        subtitle="Physical meetups only — register with coins, then connect in the event chat after attendance."
        actions={
          <Link href="/matrimonial">
            <Button className="bg-white text-[var(--color-ink)] hover:bg-white/90">Browse profiles</Button>
          </Link>
        }
      />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-4">
        {error && <p className="text-sm text-[var(--color-danger-fg)]">{error}</p>}
        {message && <p className="text-sm text-emerald-700">{message}</p>}
        {loading && <p className="text-sm text-[var(--color-muted)]">Loading events…</p>}
        {!loading && events.length === 0 && (
          <Card>
            <p className="text-sm text-[var(--color-muted)]">
              No matrimonial events are listed yet. Organisers can create an event with category “matrimonial”.
            </p>
          </Card>
        )}
        {events.map((event) => {
          const start = event.startDatetime?.toDate?.();
          const joined = registeredIds.has(event.id);
          return (
            <Card key={event.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarHeart className="h-4 w-4 text-[var(--segment-matrimonial)]" />
                  <h2 className="font-semibold text-[var(--color-fg)]">{event.title}</h2>
                </div>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {start ? format(start, "EEE d MMM yyyy · h:mm a") : "Date TBC"} · {event.locationLabel}
                </p>
                <p className="mt-2 flex items-center gap-1 text-xs text-[var(--color-muted)]">
                  <Coins className="h-3.5 w-3.5" /> {event.coinCost ?? 100} coins to register
                </p>
              </div>
              <div className="flex items-center gap-2">
                {joined ? (
                  <Badge label="Registered" status="approved" />
                ) : (
                  <Button size="sm" loading={busy === event.id} onClick={() => handleRegister(event.id)}>
                    Register
                  </Button>
                )}
                {event.chatGroupId && joined && (
                  <Link href={`/chat/${event.chatGroupId}`}>
                    <Button size="sm" variant="outline">Chat</Button>
                  </Link>
                )}
                <Link href={`/events/${event.seoSlug}`}>
                  <Button size="sm" variant="ghost">Details</Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </PublicLayout>
  );
}
