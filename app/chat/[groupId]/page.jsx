"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  addDoc,
  serverTimestamp,
  orderBy,
  query,
  limit,
  startAfter,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { reportChatMessage } from "@/lib/services/cloudFunctions";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useAuth } from "@/providers/AuthProvider";
import { format } from "date-fns";
import { Send, Flag, Lock, ArrowLeft } from "lucide-react";

// REQ-CHT-005: paginate 50 per load
const PAGE_LIMIT = 50;

export default function ChatRoomPage() {
  return (
    <RoleGuard requireAuth>
      <ChatRoomContent />
    </RoleGuard>
  );
}

function ChatRoomContent() {
  const { groupId } = useParams();
  const { profile } = useAuth();
  const router = useRouter();

  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notMember, setNotMember] = useState(false);
  const [reporting, setReporting] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const oldestDocRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const unsubRef = useRef(null);

  // Load group metadata
  useEffect(() => {
    if (!groupId) return;
    getDoc(doc(db, "chatGroups", groupId)).then((snap) => {
      if (!snap.exists()) { setError("Group not found"); return; }
      const g = { id: snap.id, ...snap.data() };
      setGroup(g);
      if (!profile || !g.memberIds?.includes(profile.uid)) {
        setNotMember(true);
      }
    });
  }, [groupId, profile]);

  // Real-time messages listener (REQ-CHT-005)
  useEffect(() => {
    if (!groupId) return;
    const q = query(
      collection(db, "chatGroups", groupId, "messages"),
      orderBy("createdAt", "desc"),
      limit(PAGE_LIMIT)
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.slice().reverse().map((d) => ({ id: d.id, ...d.data() }));
      setMessages(rows);
      oldestDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMore(snap.docs.length === PAGE_LIMIT);
    });
    unsubRef.current = unsub;
    return () => unsub();
  }, [groupId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark messages as read
  useEffect(() => {
    if (!profile || messages.length === 0) return;
    const uid = profile.uid;
    const unread = messages.filter((m) => !m.readBy?.includes(uid) && m.senderId !== uid);
    unread.forEach((m) => {
      updateDoc(doc(db, "chatGroups", groupId, "messages", m.id), {
        readBy: arrayUnion(uid),
      }).catch(() => {});
    });
  }, [messages, profile, groupId]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !profile) return;
    if (group?.isArchived) { setError("This group is archived and read-only."); return; }

    setSending(true);
    setInput("");
    setError("");

    try {
      await addDoc(collection(db, "chatGroups", groupId, "messages"), {
        senderId: profile.uid,
        senderName: profile.displayName ?? "User",
        content: text,
        type: "text",
        createdAt: serverTimestamp(),
        readBy: [profile.uid],
      });
      // Update group updatedAt
      await updateDoc(doc(db, "chatGroups", groupId), { updatedAt: serverTimestamp() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setInput(text); // restore
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, profile, group, groupId]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleReport(messageId) {
    if (!reportReason.trim()) return;
    setReporting(messageId);
    try {
      await reportChatMessage({ groupId, messageId, reason: reportReason });
      setReportReason("");
      setReporting(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to report");
      setReporting(null);
    }
  }

  if (notMember) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <Lock className="mx-auto mb-4 h-12 w-12 text-[var(--color-muted)]" />
          <h1 className="text-xl font-bold">Not a member</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">You are not a member of this chat group.</p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-4 text-sm text-[var(--color-primary)] hover:underline"
          >
            ← Go back
          </button>
        </div>
      </PublicLayout>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-[var(--color-muted)] hover:text-[var(--color-primary)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{group?.name ?? "Chat"}</p>
          <p className="text-xs text-[var(--color-muted)]">
            {group?.memberIds?.length ?? 0} members
            {group?.isArchived && " · Archived (read-only)"}
          </p>
        </div>
        {group?.isArchived && <Lock className="h-4 w-4 text-[var(--color-muted)]" />}
      </header>

      {/* Messages (REQ-CHT-004, REQ-CHT-005) */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {hasMore && (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              disabled={loadingOlder}
              onClick={async () => {
                if (!oldestDocRef.current) return;
                setLoadingOlder(true);
                try {
                  const olderQ = query(
                    collection(db, "chatGroups", groupId, "messages"),
                    orderBy("createdAt", "desc"),
                    startAfter(oldestDocRef.current),
                    limit(PAGE_LIMIT)
                  );
                  const snap = await getDocs(olderQ);
                  const older = snap.docs.slice().reverse().map((d) => ({ id: d.id, ...d.data() }));
                  setMessages((prev) => {
                    const seen = new Set(prev.map((m) => m.id));
                    return [...older.filter((m) => !seen.has(m.id)), ...prev];
                  });
                  if (snap.docs.length) oldestDocRef.current = snap.docs[snap.docs.length - 1];
                  setHasMore(snap.docs.length === PAGE_LIMIT);
                } finally {
                  setLoadingOlder(false);
                }
              }}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              {loadingOlder ? "Loading…" : "Load older messages"}
            </button>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.senderId === profile?.uid;
          const isSystem = msg.type === "system";
          const ts = msg.createdAt?.toDate?.() ?? null;

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="rounded-full bg-[var(--color-border-light)] px-3 py-1 text-xs text-[var(--color-muted)]">
                  {msg.content}
                </span>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`group relative max-w-xs rounded-2xl px-4 py-2 ${isMe ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-card)] border border-[var(--color-border)]"}`}>
                {!isMe && (
                  <p className="mb-0.5 text-xs font-medium text-[var(--color-primary)]">
                    {msg.senderName ?? msg.senderId?.slice(0, 8)}
                  </p>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {msg.content}
                </p>
                {ts && (
                  <p className={`mt-1 text-right text-xs ${isMe ? "text-white/60" : "text-[var(--color-muted)]"}`}>
                    {format(ts, "HH:mm")}
                  </p>
                )}
                {/* Report button (REQ-CHT-007) */}
                {!isMe && !msg.reported && (
                  <button
                    type="button"
                    className="absolute -right-6 top-2 hidden text-[var(--color-muted)] group-hover:block hover:text-red-500"
                    onClick={() => setReporting(reporting === msg.id ? null : msg.id)}
                    title="Report message"
                  >
                    <Flag className="h-3.5 w-3.5" />
                  </button>
                )}
                {msg.reported && !isMe && (
                  <span className="absolute -right-5 top-2 text-xs text-[var(--color-warning)]">!</span>
                )}
                {/* Report form */}
                {reporting === msg.id && (
                  <div className="absolute right-0 top-8 z-10 w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-2 shadow-lg">
                    <textarea
                      rows={2}
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      placeholder="Reason for report…"
                      className="w-full rounded border border-[var(--color-border)] p-1 text-xs text-[var(--color-fg)] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleReport(msg.id)}
                      className="mt-1 w-full rounded bg-red-500 py-1 text-xs text-white hover:bg-red-600"
                    >
                      Submit report
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Error bar */}
      {error && (
        <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600">{error}</p>
      )}

      {/* Input (REQ-CHT-004) */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
        {group?.isArchived ? (
          <p className="text-center text-sm text-[var(--color-muted)]">
            <Lock className="mr-1 inline h-4 w-4" />
            This group is archived — read-only (REQ-CHT-006)
          </p>
        ) : (
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send)"
              className="flex-1 resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              style={{ maxHeight: "120px", overflowY: "auto" }}
              disabled={!profile}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white disabled:opacity-40 hover:bg-[var(--color-primary)]/90"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
