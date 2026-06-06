"use client";

import { useEffect, useState } from "react";
import { CardHeader } from "@/components/ui/Card";
import { getAuditLogs } from "@/lib/services/admin";
import { format } from "date-fns";

export default function AdminAuditPage() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    getAuditLogs().then(setLogs);
  }, []);

  return (
    <div>
      <CardHeader title="Audit Logs" subtitle="Admin action history" />
      <div className="mt-4 space-y-2">
        {logs.map((l) => (
          <div
            key={l.id}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--color-fg)]">{l.action}</span>
              <span className="text-xs text-[var(--color-muted-fg)]">
                {format(l.createdAt.toDate(), "MMM d, yyyy HH:mm")}
              </span>
            </div>
            <p className="text-[var(--color-muted)]">
              {l.targetType}: {l.targetId}
            </p>
            {l.details && (
              <p className="mt-1 text-xs text-[var(--color-muted-fg)]">{l.details}</p>
            )}
          </div>
        ))}
        {logs.length === 0 && (
          <p className="text-[var(--color-muted)]">No audit logs yet.</p>
        )}
      </div>
    </div>
  );
}
