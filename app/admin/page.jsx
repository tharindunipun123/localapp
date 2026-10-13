"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { getDashboardStats } from "@/lib/services/admin";
import { ensureAppSettings } from "@/lib/services/cloudFunctions";

const empty = {
  pendingEvents: 0,
  approvedEvents: 0,
  totalUsers: 0,
  reportedReviews: 0,
  pendingKyc: 0,
  pendingVendors: 0,
  pendingWithdrawals: 0,
  kycApproved: 0,
  emailVerified: 0,
  activeLotteries: 0,
  lotteryTickets: 0,
  lotteryPool: 0,
  deposit7d: 0,
  spend7d: 0,
  p2p7d: 0,
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(empty);

  useEffect(() => {
    ensureAppSettings().catch(() => {});
    getDashboardStats().then((s) => setStats({ ...empty, ...s })).catch(() => {});
  }, []);

  const queues = [
    { href: "/admin/events/pending", label: "Pending events", value: stats.pendingEvents, hint: "Approve or reject listings" },
    { href: "/admin/kyc", label: "KYC queue", value: stats.pendingKyc, hint: "Identity sessions" },
    { href: "/admin/vendors", label: "Pending vendors", value: stats.pendingVendors, hint: "Business applications" },
    { href: "/admin/withdrawals", label: "Withdrawals", value: stats.pendingWithdrawals, hint: "Vendor payouts" },
    { href: "/admin/reviews", label: "Reported reviews", value: stats.reportedReviews, hint: "Moderation inbox" },
    { href: "/admin/lottery", label: "Active lotteries", value: stats.activeLotteries, hint: `${stats.lotteryTickets} tickets · ${stats.lotteryPool} pts pool` },
  ];

  const census = [
    { label: "Users", value: stats.totalUsers, href: "/admin/users", hint: `${stats.emailVerified} email verified · ${stats.kycApproved} KYC approved` },
    { label: "Approved events", value: stats.approvedEvents, href: "/admin/events", hint: "Live on public feeds" },
    { label: "Deposits (7d)", value: `LKR ${Number(stats.deposit7d).toLocaleString()}`, href: "/admin/transactions", hint: "Wallet top-ups" },
    { label: "Spend (7d)", value: `LKR ${Number(stats.spend7d).toLocaleString()}`, href: "/admin/transactions", hint: "Tickets and spend" },
    { label: "P2P (7d)", value: `LKR ${Number(stats.p2p7d).toLocaleString()}`, href: "/admin/transactions", hint: "User-to-user transfers" },
    { label: "Broadcast", value: "Send", href: "/admin/broadcast", hint: "Push a notice to all users" },
  ];

  return (
    <div>
      <p className="eyebrow">Operator desk</p>
      <h2 className="mt-1 mb-6 text-xl font-semibold tracking-tight text-[var(--color-fg)]">
        Live queues & KPIs
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {queues.map((c) => (
          <Link key={c.label} href={c.href}>
            <Card className="h-full transition-shadow hover:shadow-[var(--shadow-md)]">
              <p className="text-sm text-[var(--color-muted)]">{c.label}</p>
              <p className="money mt-1 text-3xl font-semibold text-[var(--color-warning-fg)]">{c.value}</p>
              <p className="mt-2 text-xs text-[var(--color-muted-fg)]">{c.hint}</p>
            </Card>
          </Link>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {census.map((c) => (
          <Link key={c.label} href={c.href}>
            <Card className="transition-shadow hover:shadow-[var(--shadow-md)]">
              <p className="text-sm text-[var(--color-muted)]">{c.label}</p>
              <p className="money mt-1 text-2xl font-semibold text-[var(--color-primary)]">{c.value}</p>
              {c.hint && <p className="mt-2 text-xs text-[var(--color-muted)]">{c.hint}</p>}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
