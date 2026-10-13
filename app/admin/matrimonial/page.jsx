"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { moderateMatrimonialPhoto, adminCreditCoins } from "@/lib/services/cloudFunctions";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { format } from "date-fns";
import { Heart, Coins } from "lucide-react";

export default function AdminMatrimonialPage() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Coin credit form
  const [coinUserId, setCoinUserId] = useState("");
  const [coinAmount, setCoinAmount] = useState("");
  const [coinReason, setCoinReason] = useState("");
  const [creditingCoins, setCreditingCoins] = useState(false);

  async function loadQueue() {
    setLoading(true);
    const q = query(
      collection(db, "matrimonialPhotoQueue"),
      where("status", "==", "pending"),
      orderBy("submittedAt", "asc")
    );
    const snap = await getDocs(q);
    setQueue(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => { loadQueue(); }, []);

  async function handleReview(queueId, action) {
    setReviewing(queueId);
    setError("");
    setSuccess("");
    try {
      await moderateMatrimonialPhoto(queueId, action);
      setSuccess(`Photo ${action === "approve" ? "approved" : "rejected"}`);
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setReviewing(null);
    }
  }

  async function handleCreditCoins(e) {
    e.preventDefault();
    setCreditingCoins(true);
    setError("");
    setSuccess("");
    try {
      await adminCreditCoins({ userId: coinUserId.trim(), coins: Number(coinAmount), reason: coinReason });
      setSuccess(`${coinAmount} coins credited to ${coinUserId}`);
      setCoinUserId(""); setCoinAmount(""); setCoinReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to credit coins");
    } finally {
      setCreditingCoins(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Heart className="h-6 w-6 text-[var(--segment-matrimonial)]" />
        <h1 className="text-2xl font-bold">Matrimonial — Admin</h1>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      {success && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</p>}

      {/* Photo moderation queue — REQ-MAT-003 */}
      <Card>
        <CardHeader
          title={`Photo moderation queue (${queue.length} pending)`}
          subtitle="Photos must be approved before they appear publicly"
        />
        {loading ? (
          <p className="text-sm text-[var(--color-muted)]">Loading…</p>
        ) : queue.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No photos pending review.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {queue.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
                <div className="relative h-56 bg-[var(--color-border-light)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.downloadUrl}
                    alt="Submitted photo"
                    className="h-full w-full object-cover"
                  />
                  <Badge
                    label="Pending"
                    status="pending"
                    className="absolute right-2 top-2"
                  />
                </div>
                <div className="p-3">
                  <p className="text-xs text-[var(--color-muted)]">
                    By: {item.uid?.slice(0, 10)}…
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {item.submittedAt?.toDate ? format(item.submittedAt.toDate(), "MMM d, yyyy HH:mm") : "—"}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      loading={reviewing === item.id}
                      onClick={() => handleReview(item.id, "approve")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      loading={reviewing === item.id}
                      onClick={() => handleReview(item.id, "reject")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Coin management */}
      <Card>
        <CardHeader title="Credit coins to user" subtitle="REQ-MAT-007 — Coins are used for profile unlocks and search pages" icon={<Coins className="h-4 w-4" />} />
        <form onSubmit={handleCreditCoins} className="grid gap-3 sm:grid-cols-2">
          <Input label="User ID" value={coinUserId} onChange={(e) => setCoinUserId(e.target.value)} required placeholder="Firebase Auth UID" />
          <Input label="Coins to credit" type="number" min={1} value={coinAmount} onChange={(e) => setCoinAmount(e.target.value)} required />
          <div className="sm:col-span-2">
            <Input label="Reason (optional)" value={coinReason} onChange={(e) => setCoinReason(e.target.value)} placeholder="e.g. Welcome bonus" />
          </div>
          <Button type="submit" loading={creditingCoins} className="sm:col-span-2">
            Credit coins
          </Button>
        </form>
      </Card>
    </div>
  );
}
