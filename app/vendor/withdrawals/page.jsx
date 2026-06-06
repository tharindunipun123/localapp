"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/providers/AuthProvider";
import { requestVendorWithdrawal } from "@/lib/services/cloudFunctions";

export default function VendorWithdrawalsPage() {
  const { profile } = useAuth();
  const [amount, setAmount] = useState("");
  const [bankDetails, setBankDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await requestVendorWithdrawal({ amount: Number(amount), bankDetails });
      setMessage("Withdrawal request submitted. Admin will process after bank transfer.");
      setAmount("");
      setBankDetails("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Withdrawals</h1>
      <Card>
        <CardHeader title="Request withdrawal" subtitle="REQ-WAL-006 — manual admin review" />
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input label="Amount (LKR, min 100)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min={100} required />
          <Input label="Bank account details" value={bankDetails} onChange={(e) => setBankDetails(e.target.value)} placeholder="Bank name, account number, branch" required />
          <Button type="submit" loading={loading}>Submit request</Button>
        </form>
        {message && <p className="mt-3 text-sm text-[var(--color-primary)]">{message}</p>}
      </Card>
    </div>
  );
}
