"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/providers/AuthProvider";
import { getVendorPrograms } from "@/lib/services/vendors";
import { createLoyaltyProgram, updateLoyaltyProgram, topUpPointsPool } from "@/lib/services/loyalty";
import { createPromoCode } from "@/lib/services/promo";

export default function VendorLoyaltyPage() {
  const { profile } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    programName: "",
    spendAmount: 1000,
    pointsAwarded: 10,
    pointsRequired: 1000,
    rewardDescription: "Free reward",
    expiryPolicy: "never",
    expiryDays: 180,
  });
  const [topUp, setTopUp] = useState({ lkrAmount: 1000, pointsAmount: 1000 });
  const [poolMessage, setPoolMessage] = useState("");
  const [promoForm, setPromoForm] = useState({ code: "", discountValue: 10 });
  const [promoMessage, setPromoMessage] = useState("");

  function reload() {
    if (profile?.uid) getVendorPrograms(profile.uid).then(setPrograms);
  }

  useEffect(() => {
    reload();
  }, [profile]);

  async function handleCreate(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await createLoyaltyProgram({
        programName: form.programName,
        earnRule: { spendAmount: Number(form.spendAmount), pointsAwarded: Number(form.pointsAwarded) },
        redeemRule: { pointsRequired: Number(form.pointsRequired), rewardDescription: form.rewardDescription },
        expiryPolicy: form.expiryPolicy,
        expiryDays: Number(form.expiryDays),
        isActive: true,
      });
      setForm({ ...form, programName: "" });
      reload();
    } finally {
      setLoading(false);
    }
  }

  async function toggleProgram(programId, isActive) {
    await updateLoyaltyProgram(programId, { isActive: !isActive });
    reload();
  }

  async function handleTopUp(e) {
    e.preventDefault();
    setLoading(true);
    setPoolMessage("");
    try {
      const result = await topUpPointsPool({
        lkrAmount: Number(topUp.lkrAmount),
        pointsAmount: Number(topUp.pointsAmount),
      });
      setPoolMessage(result.message ?? "Request submitted — admin will approve.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePromo(e) {
    e.preventDefault();
    setLoading(true);
    setPromoMessage("");
    try {
      await createPromoCode({
        code: promoForm.code,
        discountType: "percentage",
        discountValue: Number(promoForm.discountValue),
        applicableTo: "vendors",
        validUntil: Date.now() + 30 * 86400000,
      });
      setPromoForm({ code: "", discountValue: 10 });
      setPromoMessage("Promo code created.");
    } catch (err) {
      setPromoMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-fg)]">Loyalty Programs</h1>

      <Card>
        <CardHeader title="Create program" subtitle="Define earn & redeem rules" />
        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
          <Input label="Program name" value={form.programName} onChange={(e) => setForm({ ...form, programName: e.target.value })} required />
          <Input label="Spend (LKR) for earn rule" type="number" value={form.spendAmount} onChange={(e) => setForm({ ...form, spendAmount: e.target.value })} />
          <Input label="Points awarded" type="number" value={form.pointsAwarded} onChange={(e) => setForm({ ...form, pointsAwarded: e.target.value })} />
          <Input label="Points to redeem" type="number" value={form.pointsRequired} onChange={(e) => setForm({ ...form, pointsRequired: e.target.value })} />
          <Input label="Reward description" value={form.rewardDescription} onChange={(e) => setForm({ ...form, rewardDescription: e.target.value })} className="sm:col-span-2" />
          <Button type="submit" loading={loading} className="sm:col-span-2">Create program</Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="Top up points pool" subtitle="Requires admin approval (REQ-VND-005)" />
        <form onSubmit={handleTopUp} className="flex flex-wrap gap-3">
          <Input label="LKR amount" type="number" value={topUp.lkrAmount} onChange={(e) => setTopUp({ ...topUp, lkrAmount: e.target.value })} />
          <Input label="Points to add" type="number" value={topUp.pointsAmount} onChange={(e) => setTopUp({ ...topUp, pointsAmount: e.target.value })} />
          <Button type="submit" loading={loading} className="self-end">Request top-up</Button>
        </form>
        {poolMessage && <p className="mt-2 text-sm text-[var(--color-primary)]">{poolMessage}</p>}
      </Card>

      <Card>
        <CardHeader title="Create vendor promo code" subtitle="REQ-PRO-001" />
        <form onSubmit={handleCreatePromo} className="flex flex-wrap gap-3">
          <Input label="Code" value={promoForm.code} onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })} required />
          <Input label="Discount %" type="number" value={promoForm.discountValue} onChange={(e) => setPromoForm({ ...promoForm, discountValue: e.target.value })} />
          <Button type="submit" loading={loading} className="self-end">Create promo</Button>
        </form>
        {promoMessage && <p className="mt-2 text-sm text-[var(--color-primary)]">{promoMessage}</p>}
      </Card>

      <Card>
        <CardHeader title="Your programs" />
        {programs.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No programs yet.</p>
        ) : (
          <ul className="space-y-3">
            {programs.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-lg)] border p-3">
                <div>
                  <p className="font-medium">{p.programName}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    LKR {p.earnRule?.spendAmount} → {p.earnRule?.pointsAwarded} pts · Redeem {p.redeemRule?.pointsRequired} pts
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={p.isActive ? "Active" : "Paused"} status={p.isActive ? "approved" : "pending"} />
                  <Button size="sm" variant="outline" onClick={() => toggleProgram(p.id, p.isActive)}>
                    {p.isActive ? "Pause" : "Activate"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
