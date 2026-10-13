"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { broadcastNotification } from "@/lib/services/cloudFunctions";

export default function AdminBroadcastPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend(e) {
    e.preventDefault();
    setLoading(true);
    setStatus("");
    try {
      const res = await broadcastNotification({ title, body });
      setStatus(`Sent to ${res.sent ?? 0} users.`);
      setTitle("");
      setBody("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Broadcast failed. Deploy the latest functions if this is not-found.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Card>
        <CardHeader
          title="System broadcast"
          subtitle="Sends an in-app notification to every registered user (up to 500)."
        />
        <form onSubmit={handleSend} className="max-w-xl space-y-4">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <label className="block text-sm font-medium text-[var(--color-fg)]">
            Message
            <textarea
              required
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </label>
          <Button type="submit" loading={loading}>Send broadcast</Button>
          {status && <p className="text-sm text-[var(--color-muted)]">{status}</p>}
        </form>
      </Card>
    </div>
  );
}
