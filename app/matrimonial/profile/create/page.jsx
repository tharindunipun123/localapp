"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useAuth } from "@/providers/AuthProvider";
import { createOrUpdateMatrimonialProfile, submitMatrimonialPhoto } from "@/lib/services/cloudFunctions";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { User, Camera } from "lucide-react";

const RELIGIONS = ["Buddhism", "Hinduism", "Christianity", "Islam", "Other"];
const ETHNICITIES = ["Sinhalese", "Tamil", "Muslim", "Burgher", "Malay", "Other"];
const EDUCATION = ["O/L", "A/L", "Diploma", "Bachelor's", "Master's", "PhD", "Other"];
const INCOME = ["< LKR 30,000", "LKR 30,000–60,000", "LKR 60,000–100,000", "LKR 100,000–200,000", "> LKR 200,000", "Prefer not to say"];
const DISTRICTS = ["Colombo","Gampaha","Kalutara","Kandy","Matale","Nuwara Eliya","Galle","Matara","Hambantota","Jaffna","Kilinochchi","Mannar","Vavuniya","Mullaitivu","Batticaloa","Ampara","Trincomalee","Kurunegala","Puttalam","Anuradhapura","Polonnaruwa","Badulla","Monaragala","Ratnapura","Kegalle"];
const HEIGHTS = Array.from({ length: 41 }, (_, i) => ({ value: String(145 + i), label: `${145 + i} cm (${Math.floor((145 + i) / 30.48)}ft ${Math.round(((145 + i) / 2.54) % 12)}in)` }));

export default function CreateMatrimonialProfilePage() {
  return (
    <RoleGuard requireAuth>
      <PublicLayout>
        <CreateProfileContent />
      </PublicLayout>
    </RoleGuard>
  );
}

function CreateProfileContent() {
  const { profile } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    gender: "male",
    dateOfBirth: "",
    religion: "Buddhism",
    ethnicity: "Sinhalese",
    caste: "",
    heightCm: "165",
    education: "Bachelor's",
    occupation: "",
    incomeRange: "LKR 30,000–60,000",
    district: "Colombo",
    city: "",
    aboutMe: "",
    hobbies: "",
    familyDetails: "",
    expectations: "",
    privacyShowFullName: true,
    privacyShowPhotosTo: "all",
  });
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const fileInputRef = useRef(null);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handlePhotoChange(e) {
    const files = Array.from(e.target.files ?? []);
    const total = photoFiles.length + files.length;
    if (total > 6) {
      setError("Maximum 6 photos allowed");
      return;
    }
    setPhotoFiles((prev) => [...prev, ...files]);
    setPhotoPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    setError("");
  }

  function removePhoto(index) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Create profile
      await createOrUpdateMatrimonialProfile({
        gender: form.gender,
        dateOfBirth: new Date(form.dateOfBirth).getTime(),
        religion: form.religion,
        ethnicity: form.ethnicity,
        caste: form.caste,
        heightCm: Number(form.heightCm),
        education: form.education,
        occupation: form.occupation,
        incomeRange: form.incomeRange,
        district: form.district,
        city: form.city,
        aboutMe: form.aboutMe,
        hobbies: form.hobbies.split(",").map((h) => h.trim()).filter(Boolean),
        familyDetails: form.familyDetails,
        expectations: form.expectations,
        privacyShowFullName: form.privacyShowFullName,
        privacyShowPhotosTo: form.privacyShowPhotosTo,
      });

      // Upload and submit photos for moderation
      for (const file of photoFiles) {
        const path = `matrimonial/${profile.uid}/photos/${Date.now()}_${file.name}`;
        const sr = storageRef(storage, path);
        await uploadBytes(sr, file, { contentType: file.type });
        const downloadUrl = await getDownloadURL(sr);
        await submitMatrimonialPhoto({ storagePath: path, downloadUrl });
      }

      router.push("/matrimonial/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <User className="h-6 w-6 text-[var(--color-primary)]" />
        <h1 className="text-2xl font-bold">Create Matrimonial Profile</h1>
      </div>

      {/* Step indicator */}
      <div className="mb-6 flex gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(s)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step === s
                  ? "bg-[var(--color-primary)] text-white"
                  : step > s
                  ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                  : "border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)]"
              }`}
            >
              {s}
            </button>
            {s < 3 && <div className="h-px w-8 bg-[var(--color-border)]" />}
          </div>
        ))}
        <span className="ml-2 text-sm text-[var(--color-muted)]">
          {step === 1 ? "Basic Info" : step === 2 ? "About Me" : "Photos & Privacy"}
        </span>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <Card>
            <CardHeader title="Basic information" subtitle="REQ-MAT-002" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Gender"
                options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }]}
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
              />
              <div>
                <label className="mb-1 block text-sm font-medium">Date of birth</label>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => set("dateOfBirth", e.target.value)}
                  max={new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0, 10)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  required
                />
              </div>
              <Select label="Religion" options={RELIGIONS.map((r) => ({ value: r, label: r }))} value={form.religion} onChange={(e) => set("religion", e.target.value)} />
              <Select label="Ethnicity" options={ETHNICITIES.map((e) => ({ value: e, label: e }))} value={form.ethnicity} onChange={(e) => set("ethnicity", e.target.value)} />
              <Input label="Caste (optional)" value={form.caste} onChange={(e) => set("caste", e.target.value)} placeholder="Optional" />
              <Select label="Height" options={HEIGHTS} value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
              <Select label="Education" options={EDUCATION.map((e) => ({ value: e, label: e }))} value={form.education} onChange={(e) => set("education", e.target.value)} />
              <Input label="Occupation" value={form.occupation} onChange={(e) => set("occupation", e.target.value)} required />
              <Select label="Income range" options={INCOME.map((i) => ({ value: i, label: i }))} value={form.incomeRange} onChange={(e) => set("incomeRange", e.target.value)} />
              <Select label="District" options={DISTRICTS.map((d) => ({ value: d, label: d }))} value={form.district} onChange={(e) => set("district", e.target.value)} />
              <Input label="City / Town" value={form.city} onChange={(e) => set("city", e.target.value)} required />
            </div>
            <Button type="button" className="mt-4 w-full" onClick={() => setStep(2)}>
              Next →
            </Button>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader title="About you" subtitle="Up to 500 characters" />
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">About me ({form.aboutMe.length}/500)</label>
                <textarea
                  rows={4}
                  maxLength={500}
                  value={form.aboutMe}
                  onChange={(e) => set("aboutMe", e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  placeholder="Tell potential matches about yourself..."
                />
              </div>
              <Input label="Hobbies (comma-separated)" value={form.hobbies} onChange={(e) => set("hobbies", e.target.value)} placeholder="Reading, Cooking, Travelling..." />
              <div>
                <label className="mb-1 block text-sm font-medium">Family details</label>
                <textarea
                  rows={3}
                  value={form.familyDetails}
                  onChange={(e) => set("familyDetails", e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  placeholder="Parents, siblings, family background..."
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Partner expectations</label>
                <textarea
                  rows={3}
                  value={form.expectations}
                  onChange={(e) => set("expectations", e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  placeholder="What are you looking for in a partner..."
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button type="button" className="flex-1" onClick={() => setStep(3)}>Next →</Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader title="Photos & Privacy" subtitle="REQ-MAT-003, REQ-MAT-004" />
            {/* Photos */}
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium">Photos (up to 6) — first is primary</p>
              <p className="mb-3 text-xs text-[var(--color-muted)]">Photos require admin approval before appearing publicly.</p>
              <div className="flex flex-wrap gap-2">
                {photoPreviews.map((src, i) => (
                  <div key={i} className="relative h-24 w-24">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full rounded-xl object-cover" />
                    {i === 0 && (
                      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-xs text-white">Primary</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {photoFiles.length < 6 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                  >
                    <Camera className="h-5 w-5" />
                    <span className="text-xs">Add photo</span>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
              </div>
            </div>

            {/* Privacy */}
            <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-3">
              <p className="text-sm font-semibold">Privacy settings (REQ-MAT-004)</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.privacyShowFullName}
                  onChange={(e) => set("privacyShowFullName", e.target.checked)}
                />
                Show full name (uncheck to show first name only)
              </label>
              <Select
                label="Show photos to"
                options={[
                  { value: "all", label: "All users" },
                  { value: "matches_only", label: "Accepted matches only" },
                  { value: "none", label: "No one" },
                ]}
                value={form.privacyShowPhotosTo}
                onChange={(e) => set("privacyShowPhotosTo", e.target.value)}
              />
            </div>

            <div className="mt-4 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>← Back</Button>
              <Button type="submit" loading={loading} className="flex-1">
                Create profile
              </Button>
            </div>
          </Card>
        )}
      </form>
    </div>
  );
}
