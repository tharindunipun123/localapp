"use client";

import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { PageHero } from "@/components/layout/PageHero";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
  createFamilyAccount,
  inviteFamilyMember,
  respondFamilyInvite,
  familyTransfer,
  getMyFamily,
} from "@/lib/services/cloudFunctions";
import { Users } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

export default function FamilyPage() {
  return (
    <RoleGuard requireAuth>
      <FamilyContent />
    </RoleGuard>
  );
}

function FamilyContent() {
  const { profile } = useAuth();
  const [data, setData] = useState(null);
  const [name, setName] = useState("Family");
  const [lookup, setLookup] = useState("");
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function reload() {
    getMyFamily()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load family"));
  }

  useEffect(() => {
    reload();
  }, []);

  const family = data?.family;
  const isOwner = family?.ownerId === profile?.uid;

  async function handleCreate() {
    setLoading(true);
    setError("");
    try {
      await createFamilyAccount(name);
      setMessage("Family account created.");
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create family");
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite() {
    setLoading(true);
    setError("");
    try {
      await inviteFamilyMember(lookup);
      setLookup("");
      setMessage("Invitation sent.");
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRespond(inviteId, action) {
    setLoading(true);
    try {
      await respondFamilyInvite(inviteId, action);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleAllowance() {
    setLoading(true);
    setError("");
    try {
      await familyTransfer({ toUserId: memberId, amount: Number(amount) });
      setAmount("");
      setMessage("Allowance sent.");
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicLayout>
      <PageHero
        compact
        segment="family"
        image="/images/hero-family.png"
        eyebrow="Family banking"
        title="Shared family account"
        subtitle="Invite household members and send allowances from the owner’s cash balance."
      />
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 space-y-6">
        {error && <p className="text-sm text-[var(--color-danger-fg)]">{error}</p>}
        {message && <p className="text-sm text-[var(--color-success-fg)]">{message}</p>}

        {(data?.invites ?? []).length > 0 && (
          <Card>
            <CardHeader title="Pending invitations" />
            <ul className="space-y-3">
              {data.invites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border-light)] p-3">
                  <div>
                    <p className="font-medium">{inv.familyName ?? "Family"}</p>
                    <p className="text-xs text-[var(--color-muted)]">Invite ID {inv.id.slice(0, 8)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleRespond(inv.id, "accept")} loading={loading}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => handleRespond(inv.id, "decline")}>Decline</Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {!family && (
          <Card>
            <CardHeader title="Create a family account" subtitle="Owner must be KYC-approved. Up to 8 members." />
            <Input label="Household name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button className="mt-4" onClick={handleCreate} loading={loading}>
              <Users className="h-4 w-4" /> Create family
            </Button>
          </Card>
        )}

        {family && (
          <>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <CardHeader title={family.name} subtitle={`${data.members.length} members`} />
                <Badge label={family.ownerId ? "Active" : "Family"} status="approved" />
              </div>
              <ul className="space-y-2">
                {data.members.map((m) => (
                  <li key={m.userId} className="flex items-center justify-between rounded-lg bg-[var(--color-secondary)] px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{m.displayName}</p>
                      <p className="text-xs text-[var(--color-muted)]">{m.email}</p>
                    </div>
                    <div className="text-right">
                      <Badge label={m.role} status={m.role === "owner" ? "approved" : "pending"} />
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        Allowance LKR {(m.familyBalance ?? 0).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            {isOwner && (
              <>
                <Card>
                  <CardHeader title="Invite a member" subtitle="Lookup by email, phone, username, or UID" />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="email@domain.com" className="flex-1" />
                    <Button onClick={handleInvite} loading={loading}>Send invite</Button>
                  </div>
                </Card>
                <Card>
                  <CardHeader title="Send allowance" subtitle="Debits your cash balance into the member’s family ledger" />
                  <div className="space-y-3">
                    <select
                      className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
                    >
                      <option value="">Select member</option>
                      {data.members.filter((m) => m.role !== "owner").map((m) => (
                        <option key={m.userId} value={m.userId}>{m.displayName}</option>
                      ))}
                    </select>
                    <Input type="number" min={1} label="Amount LKR" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    <Button onClick={handleAllowance} loading={loading} disabled={!memberId || !amount}>Send</Button>
                  </div>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </PublicLayout>
  );
}
