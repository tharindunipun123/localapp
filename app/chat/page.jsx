"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getMyChatGroups } from "@/lib/services/cloudFunctions";
import { useAuth } from "@/providers/AuthProvider";
import { format } from "date-fns";
import { MessageCircle, Users, Lock } from "lucide-react";

export default function ChatGroupsPage() {
  return (
    <RoleGuard requireAuth>
      <PublicLayout>
        <ChatGroupsContent />
      </PublicLayout>
    </RoleGuard>
  );
}

function ChatGroupsContent() {
  const { profile } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    getMyChatGroups()
      .then((res) => setGroups(res.groups ?? []))
      .finally(() => setLoading(false));
  }, [profile]);

  const eventGroups = groups.filter((g) => g.type === "event_group");
  const dms = groups.filter((g) => g.type === "direct_message");

  return (
    <div className="mx-auto max-w-xl px-4 py-8 space-y-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-6 w-6 text-[var(--color-primary)]" />
        <h1 className="text-2xl font-bold">Messages</h1>
      </div>

      {loading && <p className="text-sm text-[var(--color-muted)]">Loading…</p>}

      {eventGroups.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Event groups</p>
          <div className="space-y-2">
            {eventGroups.map((g) => <GroupRow key={g.id} group={g} />)}
          </div>
        </section>
      )}

      {dms.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Direct messages</p>
          <div className="space-y-2">
            {dms.map((g) => <GroupRow key={g.id} group={g} />)}
          </div>
        </section>
      )}

      {!loading && groups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center text-[var(--color-muted)]">
          <MessageCircle className="mx-auto mb-2 h-10 w-10 opacity-30" />
          <p>No conversations yet.</p>
          <p className="mt-1 text-xs">Join an event to get access to its chat group.</p>
        </div>
      )}
    </div>
  );
}

function GroupRow({ group }) {
  const updatedAt = group.updatedAt?.toMillis?.() ?? group.updatedAt ?? 0;

  return (
    <Link href={`/chat/${group.id}`}>
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 transition hover:border-[var(--color-primary)]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-border-light)] text-[var(--color-muted)]">
          {group.type === "direct_message" ? <MessageCircle className="h-5 w-5" /> : <Users className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{group.name ?? "Chat"}</p>
          <p className="text-xs text-[var(--color-muted)]">
            {group.memberIds?.length ?? 0} member{group.memberIds?.length !== 1 ? "s" : ""}
            {updatedAt ? ` · ${format(new Date(updatedAt), "MMM d")}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {group.isArchived && (
            <div className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
              <Lock className="h-3 w-3" /> Archived
            </div>
          )}
          {!group.isArchived && (
            <Badge label="Active" status="approved" />
          )}
        </div>
      </div>
    </Link>
  );
}
