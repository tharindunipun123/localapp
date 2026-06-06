"use client";

import { useEffect, useState } from "react";
import { CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getReportedReviews, getAllReviewsAdmin, hideReview } from "@/lib/services/reviews";

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    (showAll ? getAllReviewsAdmin() : getReportedReviews()).then(setReviews);
  }, [showAll]);

  async function handleHide(id) {
    await hideReview(id);
    (showAll ? getAllReviewsAdmin() : getReportedReviews()).then(setReviews);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <CardHeader title="Reviews" subtitle="Moderate attraction reviews" />
        <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show Reported Only" : "Show All"}
        </Button>
      </div>
      <div className="space-y-3">
        {reviews.map((r) => (
          <div
            key={r.id}
            className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-4"
          >
            <div className="flex items-center justify-between">
              <p className="font-medium text-[var(--color-fg)]">
                {r.userDisplayName ?? r.userId}
              </p>
              <Badge label={r.status} status={r.status} />
            </div>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{r.comment}</p>
            <p className="mt-1 text-xs text-[var(--color-muted-fg)]">
              Rating: {r.rating}/5
            </p>
            {r.status !== "hidden" && (
              <Button
                size="sm"
                variant="danger"
                className="mt-3"
                onClick={() => handleHide(r.id)}
              >
                Hide
              </Button>
            )}
          </div>
        ))}
        {reviews.length === 0 && (
          <p className="text-[var(--color-muted)]">No reviews to moderate.</p>
        )}
      </div>
    </div>
  );
}
