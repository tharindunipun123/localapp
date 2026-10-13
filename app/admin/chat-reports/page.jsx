"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getAdminChatReports, reviewChatReport } from "@/lib/services/cloudFunctions";
import { parseFirestoreTime } from "@/lib/firestoreTime";
import { format } from "date-fns";
import { ShieldAlert } from "lucide-react";

export default function AdminChatReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function reload() {
    setError("");
    getAdminChatReports()
      .then(setReports)
      .catch((err) => {
        setReports([]);
        setError(err instanceof Error ? err.message : "Failed to load reports");
      });
  }

  useEffect(() => {
    reload();
  }, []);

  async function handle(reportId, action) {
    setLoading(true);
    try {
      await reviewChatReport(reportId, action);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Chat reports</h1>
      {error && <p className="mb-4 text-sm text-[var(--color-danger-fg)]">{error}</p>}
      {reports.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">No pending reports.</p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {reports.map((r) => {
            const at = parseFirestoreTime(r.createdAt);
            return (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <CardHeader
                    title={`Group ${r.groupId}`}
                    subtitle={`Message ${r.messageId} · Reporter ${r.reporterId}`}
                  />
                  <Badge label={r.status} status="pending" />
                </div>
                <p className="flex items-start gap-2 text-sm text-[var(--color-fg)]">
                  <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-600" />
                  {r.reason}
                </p>
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  {at ? format(at, "MMM d, yyyy HH:mm") : "—"}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="danger" loading={loading} onClick={() => handle(r.id, "remove")}>
                    Remove message
                  </Button>
                  <Button size="sm" variant="outline" loading={loading} onClick={() => handle(r.id, "dismiss")}>
                    Dismiss
                  </Button>
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
