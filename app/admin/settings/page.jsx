"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { getAppSettings, updateAppSettings } from "@/lib/services/admin";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    featuredEventLimit: 6,
    nearbyRadiusKm: 10,
    depositFeePercent: 2.5,
    depositFeeFixed: 0,
    defaultSpendingLimitDaily: 50000,
    defaultSpendingLimitMonthly: 200000,
    qrRotationHours: 24,
    diditApiKey: "HRAd1dLbvqCPaJBmbuHsUAv6YjdCfBzlA5VgAkpjKkU",
    diditWorkflowId: "",
    diditWebhookSecret: "",
    notifyLkUserId: "29316",
    notifyLkApiKey: "RH9L1weIpJJODyQkFfSe",
    notifyLkSenderId: "NotifyDEMO",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getAppSettings().then((s) => setSettings((prev) => ({ ...prev, ...s })));
  }, []);

  async function handleSave() {
    await updateAppSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-lg space-y-6">
      <Card>
        <CardHeader title="App Settings" subtitle="Platform defaults" />
        <div className="space-y-4">
          <Input label="Featured event limit" type="number" value={String(settings.featuredEventLimit)} onChange={(e) => setSettings({ ...settings, featuredEventLimit: Number(e.target.value) })} />
          <Input label="Nearby radius (km)" type="number" value={String(settings.nearbyRadiusKm)} onChange={(e) => setSettings({ ...settings, nearbyRadiusKm: Number(e.target.value) })} />
          <Input label="QR rotation (hours)" type="number" value={String(settings.qrRotationHours)} onChange={(e) => setSettings({ ...settings, qrRotationHours: Number(e.target.value) })} />
          <Button onClick={handleSave}>{saved ? "Saved!" : "Save"}</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Wallet & fees" subtitle="REQ-WAL-003, REQ-WAL-007" />
        <div className="space-y-4">
          <Input label="Deposit fee (%)" type="number" step="0.1" value={String(settings.depositFeePercent)} onChange={(e) => setSettings({ ...settings, depositFeePercent: Number(e.target.value) })} />
          <Input label="Deposit fixed fee (LKR)" type="number" value={String(settings.depositFeeFixed)} onChange={(e) => setSettings({ ...settings, depositFeeFixed: Number(e.target.value) })} />
          <Input label="Default daily spending limit (LKR)" type="number" value={String(settings.defaultSpendingLimitDaily)} onChange={(e) => setSettings({ ...settings, defaultSpendingLimitDaily: Number(e.target.value) })} />
          <Input label="Default monthly spending limit (LKR)" type="number" value={String(settings.defaultSpendingLimitMonthly)} onChange={(e) => setSettings({ ...settings, defaultSpendingLimitMonthly: Number(e.target.value) })} />
          <Button onClick={handleSave}>{saved ? "Saved!" : "Save wallet settings"}</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Notify.lk SMS" subtitle="Phone OTP for vendor onboarding" />
        <div className="space-y-4">
          <Input label="User ID" value={settings.notifyLkUserId ?? ""} onChange={(e) => setSettings({ ...settings, notifyLkUserId: e.target.value })} placeholder="From notify.lk dashboard" />
          <Input label="API key" value={settings.notifyLkApiKey ?? ""} onChange={(e) => setSettings({ ...settings, notifyLkApiKey: e.target.value })} type="password" />
          <Input label="Sender ID" value={settings.notifyLkSenderId ?? "NotifyDEMO"} onChange={(e) => setSettings({ ...settings, notifyLkSenderId: e.target.value })} placeholder="NotifyDEMO or your approved sender" />
          <Button onClick={handleSave}>{saved ? "Saved!" : "Save SMS settings"}</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="KYC — Didit Identity Verification" subtitle="Free hosted KYC (ID OCR + liveness + face match). 500 sessions / month on Didit’s free plan." />
        <div className="space-y-4">
          <Input
            label="Didit API key (x-api-key)"
            value={settings.diditApiKey ?? ""}
            onChange={(e) => setSettings({ ...settings, diditApiKey: e.target.value })}
            type="password"
            placeholder="From Didit Console → API & Webhooks"
          />
          <Input
            label="Didit Workflow ID (optional)"
            value={settings.diditWorkflowId ?? ""}
            onChange={(e) => setSettings({ ...settings, diditWorkflowId: e.target.value })}
            placeholder="Auto-created if left empty"
          />
          <Input
            label="Didit Webhook Secret (optional)"
            value={settings.diditWebhookSecret ?? ""}
            onChange={(e) => setSettings({ ...settings, diditWebhookSecret: e.target.value })}
            type="password"
            placeholder="For HMAC signature verification"
          />
          <p className="text-xs text-[var(--color-muted)]">
            Webhook URL to register in Didit Console:{" "}
            <span className="font-mono select-all">
              https://us-central1-localapp-4020b.cloudfunctions.net/diditWebhook
            </span>
          </p>
          <Button onClick={handleSave}>{saved ? "Saved!" : "Save KYC settings"}</Button>
        </div>
      </Card>
    </div>
  );
}
