"use client";

import { useEffect, useState } from "react";
import { CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { getAllEventsAdmin } from "@/lib/services/events";
import { moderateEvent } from "@/lib/services/cloudFunctions";
import { format } from "date-fns";

export default function AdminEventsPage() {
  const [events, setEvents] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAllEventsAdmin(statusFilter || undefined).then(setEvents);
  }, [statusFilter]);

  async function toggleFeature(eventId, featured) {
    setLoading(true);
    await moderateEvent(eventId, featured ? "unfeature" : "feature");
    getAllEventsAdmin(statusFilter || undefined).then(setEvents);
    setLoading(false);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <CardHeader title="Manage Events" />
        <Select
          options={[
            { value: "", label: "All statuses" },
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "expired", label: "Expired" },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40"
        />
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)]">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border-light)] bg-[var(--color-bg)]">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-muted)]">Title</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-muted)]">Date</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-muted)]">Status</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-muted)]">Featured</th>
              <th className="px-4 py-3 text-right font-medium text-[var(--color-muted)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-[var(--color-border-light)]">
                <td className="px-4 py-3 font-medium text-[var(--color-fg)]">{e.title}</td>
                <td className="px-4 py-3 text-[var(--color-muted)]">
                  {format(e.startDatetime.toDate(), "MMM d, yyyy")}
                </td>
                <td className="px-4 py-3">
                  <Badge label={e.status} status={e.status} />
                </td>
                <td className="px-4 py-3 text-[var(--color-fg)]">
                  {e.isFeatured ? "Yes" : "No"}
                </td>
                <td className="px-4 py-3 text-right">
                  {e.status === "approved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={loading}
                      onClick={() => toggleFeature(e.id, e.isFeatured)}
                    >
                      {e.isFeatured ? "Unfeature" : "Feature"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 && (
          <p className="p-4 text-[var(--color-muted)]">No events found.</p>
        )}
      </div>
    </div>
  );
}
