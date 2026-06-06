"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  loadAdminVendorPageData,
  moderateVendor,
  setVendorCorporate,
  generateWebhookApiKey,
  approvePointsPoolTopUp,
  getVendorRegistrationPdfUrl,
} from "@/lib/services/vendors";
import { adminTopUpVendorWallet } from "@/lib/services/cloudFunctions";
import { parseFirestoreTime } from "@/lib/firestoreTime";
import { format } from "date-fns";

function DetailRow({ label, value, className = "" }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-2 border-b border-[var(--color-border-light)] py-2 text-sm last:border-0">
      <span className="w-40 shrink-0 font-medium text-[var(--color-muted)]">{label}</span>
      <span className={`flex-1 text-[var(--color-fg)] ${className}`}>{value}</span>
    </div>
  );
}

function VerifiedIcon({ ok }) {
  return (
    <span className={ok ? "text-green-600" : "text-[var(--color-muted)]"}>
      {ok ? "✓ Verified" : "✗ Not verified"}
    </span>
  );
}

function KycBadge({ status }) {
  const label = status ?? "none";
  const s = label === "approved" ? "approved" : label === "pending" ? "pending" : "none";
  return <Badge label={label} status={s} />;
}

function VendorDetailModal({ vendor, pdfUrl, onClose, onApprove, onReject, loading }) {
  if (!vendor) return null;
  const created = parseFirestoreTime(vendor.createdAt);

  return (
    <Modal open title={`${vendor.businessName} — Application Details`} onClose={onClose} size="lg">
      <div className="space-y-5">

        {/* Verification status banner */}
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-[var(--color-bg)] p-3 text-xs">
          <div className="text-center">
            <p className="font-medium text-[var(--color-muted)]">Email</p>
            <VerifiedIcon ok={vendor.emailVerified} />
          </div>
          <div className="text-center">
            <p className="font-medium text-[var(--color-muted)]">Phone</p>
            <VerifiedIcon ok={vendor.phoneVerified} />
          </div>
          <div className="text-center">
            <p className="font-medium text-[var(--color-muted)]">KYC</p>
            <KycBadge status={vendor.ownerKycStatus ?? vendor.kycStatus} />
          </div>
        </div>

        {/* Business info */}
        <section>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Business Information</p>
          <DetailRow label="Business Name" value={vendor.businessName} />
          <DetailRow label="Category" value={vendor.category} />
          <DetailRow label="Address" value={vendor.address} />
          <DetailRow label="Phone" value={vendor.phone} />
          <DetailRow label="Email" value={vendor.email} />
          <DetailRow label="Website" value={vendor.website || "—"} />
          <DetailRow label="Description" value={vendor.description} />
        </section>

        {/* Registration */}
        <section>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Business Registration</p>
          <DetailRow label="Reg. Number" value={vendor.businessRegistrationNumber || "—"} />
          {pdfUrl ? (
            <div className="flex gap-2 py-2 text-sm">
              <span className="w-40 shrink-0 font-medium text-[var(--color-muted)]">Registration PDF</span>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-primary)] underline"
              >
                View PDF ↗
              </a>
            </div>
          ) : (
            <DetailRow label="Registration PDF" value="Not uploaded" />
          )}
        </section>

        {/* Application meta */}
        <section>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Application</p>
          <DetailRow label="Status" value={<Badge label={vendor.status} status={vendor.status === "active" ? "approved" : "pending"} />} />
          <DetailRow label="Vendor ID" value={vendor.id} className="font-mono text-xs" />
          <DetailRow label="Submitted" value={created ? format(created, "MMM d, yyyy HH:mm") : "—"} />
        </section>

        {/* Action buttons — only show for pending */}
        {vendor.status === "pending" && (
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1"
              loading={loading}
              onClick={() => onApprove(vendor.id)}
            >
              Approve Application
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={loading}
              onClick={() => onReject(vendor.id)}
            >
              Reject Application
            </Button>
          </div>
        )}
        {vendor.status === "active" && (
          <Button variant="outline" className="w-full" loading={loading} onClick={() => onReject(vendor.id)}>
            Suspend Vendor
          </Button>
        )}
      </div>
    </Modal>
  );
}

export default function AdminVendorsPage() {
  const [pending, setPending] = useState([]);
  const [all, setAll] = useState([]);
  const [poolRequests, setPoolRequests] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [pdfUrls, setPdfUrls] = useState({});
  const [topUp, setTopUp] = useState({ vendorId: "", cashAmount: 0, pointsAmount: 0 });
  const [webhookKeys, setWebhookKeys] = useState({});
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function loadPdfUrls(vendors) {
    const entries = await Promise.all(
      vendors
        .filter((v) => v.registrationPdfPath)
        .map(async (v) => {
          try {
            const url = await getVendorRegistrationPdfUrl(v.registrationPdfPath);
            return [v.id, url];
          } catch {
            return [v.id, null];
          }
        })
    );
    setPdfUrls(Object.fromEntries(entries.filter(([, url]) => url)));
  }

  function reload() {
    setLoadError("");
    loadAdminVendorPageData()
      .then(({ pending: p, all: a, poolTopUpRequests: pool }) => {
        setPending(p);
        setAll(a);
        setPoolRequests(pool);
        loadPdfUrls([...p, ...a]);
      })
      .catch((err) => {
        setPending([]);
        setAll([]);
        setPoolRequests([]);
        setLoadError(err instanceof Error ? err.message : "Failed to load vendors");
      });
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleAction(vendorId, action) {
    setActionLoading(true);
    try {
      await moderateVendor(vendorId, action);
      setSelectedVendor(null);
      reload();
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleCorporate(vendorId, current) {
    await setVendorCorporate(vendorId, !current);
    reload();
  }

  async function handlePoolAction(requestId, action) {
    await approvePointsPoolTopUp(requestId, action);
    reload();
  }

  async function handleGenerateKey(vendorId) {
    const result = await generateWebhookApiKey(vendorId);
    setWebhookKeys((k) => ({ ...k, [vendorId]: result.apiKey }));
  }

  async function handleAdminTopUp(e) {
    e.preventDefault();
    await adminTopUpVendorWallet(topUp);
    setTopUp({ vendorId: "", cashAmount: 0, pointsAmount: 0 });
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Vendors</h1>
      {loadError && (
        <p className="text-sm text-[var(--color-danger-fg)]">{loadError}</p>
      )}

      {/* Pending pool top-up requests */}
      <Card>
        <CardHeader title="Pending pool top-up requests" subtitle="REQ-VND-005 admin confirmation" />
        {poolRequests.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No pending requests.</p>
        ) : (
          <ul className="space-y-3">
            {poolRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm">
                <span>Vendor {r.vendorId} · LKR {r.lkrAmount} → {r.pointsAmount} pts</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handlePoolAction(r.id, "approve")}>Approve</Button>
                  <Button size="sm" variant="danger" onClick={() => handlePoolAction(r.id, "reject")}>Reject</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Pending applications */}
      <Card>
        <CardHeader title="Pending applications" subtitle="Click View to review all details before deciding" />
        {pending.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No pending vendors.</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{v.businessName}</p>
                  <p className="text-sm text-[var(--color-muted)]">
                    {v.category} · {v.email}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <span className={v.emailVerified ? "text-green-600" : "text-[var(--color-muted)]"}>
                      Email {v.emailVerified ? "✓" : "✗"}
                    </span>
                    <span className={v.phoneVerified ? "text-green-600" : "text-[var(--color-muted)]"}>
                      Phone {v.phoneVerified ? "✓" : "✗"}
                    </span>
                    <span>KYC: <KycBadge status={v.ownerKycStatus ?? v.kycStatus} /></span>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setSelectedVendor(v)}>
                  View Details
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Direct admin top-up */}
      <Card>
        <CardHeader title="Direct admin top-up" />
        <form onSubmit={handleAdminTopUp} className="flex flex-wrap gap-3">
          <Input label="Vendor ID" value={topUp.vendorId} onChange={(e) => setTopUp({ ...topUp, vendorId: e.target.value })} />
          <Input label="Cash LKR" type="number" value={topUp.cashAmount} onChange={(e) => setTopUp({ ...topUp, cashAmount: Number(e.target.value) })} />
          <Input label="Points" type="number" value={topUp.pointsAmount} onChange={(e) => setTopUp({ ...topUp, pointsAmount: Number(e.target.value) })} />
          <Button type="submit" className="self-end">Top up</Button>
        </form>
      </Card>

      {/* All vendors table */}
      <Card>
        <CardHeader title="All vendors" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[var(--color-muted)]">
                <th className="p-2">Business</th>
                <th className="p-2">Email / Phone</th>
                <th className="p-2">Reg. No.</th>
                <th className="p-2">Status</th>
                <th className="p-2">KYC</th>
                <th className="p-2">Corporate</th>
                <th className="p-2">Webhook</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {all.map((v) => (
                <tr key={v.id} className="border-b align-top">
                  <td className="p-2">
                    <button
                      type="button"
                      className="text-left font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
                      onClick={() => setSelectedVendor(v)}
                    >
                      {v.businessName}
                    </button>
                  </td>
                  <td className="p-2 text-xs">
                    <span className={v.emailVerified ? "text-green-600" : "text-[var(--color-muted)]"}>Email {v.emailVerified ? "✓" : "✗"}</span><br />
                    <span className={v.phoneVerified ? "text-green-600" : "text-[var(--color-muted)]"}>Phone {v.phoneVerified ? "✓" : "✗"}</span>
                  </td>
                  <td className="p-2 text-xs">
                    {v.businessRegistrationNumber || "—"}
                    {pdfUrls[v.id] && (
                      <><br /><a href={pdfUrls[v.id]} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline">PDF ↗</a></>
                    )}
                  </td>
                  <td className="p-2">
                    <Badge label={v.status} status={v.status === "active" ? "approved" : "pending"} />
                  </td>
                  <td className="p-2">
                    <KycBadge status={v.ownerKycStatus ?? v.kycStatus} />
                  </td>
                  <td className="p-2">
                    <Button size="sm" variant="outline" onClick={() => toggleCorporate(v.id, v.isCorporate)}>
                      {v.isCorporate ? "Corporate ✓" : "Set corporate"}
                    </Button>
                  </td>
                  <td className="p-2">
                    <Button size="sm" variant="ghost" onClick={() => handleGenerateKey(v.id)}>Generate key</Button>
                    {webhookKeys[v.id] && (
                      <p className="mt-1 max-w-[180px] truncate font-mono text-xs">{webhookKeys[v.id]}</p>
                    )}
                  </td>
                  <td className="p-2 space-y-1">
                    <Button size="sm" variant="outline" onClick={() => setSelectedVendor(v)}>View</Button>
                    {v.status === "active" && (
                      <Button size="sm" variant="danger" onClick={() => handleAction(v.id, "suspend")}>Suspend</Button>
                    )}
                    {v.status === "pending" && (
                      <Button size="sm" onClick={() => handleAction(v.id, "approve")}>Approve</Button>
                    )}
                  </td>
                </tr>
              ))}
              {all.length === 0 && (
                <tr><td colSpan={8} className="p-4 text-center text-[var(--color-muted)]">No vendors yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Vendor detail modal */}
      <VendorDetailModal
        vendor={selectedVendor}
        pdfUrl={selectedVendor ? pdfUrls[selectedVendor.id] : null}
        onClose={() => setSelectedVendor(null)}
        onApprove={(id) => handleAction(id, "approve")}
        onReject={(id) => handleAction(id, selectedVendor?.status === "active" ? "suspend" : "reject")}
        loading={actionLoading}
      />
    </div>
  );
}
