"use client";

import { useEffect, useMemo, useState } from "react";
import { CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { getAllTransactionsAdminWithUsers } from "@/lib/services/wallet";
import { format } from "date-fns";
import { ArrowDownUp, Search } from "lucide-react";

function formatTransactionDate(createdAt) {
  if (!createdAt) return "—";
  const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "MMM d, yyyy · h:mm a");
}

function getTimestamp(createdAt) {
  if (!createdAt) return 0;
  if (createdAt.toMillis) return createdAt.toMillis();
  if (createdAt.toDate) return createdAt.toDate().getTime();
  return new Date(createdAt).getTime() || 0;
}

function matchesSearch(transaction, query) {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const haystack = [
    transaction.userId,
    transaction.userDisplayName,
    transaction.userEmail,
    transaction.type,
    transaction.status,
    String(transaction.amount ?? ""),
    formatTransactionDate(transaction.createdAt),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [newestFirst, setNewestFirst] = useState(true);

  useEffect(() => {
    getAllTransactionsAdminWithUsers(200, "desc")
      .then(setTransactions)
      .finally(() => setLoading(false));
  }, []);

  const typeOptions = useMemo(() => {
    const types = [...new Set(transactions.map((t) => t.type).filter(Boolean))];
    return [
      { value: "all", label: "All types" },
      ...types.map((t) => ({ value: t, label: t.replace(/_/g, " ") })),
    ];
  }, [transactions]);

  const filtered = useMemo(() => {
    let list = transactions.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return matchesSearch(t, search);
    });

    list.sort((a, b) => {
      const diff = getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
      return newestFirst ? diff : -diff;
    });

    return list;
  }, [transactions, search, typeFilter, statusFilter, newestFirst]);

  return (
    <div>
      <CardHeader title="Transactions" subtitle="Wallet transaction history" />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[220px] flex-1">
          <Input
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="User ID, name, email, type, amount…"
          />
        </div>
        <Select
          label="Type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          options={typeOptions}
          className="w-full sm:w-40"
        />
        <Select
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: "all", label: "All statuses" },
            { value: "success", label: "Success" },
            { value: "failed", label: "Failed" },
            { value: "pending", label: "Pending" },
          ]}
          className="w-full sm:w-40"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => setNewestFirst((v) => !v)}
          className="shrink-0"
        >
          <ArrowDownUp className="h-4 w-4" />
          {newestFirst ? "Newest first" : "Oldest first"}
        </Button>
      </div>

      <p className="mt-3 text-sm text-[var(--color-muted)]">
        {loading ? "Loading…" : `${filtered.length} transaction${filtered.length !== 1 ? "s" : ""}`}
        {search.trim() && !loading && ` matching "${search.trim()}"`}
      </p>

      <div className="mt-2 overflow-x-auto rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)]">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-[var(--color-border-light)] bg-[var(--color-bg)]">
            <tr>
              <th className="px-4 py-3 text-left">Date &amp; time</th>
              <th className="px-4 py-3 text-left">User ID</th>
              <th className="px-4 py-3 text-left">Username</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-muted)]">
                  Loading transactions…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-muted)]">
                  <Search className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  No transactions match your filters.
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((t) => (
                <tr key={t.id} className="border-b border-[var(--color-border-light)]">
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--color-muted)]">
                    {formatTransactionDate(t.createdAt)}
                  </td>
                  <td className="max-w-[180px] px-4 py-3">
                    <code
                      className="block truncate font-mono text-xs text-[var(--color-fg)]"
                      title={t.userId}
                    >
                      {t.userId ?? "—"}
                    </code>
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--color-fg)]">
                    {t.userDisplayName}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{t.userEmail}</td>
                  <td className="px-4 py-3 capitalize">{t.type?.replace(/_/g, " ") ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-[var(--color-fg)]">
                    LKR {(t.amount ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={t.status} status={t.status} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
