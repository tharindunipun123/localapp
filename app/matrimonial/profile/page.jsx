"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getMyMatrimonialProfile, getMyMatrimonialInterests, respondToMatrimonialInterest } from "@/lib/services/cloudFunctions";
import { useAuth } from "@/providers/AuthProvider";
import { format } from "date-fns";
import { Heart, User, Pencil } from "lucide-react";

export default function MyMatrimonialProfilePage() {
  return (
    <RoleGuard requireAuth>
      <PublicLayout>
        <MyProfileContent />
      </PublicLayout>
    </RoleGuard>
  );
}

function MyProfileContent() {
  const { profile } = useAuth();
  const [matProfile, setMatProfile] = useState(null);
  const [interests, setInterests] = useState({ received: [], sent: [] });
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [pRes, iRes] = await Promise.all([
        getMyMatrimonialProfile(),
        getMyMatrimonialInterests(),
      ]);
      setMatProfile(pRes.profile);
      setInterests(iRes);
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [profile]);

  async function handleRespond(fromUserId, action) {
    setResponding(`${fromUserId}_${action}`);
    try {
      await respondToMatrimonialInterest(fromUserId, action);
      await load();
    } finally {
      setResponding(null);
    }
  }

  if (loading) return <div className="p-8 text-center text-[var(--color-muted)]">Loading…</div>;

  if (!matProfile) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <User className="mx-auto mb-4 h-16 w-16 text-[var(--color-muted)]" />
        <h1 className="text-xl font-bold">No matrimonial profile yet</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Create your profile to start finding your life partner.
        </p>
        <Link href="/matrimonial/profile/create">
          <Button className="mt-4">Create profile</Button>
        </Link>
      </div>
    );
  }

  const dob = matProfile.dateOfBirth?.toMillis?.() ?? matProfile.dateOfBirth;
  const age = dob ? Math.floor((Date.now() - dob) / (365.25 * 86400000)) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="h-6 w-6 text-rose-500" />
          <h1 className="text-2xl font-bold">My Matrimonial Profile</h1>
        </div>
        <Link href="/matrimonial/profile/create">
          <Button variant="outline" size="sm">
            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
        </Link>
      </div>

      <Card>
        {/* Photos */}
        {matProfile.photos?.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {matProfile.photos.map((url, i) => (
              <div key={i} className="relative h-28 w-28">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full rounded-xl object-cover" />
                {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-xs text-white">Primary</span>}
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <Info label="Name" value={matProfile.displayName} />
          <Info label="Age" value={age ? `${age} years` : "—"} />
          <Info label="Gender" value={matProfile.gender} />
          <Info label="Religion" value={matProfile.religion} />
          <Info label="Ethnicity" value={matProfile.ethnicity} />
          {matProfile.caste && <Info label="Caste" value={matProfile.caste} />}
          <Info label="Height" value={`${matProfile.heightCm} cm`} />
          <Info label="Education" value={matProfile.education} />
          <Info label="Occupation" value={matProfile.occupation} />
          <Info label="Income" value={matProfile.incomeRange} />
          <Info label="District" value={matProfile.district} />
          <Info label="City" value={matProfile.city} />
        </div>

        {matProfile.aboutMe && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-[var(--color-muted)]">About me</p>
            <p className="mt-1 text-sm">{matProfile.aboutMe}</p>
          </div>
        )}

        <div className="mt-3 flex gap-2 text-xs">
          <Badge label={matProfile.privacyShowFullName ? "Full name visible" : "First name only"} status="pending" />
          <Badge label={`Photos: ${matProfile.privacyShowPhotosTo}`} status="approved" />
        </div>
      </Card>

      {/* Received interests */}
      <Card>
        <CardHeader title={`Received interests (${interests.received.length})`} />
        {interests.received.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No interests received yet.</p>
        ) : (
          <div className="space-y-3">
            {interests.received.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] p-3">
                <div>
                  <p className="text-sm font-medium">From: {item.fromUserId?.slice(0, 8)}…</p>
                  {item.message && <p className="text-xs text-[var(--color-muted)] mt-0.5">"{item.message}"</p>}
                  <p className="text-xs text-[var(--color-muted)]">
                    {item.createdAt?.toDate ? format(item.createdAt.toDate(), "MMM d, yyyy") : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={item.status} status={item.status === "accepted" ? "approved" : item.status === "rejected" ? "rejected" : "pending"} />
                  {item.status === "sent" && (
                    <>
                      <Button size="sm" onClick={() => handleRespond(item.fromUserId, "accept")} loading={responding === `${item.fromUserId}_accept`}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => handleRespond(item.fromUserId, "reject")} loading={responding === `${item.fromUserId}_reject`}>Decline</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Sent interests */}
      <Card>
        <CardHeader title={`Sent interests (${interests.sent.length})`} />
        {interests.sent.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No interests sent yet.</p>
        ) : (
          <div className="space-y-2">
            {interests.sent.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3 text-sm">
                <span>To: {item.toUserId?.slice(0, 8)}…</span>
                <Badge label={item.status} status={item.status === "accepted" ? "approved" : item.status === "rejected" ? "rejected" : "pending"} />
              </div>
            ))}
          </div>
        )}
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
