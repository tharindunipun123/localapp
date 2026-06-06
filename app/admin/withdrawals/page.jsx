"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getPendingWithdrawals } from "@/lib/services/vendors";
import { processVendorWithdrawal } from "@/lib/services/cloudFunctions";
import { format } from "date-fns";

export default function AdminWithdrawalsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  function reload() {
    getPendingWithdrawals().then(setRequests);
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleAction(requestId, action) {
    setLoading(true);
    try {
      await processVendorWithdrawal(requestId, action);
      reload();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Vendor Withdrawals</h1>
      <Card>
        <CardHeader title="Pending requests" subtitle="REQ-WAL-006 — approve after offline bank transfer" />
        {requests.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No pending withdrawal requests.</p>
        ) : (
          <ul className="space-y-4">
            {requests.map((r) => (
              <li key={r.id} className="rounded border p-4">
                <p className="font-medium">LKR {r.amount?.toLocaleString()}</p>
                <p className="text-sm text-[var(--color-muted)]">Vendor: {r.vendorId}</p>
                <p className="text-sm text-[var(--color-muted)]">Bank: {r.bankDetails}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  {r.createdAt?.toDate ? format(r.createdAt.toDate(), "MMM d, yyyy HH:mm") : "—"}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" loading={loading} onClick={() => handleAction(r.id, "approve")}>Mark processed</Button>
                  <Button size="sm" variant="danger" loading={loading} onClick={() => handleAction(r.id, "reject")}>Reject</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
