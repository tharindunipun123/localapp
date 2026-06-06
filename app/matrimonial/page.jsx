"use client";

import { useState } from "react";
import Link from "next/link";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { searchMatrimonialProfiles } from "@/lib/services/cloudFunctions";
import { Heart, Search, Coins, ChevronLeft, ChevronRight } from "lucide-react";

const RELIGIONS = ["", "Buddhism", "Hinduism", "Christianity", "Islam", "Other"];
const ETHNICITIES = ["", "Sinhalese", "Tamil", "Muslim", "Burgher", "Malay", "Other"];
const EDUCATION = ["", "O/L", "A/L", "Diploma", "Bachelor's", "Master's", "PhD", "Other"];
const DISTRICTS = ["", "Colombo","Gampaha","Kalutara","Kandy","Matale","Nuwara Eliya","Galle","Matara","Hambantota","Jaffna","Kilinochchi","Mannar","Vavuniya","Mullaitivu","Batticaloa","Ampara","Trincomalee","Kurunegala","Puttalam","Anuradhapura","Polonnaruwa","Badulla","Monaragala","Ratnapura","Kegalle"];

const DEFAULT_FILTERS = {
  gender: "",
  minAge: "",
  maxAge: "",
  religion: "",
  district: "",
  ethnicity: "",
  minHeight: "",
  maxHeight: "",
  education: "",
};

export default function MatrimonialBrowsePage() {
  return (
    <RoleGuard requireAuth>
      <PublicLayout>
        <BrowseContent />
      </PublicLayout>
    </RoleGuard>
  );
}

function BrowseContent() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [coinsError, setCoinsError] = useState(null);

  function setFilter(field, value) {
    setFilters((f) => ({ ...f, [field]: value }));
  }

  async function doSearch(pageNum) {
    setLoading(true);
    setError("");
    setCoinsError(null);
    try {
      const params = { page: pageNum };
      if (filters.gender) params.gender = filters.gender;
      if (filters.minAge) params.minAge = Number(filters.minAge);
      if (filters.maxAge) params.maxAge = Number(filters.maxAge);
      if (filters.religion) params.religion = filters.religion;
      if (filters.district) params.district = filters.district;
      if (filters.ethnicity) params.ethnicity = filters.ethnicity;
      if (filters.minHeight) params.minHeight = Number(filters.minHeight);
      if (filters.maxHeight) params.maxHeight = Number(filters.maxHeight);
      if (filters.education) params.education = filters.education;

      const res = await searchMatrimonialProfiles(params);
      setResults(res.profiles);
      setTotal(res.total);
      setHasMore(res.hasMore);
      setPage(pageNum);
      setSearched(true);
    } catch (err) {
      if (err?.details?.coinsRequired) {
        setCoinsError({ required: err.details.coinsRequired, held: err.details.coinsHeld });
      } else {
        setError(err instanceof Error ? err.message : "Search failed");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    await doSearch(1);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Heart className="h-6 w-6 text-rose-500" />
          <h1 className="text-2xl font-bold">Find Your Match</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/matrimonial/profile">
            <Button variant="outline" size="sm">My Profile</Button>
          </Link>
        </div>
      </div>

      {/* Search filters */}
      <Card>
        <CardHeader title="Search filters" subtitle="REQ-MAT-005 — First 20 results free (REQ-MAT-006)" />
        <form onSubmit={handleSearch} className="grid gap-3 sm:grid-cols-3">
          <Select
            label="Looking for"
            options={[{ value: "", label: "Any gender" }, { value: "male", label: "Male" }, { value: "female", label: "Female" }]}
            value={filters.gender}
            onChange={(e) => setFilter("gender", e.target.value)}
          />
          <Input label="Min age" type="number" min={18} max={80} value={filters.minAge} onChange={(e) => setFilter("minAge", e.target.value)} placeholder="e.g. 25" />
          <Input label="Max age" type="number" min={18} max={80} value={filters.maxAge} onChange={(e) => setFilter("maxAge", e.target.value)} placeholder="e.g. 35" />
          <Select
            label="Religion"
            options={RELIGIONS.map((r) => ({ value: r, label: r || "Any religion" }))}
            value={filters.religion}
            onChange={(e) => setFilter("religion", e.target.value)}
          />
          <Select
            label="District"
            options={DISTRICTS.map((d) => ({ value: d, label: d || "Any district" }))}
            value={filters.district}
            onChange={(e) => setFilter("district", e.target.value)}
          />
          <Select
            label="Ethnicity"
            options={ETHNICITIES.map((e) => ({ value: e, label: e || "Any ethnicity" }))}
            value={filters.ethnicity}
            onChange={(e) => setFilter("ethnicity", e.target.value)}
          />
          <Input label="Min height (cm)" type="number" value={filters.minHeight} onChange={(e) => setFilter("minHeight", e.target.value)} placeholder="e.g. 150" />
          <Input label="Max height (cm)" type="number" value={filters.maxHeight} onChange={(e) => setFilter("maxHeight", e.target.value)} placeholder="e.g. 180" />
          <Select
            label="Education"
            options={EDUCATION.map((e) => ({ value: e, label: e || "Any education" }))}
            value={filters.education}
            onChange={(e) => setFilter("education", e.target.value)}
          />
          <Button type="submit" loading={loading} className="sm:col-span-3">
            <Search className="mr-1.5 h-4 w-4" />
            Search profiles
          </Button>
        </form>
      </Card>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {coinsError && (
        <Card className="border-yellow-300 bg-yellow-50">
          <div className="flex items-start gap-3">
            <Coins className="h-5 w-5 shrink-0 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">Coins required for page {page}</p>
              <p className="text-sm text-yellow-700">
                You need <strong>{coinsError.required} coins</strong> to view more results, but you only have <strong>{coinsError.held} coins</strong>.
              </p>
              <p className="mt-1 text-xs text-yellow-600">Top up your coins to continue browsing. Contact support or visit the wallet page.</p>
            </div>
          </div>
        </Card>
      )}

      {searched && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--color-muted)]">
              {total} profile{total !== 1 ? "s" : ""} found
              {page > 1 && <span className="ml-1 text-yellow-600">· Page {page} (coins deducted)</span>}
            </p>
            {page === 1 && (
              <Badge label="First page free" status="approved" />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((p) => (
              <ProfileCard key={p.uid} profile={p} />
            ))}
            {results.length === 0 && (
              <div className="col-span-3 rounded-2xl border border-[var(--color-border)] p-8 text-center text-[var(--color-muted)]">
                No profiles match your search. Try wider filters.
              </div>
            )}
          </div>

          <div className="flex justify-center gap-3">
            {page > 1 && (
              <Button variant="outline" onClick={() => doSearch(page - 1)} loading={loading}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
            )}
            {hasMore && (
              <Button onClick={() => doSearch(page + 1)} loading={loading}>
                Next <ChevronRight className="h-4 w-4" />
                {page >= 1 && <span className="ml-1 text-xs opacity-75">(50 coins)</span>}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ProfileCard({ profile }) {
  return (
    <Link href={`/matrimonial/${profile.uid}`}>
      <div className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm transition hover:border-[var(--color-primary)] hover:shadow-md">
        <div className="relative h-48 bg-[var(--color-border-light)]">
          {profile.primaryPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.primaryPhoto} alt={profile.displayName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[var(--color-muted)]">
              <Heart className="h-10 w-10 opacity-30" />
            </div>
          )}
        </div>
        <div className="flex-1 p-3">
          <p className="font-semibold">{profile.displayName}</p>
          <p className="text-sm text-[var(--color-muted)]">
            {profile.age && `${profile.age} yrs · `}{profile.district}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {profile.religion && <Chip label={profile.religion} />}
            {profile.ethnicity && <Chip label={profile.ethnicity} />}
            {profile.education && <Chip label={profile.education} />}
          </div>
        </div>
      </div>
    </Link>
  );
}

function Chip({ label }) {
  return (
    <span className="rounded-full bg-[var(--color-border-light)] px-2 py-0.5 text-xs text-[var(--color-muted)]">
      {label}
    </span>
  );
}
