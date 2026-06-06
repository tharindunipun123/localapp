"use client";

import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { EventChatPanel } from "@/components/chat/EventChatPanel";
import { useAuth } from "@/providers/AuthProvider";
import {
  getEventGroup,
  getMemberStatus,
  joinEventGroup,
  ensureEventGroup,
} from "@/lib/services/chat";
import { getEventBySlug } from "@/lib/services/events";
import { useParams } from "next/navigation";

export default function EventChatPage() {
  return (
    <RoleGuard requireAuth>
      <ChatContent />
    </RoleGuard>
  );
}

function ChatContent() {
  const params = useParams();
  const slug = params.slug;
  const { profile } = useAuth();
  const [event, setEvent] = useState(null);
  const [memberStatus, setMemberStatus] = useState(null);
  const [joinPolicy, setJoinPolicy] = useState("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    async function init() {
      if (!profile) return;
      setError("");
      try {
        const ev = await getEventBySlug(slug);
        if (!ev) {
          setError("Event not found.");
          setLoading(false);
          return;
        }
        if (!ev.chatEnabled) {
          setError("Chat is not enabled for this event.");
          setLoading(false);
          return;
        }

        setEvent(ev);

        let group = await getEventGroup(ev.id);
        if (!group) {
          group = await ensureEventGroup(ev.id, ev.createdBy, "open");
        }
        if (group) setJoinPolicy(group.joinPolicy ?? "open");

        const member = await getMemberStatus(ev.id, profile.uid);
        if (member) {
          setMemberStatus(member.status);
        } else if ((group?.joinPolicy ?? "open") === "open") {
          const status = await joinEventGroup(ev.id, profile.uid, "open", ev.createdBy);
          setMemberStatus(status);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load chat");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [slug, profile]);

  async function handleJoin() {
    if (!event || !profile) return;
    setJoining(true);
    setError("");
    try {
      const status = await joinEventGroup(
        event.id,
        profile.uid,
        joinPolicy,
        event.createdBy
      );
      setMemberStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join group");
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary-light)] border-t-[var(--color-primary)]" />
        </div>
      </PublicLayout>
    );
  }

  if (!event) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center text-[var(--color-muted)]">
          {error || "Event not found."}
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="relative mx-auto max-w-2xl px-4 py-4 sm:px-6 sm:py-6">
        <EventChatPanel
          event={event}
          profile={profile}
          memberStatus={memberStatus}
          joinPolicy={joinPolicy}
          onJoin={handleJoin}
          joining={joining}
          error={error}
        />
      </div>
    </PublicLayout>
  );
}
