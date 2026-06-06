"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { getDashboardStats } from "@/lib/services/admin";
import { ensureAppSettings } from "@/lib/services/cloudFunctions";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    pendingEvents: 0,
    approvedEvents: 0,
    totalUsers: 0,
    reportedReviews: 0,
  });

  useEffect(() => {
    ensureAppSettings().catch(() => {});
    getDashboardStats().then(setStats).catch(() => {});
  }, []);

  const cards = [
    { label: "Pending Events", value: stats.pendingEvents, color: "text-[var(--color-warning-fg)]" },
    { label: "Approved Events", value: stats.approvedEvents, color: "text-[var(--color-success-fg)]" },
    { label: "Total Users", value: stats.totalUsers, color: "text-[var(--color-primary)]" },
    { label: "Reported Reviews", value: stats.reportedReviews, color: "text-[var(--color-danger-fg)]" },
  ];

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-[var(--color-fg)]">Dashboard Overview</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <p className="text-sm text-[var(--color-muted)]">{c.label}</p>
            <p className={`mt-1 text-3xl font-bold ${c.color}`}>{c.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
