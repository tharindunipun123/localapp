"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getPendingKycSubmissions, reviewKyc, getKycImageUrl } from "@/lib/services/kyc";
import { parseFirestoreTime } from "@/lib/firestoreTime";
import { format } from "date-fns";
import { ExternalLink, ShieldCheck, XCircle } from "lucide-react";

const DIDIT_CONSOLE = "https://business.didit.me/console/4bd56821-d81b-471d-8696-b7f82b7986f7/c5c03c40-50a7-4f8c-b7e1-6fb577e4cc4e";

function statusBadge(diditStatus, kycStatus) {
  if (kycStatus === "approved") return <Badge label="Approved" status="approved" />;
  if (kycStatus === "rejected") return <Badge label="Rejected" status="rejected" />;
  const label = diditStatus ?? "Pending";
  return <Badge label={label} status="pending" />;
}

function KycImage({ path, label }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!path) return;
    getKycImageUrl(path).then((next) => setUrl(next || ""));
  }, [path]);
  if (!path) return null;
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img src={url} alt={label} className="h-28 w-full rounded-lg object-cover" />
        </a>
      ) : (
        <div className="flex h-28 items-center justify-center rounded-lg bg-[var(--color-secondary)] text-xs text-[var(--color-muted)]">
          Loading…
        </div>
      )}
    </div>
  );
}

export default function AdminKycPage() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function reload() {
    setError("");
    getPendingKycSubmissions()
      .then(setSubmissions)
      .catch((err) => {
        setSubmissions([]);
        setError(err instanceof Error ? err.message : "Failed to load KYC queue");
      });
  }

  useEffect(() => { reload(); }, []);

  async function handleReview(userId, action) {
    setLoading(true);
    try {
      await reviewKyc(userId, action);
      reload();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">KYC Review Queue</h1>
        <a
          href={DIDIT_CONSOLE}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
        >
          Didit Console <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {error && <p className="mb-4 text-sm text-[var(--color-danger-fg)]">{error}</p>}

      {submissions.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">No pending KYC submissions.</p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {submissions.map((s) => {
            const submittedAt = parseFirestoreTime(s.createdAt);
            const extracted = s.extracted ?? {};
            return (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardHeader
                      title={extracted.fullName || s.fullName || `User ${s.userId}`}
                      subtitle={`User ID: ${s.userId}`}
                    />
                    <p className="text-xs text-[var(--color-muted)]">
                      Submitted {submittedAt ? format(submittedAt, "MMM d, yyyy HH:mm") : "—"}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {statusBadge(s.diditStatus, s.status)}
                  </div>
                </div>

                {(s.frontPath || s.selfiePath) && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <KycImage path={s.frontPath} label="ID front" />
                    <KycImage path={s.backPath} label="ID back" />
                    <KycImage path={s.selfiePath} label="Selfie" />
                  </div>
                )}

                <div className="mt-3 rounded-lg bg-[var(--color-secondary)] p-3 text-sm space-y-1">
                  <p>
                    <span className="text-[var(--color-muted)]">Provider: </span>
                    <span className="font-medium capitalize">{s.provider ?? "—"}</span>
                    {s.mode ? <span className="text-[var(--color-muted)]"> · {s.mode === "in_app" ? "in-app photos" : "hosted camera"}</span> : null}
                  </p>
                  <p>
                    <span className="text-[var(--color-muted)]">Didit status: </span>
                    <span className="font-medium">{s.diditStatus ?? "—"}</span>
                  </p>
                  {(s.identity?.nicNumber || extracted.documentNumber) && (
                    <p>
                      <span className="text-[var(--color-muted)]">Document: </span>
                      <span className="font-medium">{extracted.documentType || "NIC"} {s.identity?.nicNumber || extracted.documentNumber}</span>
                    </p>
                  )}
                  {(s.identity?.dateOfBirth || extracted.dateOfBirth) && (
                    <p>
                      <span className="text-[var(--color-muted)]">DOB: </span>
                      <span className="font-medium">{s.identity?.dateOfBirth || extracted.dateOfBirth}</span>
                    </p>
                  )}
                  {s.identity?.phone && (
                    <p>
                      <span className="text-[var(--color-muted)]">Phone: </span>
                      <span className="font-medium">{s.identity.phone}</span>
                    </p>
                  )}
                  {s.identity?.bankName && (
                    <p>
                      <span className="text-[var(--color-muted)]">Bank: </span>
                      <span className="font-medium">{s.identity.bankName} {s.identity.bankAccount || ""}</span>
                    </p>
                  )}
                  {s.idVerification?.status && (
                    <p>
                      <span className="text-[var(--color-muted)]">ID check: </span>
                      <span className="font-medium">{s.idVerification.status}</span>
                    </p>
                  )}
                  {s.faceMatch?.status && (
                    <p>
                      <span className="text-[var(--color-muted)]">Face match: </span>
                      <span className="font-medium">
                        {s.faceMatch.status}
                        {typeof s.faceMatch.score === "number" ? ` · ${Math.round(s.faceMatch.score * 100)}%` : ""}
                      </span>
                    </p>
                  )}
                  {s.liveness?.status && (
                    <p>
                      <span className="text-[var(--color-muted)]">Liveness: </span>
                      <span className="font-medium">
                        {s.liveness.status}
                        {typeof s.liveness.score === "number" ? ` · ${Math.round(s.liveness.score * 100)}%` : ""}
                      </span>
                    </p>
                  )}
                  {s.sessionId && (
                    <p>
                      <span className="text-[var(--color-muted)]">Session ID: </span>
                      <span className="font-mono text-xs">{s.sessionId}</span>
                    </p>
                  )}
                </div>

                {s.decision && Object.keys(s.decision).length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]">
                      View decision details
                    </summary>
                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-[var(--color-border-light)] p-2 text-xs">
                      {JSON.stringify(s.decision, null, 2)}
                    </pre>
                  </details>
                )}

                {s.status === "pending" && (
                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      size="sm"
                      loading={loading}
                      onClick={() => handleReview(s.userId, "approve")}
                    >
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                      Approve manually
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={loading}
                      onClick={() => handleReview(s.userId, "reject")}
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />
                      Reject
                    </Button>
                    {s.sessionId && (
                      <a
                        href={`${DIDIT_CONSOLE}/sessions/${s.sessionId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
                      >
                        View in Didit <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
