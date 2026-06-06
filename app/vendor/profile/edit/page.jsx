"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useAuth } from "@/providers/AuthProvider";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { getVendor } from "@/lib/services/vendors";
import { updateVendorProfile } from "@/lib/services/cloudFunctions";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { MapPin, Clock, Image as ImageIcon } from "lucide-react";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const CATEGORIES = ["Restaurant", "Retail", "Beauty", "Health", "Entertainment", "Services", "Other"];

export default function VendorProfileEditPage() {
  return (
    <RoleGuard roles={["vendor", "admin"]} fallbackUrl="/">
      <EditContent />
    </RoleGuard>
  );
}

function EditContent() {
  const { profile } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    businessName: "",
    category: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    description: "",
    coordinates: { lat: "", lng: "" },
    operatingHours: DAYS.reduce((acc, d) => ({
      ...acc,
      [d]: { open: "09:00", close: "18:00", closed: false },
    }), {}),
  });

  const [logoFile, setLogoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState("");
  const [existingCoverUrl, setExistingCoverUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const logoRef = useRef(null);
  const coverRef = useRef(null);

  useEffect(() => {
    if (!profile?.uid) return;
    getVendor(profile.uid).then((v) => {
      if (!v) return;
      setForm({
        businessName: v.businessName ?? "",
        category: v.category ?? "",
        address: v.address ?? "",
        phone: v.phone ?? "",
        email: v.email ?? "",
        website: v.website ?? "",
        description: v.description ?? "",
        coordinates: {
          lat: v.coordinates?.lat ?? "",
          lng: v.coordinates?.lng ?? "",
        },
        operatingHours: DAYS.reduce((acc, d) => ({
          ...acc,
          [d]: v.operatingHours?.[d] ?? { open: "09:00", close: "18:00", closed: false },
        }), {}),
      });
      setExistingLogoUrl(v.logoUrl ?? "");
      setExistingCoverUrl(v.coverImageUrl ?? "");
    }).finally(() => setFetching(false));
  }, [profile]);

  function handleField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleHours(day, field, value) {
    setForm((f) => ({
      ...f,
      operatingHours: {
        ...f.operatingHours,
        [day]: { ...f.operatingHours[day], [field]: value },
      },
    }));
  }

  function handleImageChange(e, type) {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (type === "logo") { setLogoFile(file); setLogoPreview(preview); }
    else { setCoverFile(file); setCoverPreview(preview); }
  }

  async function uploadImage(file, path) {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return getDownloadURL(storageRef);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const uid = profile.uid;
      let logoUrl = existingLogoUrl;
      let coverImageUrl = existingCoverUrl;

      if (logoFile) {
        logoUrl = await uploadImage(logoFile, `vendors/${uid}/logo/${Date.now()}_logo`);
      }
      if (coverFile) {
        coverImageUrl = await uploadImage(coverFile, `vendors/${uid}/cover/${Date.now()}_cover`);
      }

      const lat = parseFloat(form.coordinates.lat);
      const lng = parseFloat(form.coordinates.lng);

      await updateVendorProfile({
        businessName: form.businessName,
        category: form.category,
        address: form.address,
        phone: form.phone,
        email: form.email,
        website: form.website,
        description: form.description,
        coordinates: !isNaN(lat) && !isNaN(lng) ? { lat, lng } : undefined,
        operatingHours: form.operatingHours,
        logoUrl,
        coverImageUrl,
      });

      setSuccess("Profile updated successfully!");
      setExistingLogoUrl(logoUrl);
      setExistingCoverUrl(coverImageUrl);
      setLogoFile(null);
      setCoverFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return <div className="p-8 text-center text-[var(--color-muted)]">Loading profile…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)]"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold">Edit Vendor Profile</h1>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      {success && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</p>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Images */}
        <Card>
          <CardHeader title="Brand images" icon={<ImageIcon className="h-4 w-4" />} />
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Logo */}
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--color-muted)]">Logo (square)</p>
              <div
                className="flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-border-light)] transition hover:border-[var(--color-primary)]"
                onClick={() => logoRef.current?.click()}
              >
                {logoPreview || existingLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview ?? existingLogoUrl}
                    alt="Logo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-[var(--color-muted)]">Click to upload logo</span>
                )}
              </div>
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageChange(e, "logo")}
              />
            </div>

            {/* Cover */}
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--color-muted)]">Cover image (wide)</p>
              <div
                className="flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-border-light)] transition hover:border-[var(--color-primary)]"
                onClick={() => coverRef.current?.click()}
              >
                {coverPreview || existingCoverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverPreview ?? existingCoverUrl}
                    alt="Cover"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-[var(--color-muted)]">Click to upload cover</span>
                )}
              </div>
              <input
                ref={coverRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageChange(e, "cover")}
              />
            </div>
          </div>
        </Card>

        {/* Basic info */}
        <Card>
          <CardHeader title="Business details" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Business name"
              value={form.businessName}
              onChange={(e) => handleField("businessName", e.target.value)}
              required
            />
            <Select
              label="Category"
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              value={form.category}
              onChange={(e) => handleField("category", e.target.value)}
            />
            <div className="sm:col-span-2">
              <Input
                label="Address"
                value={form.address}
                onChange={(e) => handleField("address", e.target.value)}
              />
            </div>
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => handleField("phone", e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => handleField("email", e.target.value)}
            />
            <div className="sm:col-span-2">
              <Input
                label="Website"
                value={form.website}
                onChange={(e) => handleField("website", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Description</label>
              <textarea
                rows={3}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                value={form.description}
                onChange={(e) => handleField("description", e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Coordinates */}
        <Card>
          <CardHeader title="Location coordinates" icon={<MapPin className="h-4 w-4" />} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Latitude"
              type="number"
              step="any"
              value={form.coordinates.lat}
              onChange={(e) => setForm((f) => ({ ...f, coordinates: { ...f.coordinates, lat: e.target.value } }))}
              placeholder="e.g. 6.9271"
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              value={form.coordinates.lng}
              onChange={(e) => setForm((f) => ({ ...f, coordinates: { ...f.coordinates, lng: e.target.value } }))}
              placeholder="e.g. 79.8612"
            />
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Find coordinates via{" "}
            <a
              href="https://maps.google.com"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Google Maps
            </a>{" "}
            (right-click → What's here?)
          </p>
        </Card>

        {/* Operating hours */}
        <Card>
          <CardHeader title="Operating hours" icon={<Clock className="h-4 w-4" />} />
          <div className="space-y-2">
            {DAYS.map((day) => (
              <div key={day} className="flex flex-wrap items-center gap-2">
                <span className="w-24 text-sm capitalize font-medium">{day}</span>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={form.operatingHours[day]?.closed ?? false}
                    onChange={(e) => handleHours(day, "closed", e.target.checked)}
                  />
                  Closed
                </label>
                {!form.operatingHours[day]?.closed && (
                  <>
                    <input
                      type="time"
                      value={form.operatingHours[day]?.open ?? "09:00"}
                      onChange={(e) => handleHours(day, "open", e.target.value)}
                      className="rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-sm"
                    />
                    <span className="text-xs text-[var(--color-muted)]">–</span>
                    <input
                      type="time"
                      value={form.operatingHours[day]?.close ?? "18:00"}
                      onChange={(e) => handleHours(day, "close", e.target.value)}
                      className="rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-sm"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Button type="submit" loading={loading} className="w-full">
          Save changes
        </Button>
      </form>
    </div>
  );
}
