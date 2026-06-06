"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/providers/AuthProvider";
import { getVendor, getCorporateBindings, getCorporateWorkTransactions } from "@/lib/services/vendors";
import { corporateTopUpUser } from "@/lib/services/cloudFunctions";
import { format } from "date-fns";

export default function VendorCorporatePage() {
  const { profile } = useAuth();
  const [vendor, setVendor] = useState(null);
  const [bindings, setBindings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [topUp, setTopUp] = useState({ userId: "", amount: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile?.uid) return;
    getVendor(profile.uid).then(setVendor);
    getCorporateBindings(profile.uid).then(setBindings);
    getCorporateWorkTransactions(profile.uid).then(setTransactions);
  }, [profile]);

  if (vendor && !vendor.isCorporate) {
    return (
      <Card>
        <CardHeader title="Corporate accounts" subtitle="Not enabled for your vendor" />
        <p className="text-sm text-[var(--color-muted)]">Contact admin to designate your account as corporate (REQ-WAL-009).</p>
      </Card>
    );
  }

  async function handleTopUp(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await corporateTopUpUser({ userId: topUp.userId, amount: Number(topUp.amount) });
      setTopUp({ userId: "", amount: "" });
      getCorporateWorkTransactions(profile.uid).then(setTransactions);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Corporate Portal</h1>

      <Card>
        <CardHeader title="Top up employee work balance" subtitle="REQ-WAL-010" />
        <form onSubmit={handleTopUp} className="flex flex-wrap gap-3">
          <Input label="User ID" value={topUp.userId} onChange={(e) => setTopUp({ ...topUp, userId: e.target.value })} />
          <Input label="Amount LKR" type="number" value={topUp.amount} onChange={(e) => setTopUp({ ...topUp, amount: e.target.value })} />
          <Button type="submit" loading={loading} className="self-end">Top up work balance</Button>
        </form>
      </Card>

      <Card>
        <CardHeader title={`Linked users (${bindings.length})`} subtitle="REQ-WAL-012" />
        {bindings.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No users bound yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {bindings.map((b) => (
              <li key={b.id} className="rounded border p-2">User {b.userId} · {b.status}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Work balance transactions" subtitle="REQ-WAL-011 — personal balance hidden" />
        {transactions.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No work balance transactions.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {transactions.map((t) => (
              <li key={t.id} className="flex justify-between border-b py-2">
                <span>{t.description ?? t.type}</span>
                <span>LKR {t.amount} · {t.createdAt?.toDate ? format(t.createdAt.toDate(), "MMM d HH:mm") : "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
