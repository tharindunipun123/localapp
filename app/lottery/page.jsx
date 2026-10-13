"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { purchaseLotteryTicket } from "@/lib/services/cloudFunctions";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { PageHero } from "@/components/layout/PageHero";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/providers/AuthProvider";
import { format } from "date-fns";
import { Ticket } from "lucide-react";

export default function LotteryPage() {
  return (
    <RoleGuard requireAuth>
      <PublicLayout>
        <LotteryContent />
      </PublicLayout>
    </RoleGuard>
  );
}

function LotteryContent() {
  const { profile } = useAuth();
  const [lotteries, setLotteries] = useState([]);
  const [myEntries, setMyEntries] = useState(new Set());
  const [entering, setEntering] = useState(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function load() {
    const q = query(
      collection(db, "lotteries"),
      where("status", "==", "active"),
      orderBy("drawDate", "asc")
    );
    const snap = await getDocs(q);
    setLotteries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

    if (profile?.uid) {
      const entriesQ = query(
        collection(db, "lotteryEntries"),
        where("userId", "==", profile.uid)
      );
      const entriesSnap = await getDocs(entriesQ);
      setMyEntries(new Set(entriesSnap.docs.map((d) => d.data().lotteryId)));
    }
  }

  useEffect(() => {
    load();
  }, [profile]);

  async function handleEnter(lotteryId) {
    setEntering(lotteryId);
    setMessage("");
    try {
      await purchaseLotteryTicket(lotteryId);
      setMessage("You're entered! Good luck!");
      setIsError(false);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to enter");
      setIsError(true);
    } finally {
      setEntering(null);
    }
  }

  return (
    <>
      <PageHero
        compact
        segment="lottery"
        image="/images/hero-lottery.png"
        eyebrow="Rewards"
        title="Loyalty lottery"
        subtitle="Enter with locked loyalty points. Draws are administered from the operator console."
      />
    <div className="mx-auto max-w-2xl px-4 py-8">
      {message && (
        <p
          className={`mb-4 rounded-lg px-3 py-2 text-sm ${
            isError
              ? "bg-[var(--color-danger-light)] text-[var(--color-danger-fg)]"
              : "bg-[var(--color-success-light)] text-[var(--color-success-fg)]"
          }`}
        >
          {message}
        </p>
      )}

      {lotteries.length === 0 && (
        <Card>
          <p className="py-8 text-center text-[var(--color-muted)]">
            No active lotteries right now. Check back soon!
          </p>
        </Card>
      )}

      <div className="space-y-4">
        {lotteries.map((l) => {
          const drawMs = l.drawDate?.toMillis?.() ?? l.drawDate;
          const entered = myEntries.has(l.id);
          return (
            <Card key={l.id}>
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-lg">{l.title}</h2>
                    {entered && <Badge label="Entered" status="approved" />}
                  </div>
                  {l.description && (
                    <p className="mt-1 text-sm text-[var(--color-muted)]">{l.description}</p>
                  )}
                  <p className="mt-2 text-sm">
                    <span className="font-medium text-[var(--segment-lottery)]">Prize:</span> {l.prize}
                  </p>
                  <p className="text-sm text-[var(--color-muted)]">
                    <Ticket className="mr-1 inline h-3.5 w-3.5" />
                    Entry cost: <span className="font-medium">{l.pointsCost} loyalty pts</span>
                    {" · "}
                    {l.entryCount ?? 0} entries so far
                  </p>
                  {drawMs && (
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      Draw: {format(new Date(drawMs), "MMMM d, yyyy 'at' HH:mm")}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  disabled={entered || entering !== null}
                  loading={entering === l.id}
                  onClick={() => handleEnter(l.id)}
                >
                  {entered ? "Entered" : `Enter (${l.pointsCost} pts)`}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
    </>
  );
}
