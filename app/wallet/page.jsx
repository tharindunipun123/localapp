"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { PageHero } from "@/components/layout/PageHero";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/providers/AuthProvider";
import { getWallet, getUserTransactions } from "@/lib/services/wallet";
import { transferP2P, lookupUserForTransfer, spendWorkBalance } from "@/lib/services/cloudFunctions";
import { isKycApproved } from "@/lib/firebase/auth";
import { format } from "date-fns";
import { QrCode, ShieldAlert, Briefcase, Users, Lock } from "lucide-react";

export default function WalletPage() {
  return (
    <RoleGuard requireAuth>
      <WalletContent />
    </RoleGuard>
  );
}

function WalletContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [topUpAmount, setTopUpAmount] = useState("1000");
  const [transferTo, setTransferTo] = useState("");
  const [transferLookup, setTransferLookup] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [workVendorId, setWorkVendorId] = useState("");
  const [workAmount, setWorkAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const kycOk = isKycApproved(profile);
  const dailyLimit = wallet?.spendingLimitDaily;
  const monthlyLimit = wallet?.spendingLimitMonthly;

  function reload() {
    if (!profile) return;
    getWallet(profile.uid)
      .then(setWallet)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load wallet"));
    getUserTransactions(profile.uid)
      .then(setTransactions)
      .catch(() => setTransactions([]));
  }

  useEffect(() => {
    reload();
  }, [profile]);

  async function handleTopUp() {
    const amount = Number(topUpAmount);
    if (!amount || amount < 100) return;
    if (!kycOk) {
      setError("Complete KYC verification before depositing.");
      return;
    }
    router.push(`/wallet/checkout?amount=${amount}`);
  }

  async function handleLookup() {
    if (!transferLookup.trim()) return;
    setError("");
    try {
      const result = await lookupUserForTransfer(transferLookup.trim());
      setLookupResult(result);
      setTransferTo(result.userId);
    } catch (err) {
      setLookupResult(null);
      setError(err instanceof Error ? err.message : "User not found");
    }
  }

  async function handleTransfer() {
    setLoading(true);
    setError("");
    try {
      await transferP2P({
        toUserId: transferTo.trim() || undefined,
        toLookup: !transferTo.trim() ? transferLookup.trim() : undefined,
        amount: Number(transferAmount),
      });
      reload();
      setTransferTo("");
      setTransferLookup("");
      setLookupResult(null);
      setTransferAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleWorkSpend() {
    const amount = Number(workAmount);
    if (!workVendorId.trim() || !amount || amount < 1) return;
    setLoading(true);
    setError("");
    try {
      await spendWorkBalance({ vendorId: workVendorId.trim(), amount });
      reload();
      setWorkAmount("");
      setWorkVendorId("");
    } catch (err) {
      const code = err?.details?.code ?? err?.code;
      if (code === "KYC_REQUIRED") setError("Complete KYC verification before spending.");
      else setError(err instanceof Error ? err.message : "Spend failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicLayout>
      <PageHero
        compact
        segment="wallet"
        image="/images/hero-wallet.png"
        eyebrow="Treasury"
        title="Your Local App wallet"
        subtitle="Cash, loyalty, coins, and allowances — KYC-gated, ledgered, and auditable."
      />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {!kycOk && (
          <Card className="mb-6 border-[var(--color-warning)]/30 bg-[var(--color-warning-light)]">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-[var(--color-warning-fg)]" />
              <div>
                <p className="font-medium text-[var(--color-fg)]">Identity verification required</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Deposits, transfers, and ticket purchases are locked until KYC is approved.
                </p>
                <Link href="/kyc" className="mt-2 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline">
                  Complete KYC →
                </Link>
              </div>
            </div>
          </Card>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Card className="bg-[var(--color-ink)] text-white sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Available cash</p>
            <p className="money mt-2 text-4xl font-semibold tracking-tight">
              LKR {(wallet?.cashBalance ?? 0).toLocaleString()}
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/65">
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3 w-3" /> User withdrawals disabled
              </span>
              {(dailyLimit || monthlyLimit) && (
                <span>
                  Limits: {dailyLimit ? `LKR ${dailyLimit.toLocaleString()}/day` : "—"}
                  {monthlyLimit ? ` · LKR ${monthlyLimit.toLocaleString()}/month` : ""}
                </span>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Loyalty points" subtitle="Locked — redeem at vendors or lottery" />
            <p className="money text-2xl font-semibold text-[var(--color-primary)]">
              {(wallet?.loyaltyPoints ?? 0).toLocaleString()} pts
            </p>
          </Card>
          <Card>
            <CardHeader title="Coins" subtitle="Matrimonial unlocks & events" />
            <p className="money text-2xl font-semibold text-[var(--segment-matrimonial)]">
              {(wallet?.coins ?? 0).toLocaleString()}
            </p>
          </Card>
          {(wallet?.bonusPoints ?? 0) > 0 && (
            <Card>
              <CardHeader title="Bonus points" subtitle="Lottery prizes" />
              <p className="money text-2xl font-semibold text-[var(--segment-lottery)]">
                {wallet.bonusPoints.toLocaleString()} pts
              </p>
            </Card>
          )}
          {(wallet?.workBalance ?? 0) > 0 && (
            <Card>
              <CardHeader title="Work balance" subtitle="Corporate allowance" />
              <p className="money text-2xl font-semibold text-[var(--color-primary)]">
                LKR {wallet.workBalance.toLocaleString()}
              </p>
            </Card>
          )}
          {(wallet?.familyBalance ?? 0) > 0 && (
            <Card>
              <CardHeader title="Family balance" subtitle="Allowance from family owner" />
              <p className="money text-2xl font-semibold text-[var(--segment-family)]">
                LKR {wallet.familyBalance.toLocaleString()}
              </p>
            </Card>
          )}
        </div>

        <Card className="mb-6">
          <CardHeader title="Secure top-up" subtitle="Checkout with card or LankaQR — gateway fee applied" />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="number"
              placeholder="Amount (min 100)"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              min={100}
              disabled={!kycOk}
            />
            <Button onClick={handleTopUp} disabled={!kycOk} className="sm:w-40">
              Continue
            </Button>
          </div>
        </Card>

        <Card className="mb-6">
          <CardHeader title="P2P transfer" subtitle="Send cash by email, phone, username, or user ID" />
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input placeholder="Email, phone, username, or UID" value={transferLookup} onChange={(e) => setTransferLookup(e.target.value)} disabled={!kycOk} className="flex-1" />
              <Button type="button" variant="outline" onClick={handleLookup} disabled={!kycOk}>Lookup</Button>
            </div>
            {lookupResult && (
              <p className="text-sm text-[var(--color-primary)]">Found: {lookupResult.displayName} ({lookupResult.userId})</p>
            )}
            <Input type="number" placeholder="Amount LKR" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} disabled={!kycOk} />
            <Button onClick={handleTransfer} loading={loading} disabled={!kycOk || (!transferTo && !transferLookup)}>Transfer</Button>
          </div>
        </Card>

        {(wallet?.workBalance ?? 0) > 0 && (
          <Card className="mb-6">
            <CardHeader title="Spend work balance" subtitle="Use your corporate allowance at a bound vendor" />
            <div className="space-y-3">
              <Input
                label="Vendor ID"
                value={workVendorId}
                onChange={(e) => setWorkVendorId(e.target.value)}
                placeholder="Your corporate vendor's ID"
                disabled={!kycOk}
              />
              <Input
                type="number"
                label="Amount (LKR)"
                value={workAmount}
                onChange={(e) => setWorkAmount(e.target.value)}
                min={1}
                max={wallet?.workBalance ?? 0}
                disabled={!kycOk}
              />
              <Button onClick={handleWorkSpend} loading={loading} disabled={!kycOk || !workVendorId || !workAmount}>
                <Briefcase className="h-4 w-4" />
                Spend LKR {workAmount || 0}
              </Button>
            </div>
          </Card>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between">
              <CardHeader title="Your QR" subtitle="Loyalty, promo, check-in" />
              <Link href="/profile/qr">
                <Button variant="outline" size="sm"><QrCode className="h-4 w-4" /> View</Button>
              </Link>
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <CardHeader title="Family account" subtitle="Shared allowances" />
              <Link href="/profile/family">
                <Button variant="outline" size="sm"><Users className="h-4 w-4" /> Manage</Button>
              </Link>
            </div>
          </Card>
        </div>

        {error && (
          <p className="mb-4 text-sm text-[var(--color-danger-fg)]">{error}</p>
        )}

        <Card>
          <CardHeader title="Ledger" subtitle="Immutable transaction history" />
          {transactions.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border-light)] p-3 text-sm"
                >
                  <div>
                    <p className="font-medium capitalize">{t.type?.replace(/_/g, " ")}</p>
                    <p className="text-[var(--color-muted)]">
                      {t.createdAt?.toDate ? format(t.createdAt.toDate(), "MMM d, yyyy HH:mm") : "—"}
                    </p>
                    {t.description && <p className="text-xs text-[var(--color-muted)]">{t.description}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {t.currency === "POINTS" ? `${t.amount} pts` : `LKR ${t.amount?.toLocaleString()}`}
                    </p>
                    <Badge label={t.status} status={t.status === "completed" || t.status === "success" ? "approved" : t.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PublicLayout>
  );
}
