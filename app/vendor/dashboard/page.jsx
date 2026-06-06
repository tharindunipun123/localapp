"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/providers/AuthProvider";
import {
  getVendor,
  getVendorWallet,
  getVendorPrograms,
  getVendorGrants,
  getVendorTransactions,
  getLinkedUsersSummary,
} from "@/lib/services/vendors";
import { getUserProfiles } from "@/lib/services/users";
import { format } from "date-fns";
import Link from "next/link";
import { Gift, Wallet, Users, Pencil } from "lucide-react";

export default function VendorDashboardPage() {
  const { profile } = useAuth();
  const [vendor, setVendor] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [grants, setGrants] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [linkedUsers, setLinkedUsers] = useState([]);
  const [userNames, setUserNames] = useState({});

  useEffect(() => {
    if (!profile?.uid) return;
    const id = profile.uid;
    Promise.all([
      getVendor(id),
      getVendorWallet(id),
      getVendorPrograms(id),
      getVendorGrants(id),
      getVendorTransactions(id),
      getLinkedUsersSummary(id),
    ]).then(([v, w, p, g, t, linked]) => {
      setVendor(v);
      setWallet(w);
      setPrograms(p);
      setGrants(g);
      setTransactions(t);
      setLinkedUsers(linked);
      const ids = linked.map((u) => u.userId);
      getUserProfiles(ids).then(setUserNames);
    });
  }, [profile]);

  const activePrograms = programs.filter((p) => p.isActive);
  const pendingGrants = grants.filter((g) => g.status === "pending");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">
          {vendor?.businessName ?? "Vendor Dashboard"}
        </h1>
        <Link
          href="/vendor/profile/edit"
          className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit profile
        </Link>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Gift} label="Active programs" value={activePrograms.length} />
        <StatCard icon={Wallet} label="Points pool" value={(wallet?.pointsPool ?? 0).toLocaleString()} />
        <StatCard icon={Wallet} label="Cash balance" value={`LKR ${(wallet?.cashBalance ?? 0).toLocaleString()}`} />
        <StatCard icon={Users} label="Linked customers" value={linkedUsers.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Active loyalty programs" />
          {activePrograms.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No active programs.</p>
          ) : (
            <ul className="space-y-2">
              {activePrograms.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded border p-3 text-sm">
                  <span className="font-medium">{p.programName}</span>
                  <Badge label="Active" status="approved" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Linked users summary" subtitle="REQ-VND-002" />
          {linkedUsers.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No customers yet.</p>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
              {linkedUsers.map((u) => (
                <li key={u.userId} className="flex justify-between border-b py-1">
                  <span>{userNames[u.userId]?.displayName ?? u.userId.slice(0, 8)}…</span>
                  <span className="text-[var(--color-muted)]">{u.grants} visits · {u.points} pts</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Transaction history" subtitle="Points & wallet activity" />
          {transactions.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No transactions yet.</p>
          ) : (
            <ul className="space-y-2">
              {transactions.slice(0, 12).map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium capitalize">{t.type?.replace(/_/g, " ")}</p>
                    <p className="text-[var(--color-muted)]">{t.description}</p>
                  </div>
                  <div className="text-right">
                    <p>{t.currency === "POINTS" ? `${t.amount} pts` : `LKR ${t.amount}`}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {t.createdAt?.toDate ? format(t.createdAt.toDate(), "MMM d HH:mm") : "—"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <Card className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-primary-light)] text-[var(--color-primary)]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-[var(--color-muted)]">{label}</p>
        <p className="text-lg font-bold text-[var(--color-fg)]">{value}</p>
      </div>
    </Card>
  );
}
