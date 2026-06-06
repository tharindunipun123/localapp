"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { getPromoCodes, getPromoRedemptions, createPromoCode } from "@/lib/services/promo";
import { getUserProfiles } from "@/lib/services/users";
import { format } from "date-fns";

const DEFAULT_FORM = {
  code: "",
  discountType: "percentage",
  discountValue: 10,
  minPurchase: 0,
  maxUses: 100,
  applicableTo: "all",
  validFrom: new Date().toISOString().slice(0, 16),
  validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16),
};

export default function AdminPromosPage() {
  const [promos, setPromos] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [userNames, setUserNames] = useState({});
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  // Analytics computed from redemptions
  const analytics = useMemo(() => {
    const byPromo = {};
    let totalDiscount = 0;
    for (const r of redemptions) {
      const key = r.promoId ?? "unknown";
      byPromo[key] = (byPromo[key] ?? 0) + 1;
      totalDiscount += r.discount ?? 0;
    }
    return { byPromo, totalDiscount, totalUses: redemptions.length };
  }, [redemptions]);

  function reload() {
    getPromoCodes().then(setPromos);
    getPromoRedemptions().then((r) => {
      setRedemptions(r);
      const uids = [...new Set(r.map((x) => x.userId).filter(Boolean))];
      if (uids.length) getUserProfiles(uids).then(setUserNames);
    });
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await createPromoCode({
        ...form,
        discountValue: Number(form.discountValue),
        minPurchase: Number(form.minPurchase),
        maxUses: Number(form.maxUses),
        validFrom: new Date(form.validFrom).getTime(),
        validUntil: new Date(form.validUntil).getTime(),
      });
      setForm({ ...DEFAULT_FORM, code: "" });
      reload();
    } finally {
      setLoading(false);
    }
  }

  function promoStatus(p) {
    const now = Date.now();
    const from = p.validFrom?.toMillis?.() ?? p.validFrom ?? 0;
    const until = p.validUntil?.toMillis?.() ?? p.validUntil ?? Infinity;
    if (now < from) return "scheduled";
    if (now > until) return "expired";
    if ((p.usedCount ?? 0) >= (p.maxUses ?? Infinity)) return "exhausted";
    return "active";
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Promo Codes</h1>

      {/* Summary analytics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total codes" value={promos.length} />
        <StatCard label="Total redemptions" value={analytics.totalUses} />
        <StatCard label="Total discount given" value={`LKR ${analytics.totalDiscount.toLocaleString()}`} />
      </div>

      <Card>
        <CardHeader title="Create promo code" subtitle="REQ-PRO-001" />
        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Code"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            required
          />
          <Select
            label="Discount type"
            options={[
              { value: "percentage", label: "Percentage %" },
              { value: "fixed_LKR", label: "Fixed LKR" },
            ]}
            value={form.discountType}
            onChange={(e) => setForm({ ...form, discountType: e.target.value })}
          />
          <Input
            label={form.discountType === "percentage" ? "Discount %" : "Discount LKR"}
            type="number"
            min={0}
            max={form.discountType === "percentage" ? 100 : undefined}
            value={form.discountValue}
            onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
          />
          <Input
            label="Min purchase (LKR)"
            type="number"
            min={0}
            value={form.minPurchase}
            onChange={(e) => setForm({ ...form, minPurchase: e.target.value })}
          />
          <Input
            label="Max uses"
            type="number"
            min={1}
            value={form.maxUses}
            onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
          />
          <Select
            label="Applicable to"
            options={[
              { value: "all", label: "All" },
              { value: "events", label: "Events only" },
              { value: "vendors", label: "Vendors only" },
            ]}
            value={form.applicableTo}
            onChange={(e) => setForm({ ...form, applicableTo: e.target.value })}
          />
          {/* REQ-PRO-001: valid_from / valid_until */}
          <div>
            <label className="mb-1 block text-sm font-medium">Valid from</label>
            <input
              type="datetime-local"
              value={form.validFrom}
              onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Valid until</label>
            <input
              type="datetime-local"
              value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              required
            />
          </div>
          <Button type="submit" loading={loading} className="sm:col-span-2">
            Create promo code
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="All codes" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[var(--color-muted)]">
                <th className="p-2">Code</th>
                <th className="p-2">Discount</th>
                <th className="p-2">Used / Max</th>
                <th className="p-2">Applicable</th>
                <th className="p-2">Valid from</th>
                <th className="p-2">Valid until</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => {
                const status = promoStatus(p);
                const fromMs = p.validFrom?.toMillis?.() ?? p.validFrom;
                const untilMs = p.validUntil?.toMillis?.() ?? p.validUntil;
                return (
                  <tr key={p.id} className="border-b">
                    <td className="p-2 font-mono font-medium">{p.code}</td>
                    <td className="p-2">
                      {p.discountType === "percentage"
                        ? `${p.discountValue}%`
                        : `LKR ${p.discountValue}`}
                    </td>
                    <td className="p-2">
                      {p.usedCount ?? 0} / {p.maxUses}
                    </td>
                    <td className="p-2 capitalize">{p.applicableTo ?? "all"}</td>
                    <td className="p-2 text-xs">
                      {fromMs ? format(new Date(fromMs), "MMM d, yyyy HH:mm") : "—"}
                    </td>
                    <td className="p-2 text-xs">
                      {untilMs ? format(new Date(untilMs), "MMM d, yyyy HH:mm") : "—"}
                    </td>
                    <td className="p-2">
                      <StatusBadge status={status} />
                    </td>
                  </tr>
                );
              })}
              {promos.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-[var(--color-muted)]">
                    No promo codes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* REQ-PRO-004: Enriched analytics */}
      <Card>
        <CardHeader title="Redemption analytics" subtitle="REQ-PRO-004" />
        {redemptions.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No redemptions yet.</p>
        ) : (
          <>
            {/* Per-promo breakdown */}
            <h3 className="mb-2 text-sm font-semibold">By promo code</h3>
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[var(--color-muted)]">
                    <th className="p-2">Promo ID</th>
                    <th className="p-2">Code</th>
                    <th className="p-2">Redemptions</th>
                    <th className="p-2">Total discount</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(analytics.byPromo)
                    .sort((a, b) => b[1] - a[1])
                    .map(([promoId, count]) => {
                      const promoObj = promos.find((p) => p.id === promoId);
                      const totalDis = redemptions
                        .filter((r) => r.promoId === promoId)
                        .reduce((s, r) => s + (r.discount ?? 0), 0);
                      return (
                        <tr key={promoId} className="border-b">
                          <td className="p-2 font-mono text-xs">{promoId.slice(0, 8)}</td>
                          <td className="p-2 font-mono font-medium">
                            {promoObj?.code ?? "—"}
                          </td>
                          <td className="p-2">{count}</td>
                          <td className="p-2">LKR {totalDis.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Individual redemptions */}
            <h3 className="mb-2 text-sm font-semibold">Recent redemptions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[var(--color-muted)]">
                    <th className="p-2">User</th>
                    <th className="p-2">Promo code</th>
                    <th className="p-2">Discount</th>
                    <th className="p-2">Purchase</th>
                    <th className="p-2">Context</th>
                    <th className="p-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {redemptions.slice(0, 50).map((r) => {
                    const promoObj = promos.find((p) => p.id === r.promoId);
                    return (
                      <tr key={r.id} className="border-b">
                        <td className="p-2">
                          {userNames[r.userId]?.displayName ?? r.userId?.slice(0, 8) ?? "—"}
                        </td>
                        <td className="p-2 font-mono">
                          {promoObj?.code ?? r.promoId?.slice(0, 8) ?? "—"}
                        </td>
                        <td className="p-2">LKR {r.discount ?? 0}</td>
                        <td className="p-2">
                          {r.purchaseAmount ? `LKR ${r.purchaseAmount}` : "—"}
                        </td>
                        <td className="p-2 capitalize">
                          {r.context ?? (r.eventId ? "event" : "—")}
                        </td>
                        <td className="p-2 text-xs">
                          {r.createdAt?.toDate
                            ? format(r.createdAt.toDate(), "MMM d, yyyy HH:mm")
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    active: "approved",
    scheduled: "pending",
    expired: "rejected",
    exhausted: "rejected",
  };
  return <Badge label={status} status={map[status] ?? "pending"} />;
}
