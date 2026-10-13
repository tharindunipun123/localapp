"use client";

import { useEffect, useState } from "react";
import { CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { getAllEventsAdmin } from "@/lib/services/events";
import { moderateEvent, linkEventToAttraction } from "@/lib/services/cloudFunctions";
import { getAttractions } from "@/lib/services/places";
import { format } from "date-fns";

export default function AdminEventsPage() {
  const [events, setEvents] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [attractions, setAttractions] = useState([]);
  const [linkFor, setLinkFor] = useState("");
  const [attractionId, setAttractionId] = useState("");

  useEffect(() => {
    getAllEventsAdmin(statusFilter || undefined).then(setEvents);
  }, [statusFilter]);

  useEffect(() => {
    getAttractions(80).then(setAttractions).catch(() => setAttractions([]));
  }, []);

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
                <td className="px-4 py-3 text-right space-x-2">
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
                  <Button size="sm" variant="ghost" onClick={() => { setLinkFor(e.id); setAttractionId(e.attractionRef ?? ""); }}>
                    Link place
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 && (
          <p className="p-4 text-[var(--color-muted)]">No events found.</p>
        )}
      </div>

      {linkFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--color-card)] p-5 shadow-lg">
            <h3 className="mb-3 font-semibold">Link event to attraction</h3>
            <Select
              options={[
                { value: "", label: "Select attraction" },
                ...attractions.map((a) => ({ value: a.id, label: a.name })),
              ]}
              value={attractionId}
              onChange={(e) => setAttractionId(e.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <Button
                loading={loading}
                disabled={!attractionId}
                onClick={async () => {
                  setLoading(true);
                  try {
                    await linkEventToAttraction(linkFor, attractionId);
                    setLinkFor("");
                    getAllEventsAdmin(statusFilter || undefined).then(setEvents);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Save
              </Button>
              <Button variant="outline" onClick={() => setLinkFor("")}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
