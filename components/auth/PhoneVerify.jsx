"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { sendPhoneOtp, verifyPhoneOtp } from "@/lib/services/cloudFunctions";
import { useAuth } from "@/providers/AuthProvider";

function normalizePhoneInput(value) {
  let phone = value.replace(/[\s-]/g, "");
  if (phone.startsWith("0") && !phone.startsWith("+")) {
    phone = `+94${phone.slice(1)}`;
  }
  return phone;
}

function formatError(err) {
  const code = err?.code ?? "";
  const message = err?.message ?? "Something went wrong";
  if (code === "functions/failed-precondition") return message;
  if (code === "functions/invalid-argument") return message;
  if (code === "functions/resource-exhausted") return message;
  if (code === "functions/deadline-exceeded") return message;
  return message;
}

export function PhoneVerify({ onVerified }) {
  const { refreshProfile } = useAuth();
  const [phone, setPhone] = useState("+94");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function handleSendOtp() {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const normalized = normalizePhoneInput(phone);
      const result = await sendPhoneOtp(normalized);
      setSent(true);
      if (result?.devMode) {
        setInfo(result.message ?? "Dev mode: OTP logged in Cloud Functions (Notify.lk not configured).");
      } else {
        setInfo(`OTP sent to ${result?.phone ?? normalized} via SMS.`);
      }
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setError("");
    setLoading(true);
    try {
      const normalized = normalizePhoneInput(phone);
      await verifyPhoneOtp(normalized, otp.trim());
      await refreshProfile?.();
      onVerified?.();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--color-muted)]">
        We send a 6-digit code via Notify.lk SMS (Sri Lanka).
      </p>
      <Input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+94771234567 or 0712345678"
        label="Mobile number"
        disabled={sent}
      />
      {!sent ? (
        <Button onClick={handleSendOtp} loading={loading}>
          Send OTP
        </Button>
      ) : (
        <>
          <Input
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit code"
            label="OTP code"
            maxLength={6}
          />
          <div className="flex gap-2">
            <Button onClick={handleVerifyOtp} loading={loading} disabled={otp.length < 6}>
              Verify phone
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSent(false);
                setOtp("");
                setInfo("");
              }}
            >
              Change number
            </Button>
          </div>
        </>
      )}
      {info && <p className="text-sm text-[var(--color-primary)]">{info}</p>}
      {error && <p className="text-sm text-[var(--color-danger-fg)]">{error}</p>}
    </div>
  );
}
