"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { unlockMatrimonialProfile, sendMatrimonialInterest, createOrGetDirectMessage } from "@/lib/services/cloudFunctions";
import { useAuth } from "@/providers/AuthProvider";
import { Heart, Lock, MessageCircle, Coins } from "lucide-react";

export default function MatrimonialProfileViewPage() {
  return (
    <RoleGuard requireAuth>
      <PublicLayout>
        <ProfileViewContent />
      </PublicLayout>
    </RoleGuard>
  );
}

function ProfileViewContent() {
  const { profileId } = useParams();
  const { profile } = useAuth();
  const router = useRouter();

  const [profileData, setProfileData] = useState(null);
  const [coinsCharged, setCoinsCharged] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [interestMsg, setInterestMsg] = useState("");
  const [sendingInterest, setSendingInterest] = useState(false);
  const [interestSent, setInterestSent] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [coinsError, setCoinsError] = useState(null);

  useEffect(() => {
    if (!profileId || !profile) return;
    if (profileId === profile.uid) {
      router.push("/matrimonial/profile");
      return;
    }
    unlockMatrimonialProfile(profileId)
      .then((res) => {
        setProfileData(res.profile);
        setCoinsCharged(res.coinsCharged);
      })
      .catch((err) => {
        if (err?.details?.coinsRequired) {
          setCoinsError({ required: err.details.coinsRequired, held: err.details.coinsHeld });
        } else {
          setError(err instanceof Error ? err.message : "Failed to load profile");
        }
      })
      .finally(() => setLoading(false));
  }, [profileId, profile]);

  async function handleSendInterest() {
    setSendingInterest(true);
    try {
      await sendMatrimonialInterest(profileId, interestMsg);
      setInterestSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send interest");
    } finally {
      setSendingInterest(false);
    }
  }

  async function handleOpenChat() {
    setChatLoading(true);
    try {
      const res = await createOrGetDirectMessage(profileId);
      router.push(`/chat/${res.groupId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open chat");
    } finally {
      setChatLoading(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-[var(--color-muted)]">Unlocking profile…</div>;

  if (coinsError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Lock className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
        <h1 className="text-xl font-bold">Coins required</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          You need <strong>{coinsError.required} coins</strong> to view this profile.<br />
          You currently have <strong>{coinsError.held} coins</strong>.
        </p>
        <p className="mt-2 text-xs text-[var(--color-muted)]">Coins can be added via your wallet or by contacting support.</p>
        <Button className="mt-4" onClick={() => router.back()}>← Go back</Button>
      </div>
    );
  }

  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!profileData) return null;

  const p = profileData;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)]"
      >
        ← Back to search
      </button>

      {coinsCharged > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
          <Coins className="h-4 w-4" />
          {coinsCharged} coins deducted for this view (REQ-MAT-007). Free for 7 days.
        </div>
      )}

      <Card>
        {/* Photos */}
        {p.photos?.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {p.photos.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt={`Photo ${i + 1}`} className={`${i === 0 ? "h-56 w-full object-cover" : "h-24 w-24 object-cover"} rounded-xl`} />
            ))}
          </div>
        ) : (
          <div className="mb-4 flex h-40 items-center justify-center rounded-xl bg-[var(--color-border-light)] text-[var(--color-muted)]">
            <Heart className="h-12 w-12 opacity-30" />
          </div>
        )}

        <h1 className="text-xl font-bold">{p.displayName}</h1>
        <p className="text-sm text-[var(--color-muted)]">{p.age && `${p.age} years · `}{p.district}{p.city && `, ${p.city}`}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <Info label="Gender" value={p.gender} />
          <Info label="Religion" value={p.religion} />
          <Info label="Ethnicity" value={p.ethnicity} />
          {p.caste && <Info label="Caste" value={p.caste} />}
          <Info label="Height" value={p.heightCm ? `${p.heightCm} cm` : "—"} />
          <Info label="Education" value={p.education} />
          <Info label="Occupation" value={p.occupation} />
          <Info label="Income range" value={p.incomeRange} />
        </div>

        {p.aboutMe && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-[var(--color-muted)]">About</p>
            <p className="mt-1 text-sm leading-relaxed">{p.aboutMe}</p>
          </div>
        )}

        {p.hobbies?.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-[var(--color-muted)]">Hobbies</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {p.hobbies.map((h, i) => (
                <span key={i} className="rounded-full bg-[var(--color-border-light)] px-2 py-0.5 text-xs">{h}</span>
              ))}
            </div>
          </div>
        )}

        {p.familyDetails && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-[var(--color-muted)]">Family</p>
            <p className="mt-1 text-sm">{p.familyDetails}</p>
          </div>
        )}

        {p.expectations && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-[var(--color-muted)]">Partner expectations</p>
            <p className="mt-1 text-sm">{p.expectations}</p>
          </div>
        )}
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader title="Connect" subtitle="REQ-MAT-007" />
        {interestSent ? (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            <Heart className="h-4 w-4" />
            Interest sent! They will be notified.
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Message (optional)</label>
              <textarea
                rows={2}
                value={interestMsg}
                onChange={(e) => setInterestMsg(e.target.value)}
                placeholder="Introduce yourself..."
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSendInterest} loading={sendingInterest} className="flex-1">
                <Heart className="mr-1.5 h-4 w-4" />
                Send interest (50 coins)
              </Button>
              <Button variant="outline" onClick={handleOpenChat} loading={chatLoading}>
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </Card>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--color-muted)]">{label}</p>
      <p className="capitalize">{value ?? "—"}</p>
    </div>
  );
}
