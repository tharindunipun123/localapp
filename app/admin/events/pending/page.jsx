"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { getPendingEvents } from "@/lib/services/events";
import { moderateEvent } from "@/lib/services/cloudFunctions";
import { format } from "date-fns";

export default function PendingEventsPage() {
  const [events, setEvents] = useState([]);
  const [rejectId, setRejectId] = useState(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  function refresh() {
    getPendingEvents().then(setEvents);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAction(eventId, action) {
    setLoading(true);
    try {
      await moderateEvent(eventId, action, action === "reject" ? reason : undefined);
      setRejectId(null);
      setReason("");
      refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <CardHeader
        title="Pending Events"
        subtitle="Review and approve new event submissions"
      />
      <div className="space-y-3">
        {events.map((e) => (
          <Card key={e.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-[var(--color-fg)]">{e.title}</p>
              <p className="text-sm text-[var(--color-muted)]">
                {format(e.startDatetime.toDate(), "MMM d, yyyy")}
              </p>
              <Badge label={e.category} status={e.category} />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleAction(e.id, "approve")}
                loading={loading}
              >
                Approve
              </Button>
              <Button size="sm" variant="danger" onClick={() => setRejectId(e.id)}>
                Reject
              </Button>
            </div>
          </Card>
        ))}
        {events.length === 0 && (
          <p className="text-[var(--color-muted)]">No pending events.</p>
        )}
      </div>

      <Modal open={!!rejectId} onClose={() => setRejectId(null)} title="Reject Event">
        <Textarea
          label="Rejection reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRejectId(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={loading}
            onClick={() => rejectId && handleAction(rejectId, "reject")}
          >
            Reject
          </Button>
        </div>
      </Modal>
    </div>
  );
}
