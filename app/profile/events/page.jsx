"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/providers/AuthProvider";
import { getUserEvents } from "@/lib/services/events";
import { format } from "date-fns";
import { Plus } from "lucide-react";

export default function MyEventsPage() {
  return (
    <RoleGuard requireAuth>
      <MyEventsContent />
    </RoleGuard>
  );
}

function MyEventsContent() {
  const { profile } = useAuth();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (profile) getUserEvents(profile.uid).then(setEvents);
  }, [profile]);

  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-fg)]">My Events</h1>
            <p className="text-sm text-[var(--color-muted)]">Events you&apos;ve created</p>
          </div>
          <Link href="/events/create">
            <Button>
              <Plus className="h-4 w-4" /> Create
            </Button>
          </Link>
        </div>

        <Card>
          {events.length === 0 ? (
            <p className="text-[var(--color-muted)]">
              You haven&apos;t created any events yet.{" "}
              <Link
                href="/events/create"
                className="text-[var(--color-primary)] hover:underline"
              >
                Create one
              </Link>
            </p>
          ) : (
            <div className="space-y-3">
              {events.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border-light)] p-4"
                >
                  <div>
                    <Link
                      href={`/events/${e.seoSlug}`}
                      className="font-medium text-[var(--color-fg)] hover:text-[var(--color-primary)]"
                    >
                      {e.title}
                    </Link>
                    <p className="text-sm text-[var(--color-muted)]">
                      {format(e.startDatetime.toDate(), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Badge label={e.status} status={e.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PublicLayout>
  );
}
