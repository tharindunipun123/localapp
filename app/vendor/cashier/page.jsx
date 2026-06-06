"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useAuth } from "@/providers/AuthProvider";
import { getVendorPrograms, getVendorGrants } from "@/lib/services/vendors";
import {
  initiateLoyaltyGrant,
  confirmLoyaltyGrant,
  redeemLoyaltyPoints,
  redeemPromoAtPos,
  checkInEvent,
} from "@/lib/services/cloudFunctions";
import { Camera, X } from "lucide-react";

const TABS = [
  { id: "earn", label: "Grant points" },
  { id: "redeem", label: "Redeem points" },
  { id: "promo", label: "Promo QR" },
  { id: "checkin", label: "Event check-in" },
];

/** Camera QR scanner using @zxing/browser — loaded client-side only. */
function QrCameraScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stopped = false;

    async function startScanner() {
      try {
        const { BrowserQRCodeReader, BrowserCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        readerRef.current = reader;

        const devices = await BrowserCodeReader.listVideoInputDevices();
        if (!devices.length) {
          setError("No camera found on this device.");
          return;
        }
        const deviceId = devices[devices.length - 1]?.deviceId; // prefer rear camera

        reader.decodeFromVideoDevice(deviceId, videoRef.current, (result, err) => {
          if (stopped) return;
          if (result) {
            onScan(result.getText());
            stopped = true;
          }
          if (err && !(err.name === "NotFoundException")) {
            console.warn("QR scan error:", err);
          }
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Camera error");
      }
    }

    startScanner();

    return () => {
      stopped = true;
      readerRef.current?.reset?.();
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-black">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 rounded-full bg-white/20 p-1 text-white hover:bg-white/40"
        >
          <X className="h-5 w-5" />
        </button>
        <video ref={videoRef} className="w-full" autoPlay muted playsInline />
        {/* Viewfinder overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-48 w-48 rounded-2xl border-4 border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
        </div>
        {error && (
          <p className="absolute bottom-4 left-0 right-0 text-center text-sm text-red-400">
            {error}
          </p>
        )}
        <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/70">
          Point camera at user QR code
        </p>
      </div>
    </div>
  );
}

function QrInput({ label, value, onChange, required }) {
  const [showCamera, setShowCamera] = useState(false);

  const handleScan = useCallback(
    (text) => {
      onChange(text);
      setShowCamera(false);
    },
    [onChange]
  );

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            placeholder="Paste QR value or use camera →"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowCamera(true)}
          className="mt-5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          title="Scan with camera"
        >
          <Camera className="h-5 w-5" />
        </button>
      </div>
      {showCamera && (
        <QrCameraScanner onScan={handleScan} onClose={() => setShowCamera(false)} />
      )}
    </div>
  );
}

export default function VendorCashierPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState("earn");
  const [programs, setPrograms] = useState([]);
  const [pending, setPending] = useState([]);
  const [qrValue, setQrValue] = useState("");
  const [programId, setProgramId] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [eventId, setEventId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  function reload() {
    if (!profile?.uid) return;
    getVendorPrograms(profile.uid).then((p) => {
      setPrograms(p.filter((x) => x.isActive));
      if (p.length && !programId) setProgramId(p[0].id);
    });
    getVendorGrants(profile.uid).then((g) => setPending(g.filter((x) => x.status === "pending")));
  }

  useEffect(() => {
    reload();
  }, [profile]);

  function setMsg(text, error = false) {
    setMessage(text);
    setIsError(error);
  }

  async function handleEarn(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const result = await initiateLoyaltyGrant({
        qrValue: qrValue.trim(),
        programId,
        purchaseAmount: Number(purchaseAmount),
      });
      setMsg(`Pending grant: ${result.pointsCalculated} pts for customer`);
      setQrValue("");
      reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setLoading(false);
    }
  }

  async function handleRedeem(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      await redeemLoyaltyPoints({ qrValue: qrValue.trim(), programId, vendorId: profile.uid });
      setMsg("Points redeemed successfully");
      setQrValue("");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setLoading(false);
    }
  }

  async function handlePromo(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const result = await redeemPromoAtPos({
        qrValue: qrValue.trim(),
        promoCode,
        purchaseAmount: Number(purchaseAmount),
      });
      setMsg(`Promo applied: LKR ${result.discount} discount`);
      setQrValue("");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckIn(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      await checkInEvent(eventId, qrValue.trim());
      setMsg("Check-in successful");
      setQrValue("");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(grantId) {
    setLoading(true);
    try {
      await confirmLoyaltyGrant(grantId);
      setMsg("Grant confirmed — points credited to customer");
      reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cashier</h1>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setMsg(""); setQrValue(""); }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              tab === t.id
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-border-light)] text-[var(--color-muted)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            isError
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-700"
          }`}
        >
          {message}
        </p>
      )}

      {tab === "earn" && (
        <Card>
          <CardHeader title="Grant loyalty points" subtitle="REQ-VND-006" />
          <form onSubmit={handleEarn} className="space-y-3">
            <QrInput
              label="Customer QR"
              value={qrValue}
              onChange={setQrValue}
              required
            />
            <Select
              label="Program"
              options={programs.map((p) => ({ value: p.id, label: p.programName }))}
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
            />
            <Input
              label="Purchase LKR"
              type="number"
              value={purchaseAmount}
              onChange={(e) => setPurchaseAmount(e.target.value)}
              required
            />
            <Button type="submit" loading={loading}>
              Create pending grant
            </Button>
          </form>
          {pending.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-semibold text-[var(--color-muted)]">
                Pending confirmation
              </h3>
              <ul className="mt-2 space-y-2">
                {pending.map((g) => (
                  <li key={g.id} className="flex justify-between rounded-xl border border-[var(--color-border)] p-3 text-sm">
                    <span>
                      <span className="font-medium">{g.pointsCalculated} pts</span>
                      <span className="ml-2 text-[var(--color-muted)]">· LKR {g.purchaseAmount}</span>
                    </span>
                    <Button size="sm" onClick={() => handleConfirm(g.id)} loading={loading}>
                      Confirm
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {tab === "redeem" && (
        <Card>
          <CardHeader title="Redeem loyalty points" subtitle="REQ-VND-004" />
          <form onSubmit={handleRedeem} className="space-y-3">
            <QrInput label="Customer QR" value={qrValue} onChange={setQrValue} required />
            <Select
              label="Program"
              options={programs.map((p) => ({ value: p.id, label: p.programName }))}
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
            />
            <Button type="submit" loading={loading}>
              Redeem reward
            </Button>
          </form>
        </Card>
      )}

      {tab === "promo" && (
        <Card>
          <CardHeader title="Promo code at POS" subtitle="REQ-PRO-002" />
          <form onSubmit={handlePromo} className="space-y-3">
            <QrInput label="Customer QR" value={qrValue} onChange={setQrValue} required />
            <Input
              label="Promo code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              required
            />
            <Input
              label="Purchase LKR"
              type="number"
              value={purchaseAmount}
              onChange={(e) => setPurchaseAmount(e.target.value)}
              required
            />
            <Button type="submit" loading={loading}>
              Apply promo
            </Button>
          </form>
        </Card>
      )}

      {tab === "checkin" && (
        <Card>
          <CardHeader title="Event check-in" subtitle="REQ-VND-010" />
          <form onSubmit={handleCheckIn} className="space-y-3">
            <Input
              label="Event ID"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              required
            />
            <QrInput label="Attendee QR" value={qrValue} onChange={setQrValue} required />
            <Button type="submit" loading={loading}>
              Check in
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
