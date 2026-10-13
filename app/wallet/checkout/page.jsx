"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { initiateWalletDeposit, completeWalletDeposit } from "@/lib/services/cloudFunctions";
import { Lock, CreditCard, Landmark, CheckCircle2 } from "lucide-react";

export default function WalletCheckoutPage() {
  return (
    <RoleGuard requireAuth>
      <Suspense fallback={<PublicLayout><div className="px-4 py-16 text-center text-sm text-[var(--color-muted)]">Loading checkout…</div></PublicLayout>}>
        <CheckoutContent />
      </Suspense>
    </RoleGuard>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const amountParam = Number(searchParams.get("amount") ?? 0);
  const [session, setSession] = useState(null);
  const [method, setMethod] = useState("card");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!amountParam || amountParam < 100) {
      setError("Minimum deposit is LKR 100.");
      setLoading(false);
      return;
    }
    initiateWalletDeposit(amountParam)
      .then(setSession)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not start checkout"))
      .finally(() => setLoading(false));
  }, [amountParam]);

  async function handlePay(e) {
    e.preventDefault();
    if (!session?.sessionId) return;
    if (method === "card" && (!cardName || cardNumber.replace(/\s/g, "").length < 12 || !expiry || !cvc)) {
      setError("Enter complete card details to continue.");
      return;
    }
    setPaying(true);
    setError("");
    try {
      const result = await completeWalletDeposit(session.sessionId, method);
      setDone(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">
          Secure checkout
        </p>
        <h1 className="mb-6 text-2xl font-semibold text-[var(--color-fg)]">Complete your deposit</h1>

        {loading && <p className="text-sm text-[var(--color-muted)]">Preparing session…</p>}
        {error && <p className="mb-4 text-sm text-[var(--color-danger-fg)]">{error}</p>}

        {done && (
          <Card className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--color-success)]" />
            <h2 className="mt-3 text-xl font-semibold">Payment settled</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              LKR {done.credited?.toLocaleString()} credited after gateway fee of LKR {done.fee?.toLocaleString()}.
            </p>
            <Button className="mt-6 w-full" onClick={() => router.push("/wallet")}>
              Return to wallet
            </Button>
          </Card>
        )}

        {session && !done && (
          <Card>
            <div className="mb-3 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-light)] px-3 py-2 text-xs text-[var(--color-warning-fg)]">
              Sandbox settle — this is not a live card charge. Use it only in staging.
            </div>
            <div className="mb-5 rounded-xl bg-[var(--color-ink)] p-4 text-white">
              <p className="text-xs text-sky-200">You pay</p>
              <p className="money text-3xl font-semibold">LKR {session.amount.toLocaleString()}</p>
              <p className="mt-1 text-xs text-white/65">
                Fee LKR {session.fee.toLocaleString()} · Credited LKR {session.credited.toLocaleString()}
              </p>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2">
              {[
                { id: "card", label: "Card", icon: CreditCard },
                { id: "lankaqr", label: "LankaQR", icon: Landmark },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMethod(id)}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium ${
                    method === id
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                      : "border-[var(--color-border)] text-[var(--color-muted)]"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>

            <form onSubmit={handlePay} className="space-y-3">
              {method === "card" && (
                <>
                  <Input label="Name on card" value={cardName} onChange={(e) => setCardName(e.target.value)} required />
                  <Input
                    label="Card number"
                    inputMode="numeric"
                    placeholder="4242 4242 4242 4242"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    required
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Expiry" placeholder="MM/YY" value={expiry} onChange={(e) => setExpiry(e.target.value)} required />
                    <Input label="CVC" inputMode="numeric" value={cvc} onChange={(e) => setCvc(e.target.value)} required />
                  </div>
                </>
              )}
              {method === "lankaqr" && (
                <p className="rounded-lg bg-[var(--color-secondary)] p-3 text-sm text-[var(--color-muted)]">
                  Confirming this payment simulates a successful LankaQR capture in sandbox. Live acquiring is enabled when production merchant credentials are attached.
                </p>
              )}
              <Button type="submit" loading={paying} className="w-full">
                <Lock className="h-4 w-4" /> Pay LKR {session.amount.toLocaleString()}
              </Button>
              <p className="flex items-center justify-center gap-1 text-center text-[11px] text-[var(--color-muted)]">
                <Lock className="h-3 w-3" /> TLS encrypted · PCI-style sandbox checkout
              </p>
            </form>
          </Card>
        )}
      </div>
    </PublicLayout>
  );
}
