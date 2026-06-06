"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { ArrowLeft, Send, Trash2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { UserAvatar, AvatarStack } from "@/components/chat/UserAvatar";
import {
  getGroupMembers,
  joinEventGroup,
  sendMessage,
  subscribeToMessages,
  deleteMessage,
} from "@/lib/services/chat";
import { getUserProfiles } from "@/lib/services/users";

function getMessageDate(msg) {
  if (msg.createdAt?.toDate) return msg.createdAt.toDate();
  if (msg.createdAt) return new Date(msg.createdAt);
  return new Date();
}

function formatMessageTime(date) {
  return format(date, "h:mm a");
}

function formatDateLabel(date) {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

function groupMessages(messages) {
  const groups = [];
  let lastDate = null;

  for (const msg of messages) {
    const date = getMessageDate(msg);
    if (!lastDate || !isSameDay(lastDate, date)) {
      groups.push({ type: "date", date });
      lastDate = date;
    }
    groups.push({ type: "message", message: msg, date });
  }
  return groups;
}

export function EventChatPanel({
  event,
  profile,
  memberStatus,
  joinPolicy,
  onJoin,
  joining,
  error,
}) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [members, setMembers] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [showMembers, setShowMembers] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!event?.id || memberStatus !== "active") return;
    const unsub = subscribeToMessages(event.id, setMessages);
    return unsub;
  }, [event?.id, memberStatus]);

  useEffect(() => {
    if (!event?.id || memberStatus !== "active") return;
    async function loadMembers() {
      const groupMembers = await getGroupMembers(event.id);
      const active = groupMembers.filter((m) => m.status === "active");
      setMembers(active);
      const profileMap = await getUserProfiles(active.map((m) => m.userId ?? m.id));
      setProfiles(profileMap);
    }
    loadMembers();
  }, [event?.id, memberStatus, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!event?.id || !profile || !text.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(
        event.id,
        profile.uid,
        profile.displayName,
        text.trim(),
        undefined,
        profile.photoURL
      );
      setText("");
      inputRef.current?.focus();
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(messageId, senderId) {
    if (!event?.id || !profile) return;
    await deleteMessage(event.id, messageId, profile.uid, profile.uid === senderId);
  }

  const memberProfiles = members.map((m) => {
    const uid = m.userId ?? m.id;
    return profiles[uid] ?? { uid, displayName: "Member" };
  });

  const grouped = groupMessages(messages);

  return (
    <div className="relative flex h-[calc(100vh-8rem)] max-h-[720px] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-light)] bg-[var(--color-card)] shadow-[var(--shadow-md)]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border-light)] bg-[var(--color-primary)] px-4 py-3 text-[var(--color-primary-fg)]">
        <Link
          href={`/events/${event.seoSlug}`}
          className="rounded-full p-1 hover:bg-white/10"
          aria-label="Back to event"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold">{event.title}</h1>
          <p className="text-xs opacity-80">
            {memberStatus === "active"
              ? `${members.length || event.attendeeCount || 0} members · Group chat`
              : "Event group chat"}
          </p>
        </div>
        {memberStatus === "active" && memberProfiles.length > 0 && (
          <button
            type="button"
            onClick={() => setShowMembers(true)}
            className="rounded-full p-2 hover:bg-white/10"
            aria-label="View members"
          >
            <Users className="h-5 w-5" />
          </button>
        )}
      </div>

      {error && (
        <div className="mx-4 mt-3 rounded-[var(--radius-lg)] bg-[var(--color-danger-light)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
          {error}
        </div>
      )}

      {memberStatus !== "active" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#e8edf2] p-6">
          {memberStatus === "pending" ? (
            <p className="text-center text-[var(--color-muted)]">
              Your join request is pending approval from the event organizer.
            </p>
          ) : (
            <>
              <div className="text-center">
                <Users className="mx-auto mb-3 h-12 w-12 text-[var(--color-primary)]" />
                <p className="font-medium text-[var(--color-fg)]">Join the event group</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Connect with other attendees and share updates in real time.
                </p>
              </div>
              <Button onClick={onJoin} loading={joining}>
                Join Group
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div
            className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)",
              backgroundSize: "20px 20px",
              backgroundColor: "#e8edf2",
            }}
          >
            {messages.length === 0 && (
              <p className="py-8 text-center text-sm text-[var(--color-muted)]">
                No messages yet. Say hello to the group!
              </p>
            )}

            {grouped.map((item, idx) => {
              if (item.type === "date") {
                return (
                  <div key={`date-${idx}`} className="flex justify-center py-2">
                    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[var(--color-muted)] shadow-sm">
                      {formatDateLabel(item.date)}
                    </span>
                  </div>
                );
              }

              const msg = item.message;
              const isOwn = msg.senderId === profile?.uid;
              const prevItem = grouped[idx - 1];
              const showAvatar =
                !isOwn &&
                (prevItem?.type !== "message" || prevItem.message.senderId !== msg.senderId);

              const senderProfile = profiles[msg.senderId] ?? {
                uid: msg.senderId,
                displayName: msg.senderName,
                photoURL: msg.senderPhotoURL,
              };

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isOwn ? "justify-end" : "justify-start"}`}
                >
                  {!isOwn && (
                    <div className="w-8 shrink-0">
                      {showAvatar ? (
                        <UserAvatar user={senderProfile} size="sm" />
                      ) : (
                        <div className="w-8" />
                      )}
                    </div>
                  )}
                  <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}>
                    {!isOwn && showAvatar && (
                      <p className="mb-0.5 ml-1 text-xs font-medium text-[var(--color-primary)]">
                        {msg.senderName}
                      </p>
                    )}
                    <div
                      className={`relative rounded-2xl px-3 py-2 text-sm shadow-sm ${
                        isOwn
                          ? "rounded-br-md bg-[#dcf8c6] text-[var(--color-fg)]"
                          : "rounded-bl-md bg-white text-[var(--color-fg)]"
                      } ${msg.deletedAt ? "italic opacity-60" : ""}`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                      {msg.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={msg.imageUrl}
                          alt=""
                          className="mt-2 max-h-48 rounded-lg object-cover"
                        />
                      )}
                      <div className="mt-0.5 flex items-center justify-end gap-1">
                        <span className="text-[10px] text-[var(--color-muted-fg)]">
                          {formatMessageTime(getMessageDate(msg))}
                        </span>
                        {isOwn && !msg.deletedAt && (
                          <button
                            type="button"
                            onClick={() => handleDelete(msg.id, msg.senderId)}
                            className="ml-1 opacity-40 hover:opacity-100"
                            aria-label="Delete message"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSend}
            className="flex items-end gap-2 border-t border-[var(--color-border-light)] bg-[var(--color-border-light)] px-3 py-2"
          >
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message"
              className="flex-1 rounded-full border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-primary-fg)] disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </>
      )}

      {/* Members drawer */}
      {showMembers && (
        <div className="absolute inset-0 z-50 flex flex-col bg-[var(--color-card)]">
          <div className="flex items-center gap-3 border-b border-[var(--color-border-light)] px-4 py-3">
            <button
              type="button"
              onClick={() => setShowMembers(false)}
              className="rounded-full p-1 hover:bg-[var(--color-border-light)]"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="font-semibold text-[var(--color-fg)]">
              {memberProfiles.length} members
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <AvatarStack users={memberProfiles} max={20} size="sm" />
            <ul className="mt-4 space-y-3">
              {memberProfiles.map((user) => (
                <li key={user.uid} className="flex items-center gap-3">
                  <UserAvatar user={user} size="md" />
                  <div>
                    <p className="font-medium text-[var(--color-fg)]">{user.displayName}</p>
                    {user.uid === event.createdBy && (
                      <p className="text-xs text-[var(--color-primary)]">Organizer</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
