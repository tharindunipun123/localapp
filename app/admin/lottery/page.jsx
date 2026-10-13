"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { createLottery, drawLottery } from "@/lib/services/cloudFunctions";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { format } from "date-fns";
import { Trophy } from "lucide-react";

const DEFAULT_FORM = {
  title: "",
  description: "",
  pointsCost: 100,
  prize: "",
  drawDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
};

export default function AdminLotteryPage() {
  const [lotteries, setLotteries] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [bonusPrize, setBonusPrize] = useState("");
  const [creating, setCreating] = useState(false);
  const [drawing, setDrawing] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    const q = query(collection(db, "lotteries"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    setLotteries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");
    try {
      await createLottery({
        title: form.title,
        description: form.description,
        pointsCost: Number(form.pointsCost),
        prize: form.prize,
        drawDate: new Date(form.drawDate).getTime(),
      });
      setSuccess(`Lottery "${form.title}" created!`);
      setForm(DEFAULT_FORM);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lottery");
    } finally {
      setCreating(false);
    }
  }

  async function handleDraw(lotteryId) {
    if (!confirm("Draw lottery now? This action cannot be undone.")) return;
    setDrawing(lotteryId);
    setError("");
    setSuccess("");
    try {
      const bonus = bonusPrize ? Number(bonusPrize) : undefined;
      const result = await drawLottery(lotteryId, bonus);
      setSuccess(`Winner drawn! User ID: ${result.winnerId}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draw failed");
    } finally {
      setDrawing(null);
    }
  }

  function statusLabel(lottery) {
    if (lottery.status === "drawn") return "drawn";
    if (lottery.status === "closed") return "closed";
    const now = Date.now();
    const drawMs = lottery.drawDate?.toMillis?.() ?? 0;
    if (drawMs < now) return "overdue";
    return "active";
  }

  function statusColor(lottery) {
    const s = statusLabel(lottery);
    if (s === "active") return "approved";
    if (s === "drawn") return "pending";
    return "rejected";
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Trophy className="h-6 w-6 text-[var(--segment-lottery)]" />
        <h1 className="text-2xl font-bold">Lottery</h1>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      {success && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</p>}

      <Card>
        <CardHeader title="Create new lottery" />
        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <Input
            label="Prize description"
            value={form.prize}
            onChange={(e) => setForm({ ...form, prize: e.target.value })}
            placeholder="e.g. Dinner for two at XYZ"
            required
          />
          <Input
            label="Entry cost (loyalty points)"
            type="number"
            min={1}
            value={form.pointsCost}
            onChange={(e) => setForm({ ...form, pointsCost: e.target.value })}
            required
          />
          <div>
            <label className="mb-1 block text-sm font-medium">Draw date</label>
            <input
              type="datetime-local"
              value={form.drawDate}
              onChange={(e) => setForm({ ...form, drawDate: e.target.value })}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">Description (optional)</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
          <Button type="submit" loading={creating} className="sm:col-span-2">
            Create lottery
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="All lotteries" />

        {/* Bonus points prize input for drawing */}
        <div className="mb-4 flex items-center gap-3">
          <Input
            label="Bonus points to award winner (optional)"
            type="number"
            min={0}
            value={bonusPrize}
            onChange={(e) => setBonusPrize(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          {lotteries.length === 0 && (
            <p className="text-sm text-[var(--color-muted)]">No lotteries yet.</p>
          )}
          {lotteries.map((l) => {
            const status = statusLabel(l);
            const drawMs = l.drawDate?.toMillis?.() ?? l.drawDate;
            const drawnMs = l.drawnAt?.toMillis?.() ?? null;
            return (
              <div
                key={l.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[var(--color-border)] p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{l.title}</p>
                    <Badge label={status} status={statusColor(l)} />
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    🎁 {l.prize}
                  </p>
                  <p className="text-sm text-[var(--color-muted)]">
                    {l.pointsCost} pts/entry · {l.entryCount ?? 0} entries
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    Draw: {drawMs ? format(new Date(drawMs), "MMM d, yyyy HH:mm") : "—"}
                  </p>
                  {l.status === "drawn" && l.winnerId && (
                    <p className="mt-1 text-xs font-medium text-green-700">
                      Winner: {l.winnerId}
                      {drawnMs && ` · drawn ${format(new Date(drawnMs), "MMM d, yyyy")}`}
                    </p>
                  )}
                </div>
                {status !== "drawn" && (
                  <Button
                    size="sm"
                    loading={drawing === l.id}
                    onClick={() => handleDraw(l.id)}
                    disabled={drawing !== null}
                  >
                    Draw winner
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
