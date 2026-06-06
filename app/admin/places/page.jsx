"use client";

import { useEffect, useState } from "react";
import { CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { LocationPicker } from "@/components/maps/MapView";
import {
  getAllPlacesAdmin,
  createPlace,
  updatePlace,
  deletePlace,
} from "@/lib/services/places";
import { uploadPlaceImage, resolveImageUrl } from "@/lib/services/storage";
import { DEFAULT_CENTER } from "@/lib/utils/geohash";
import { useAuth } from "@/providers/AuthProvider";
import { Plus, Pencil, Trash2 } from "lucide-react";

const emptyForm = {
  name: "",
  type: "attraction",
  description: "",
  province: "",
  district: "",
  city: "",
  category: "",
  operatingHours: "",
  entryFee: "0",
  websiteUrl: "",
  metaTitle: "",
  metaDescription: "",
  parentLandmarkId: "",
};

export default function AdminPlacesPage() {
  const { profile } = useAuth();
  const [places, setPlaces] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [lat, setLat] = useState(DEFAULT_CENTER.lat);
  const [lng, setLng] = useState(DEFAULT_CENTER.lng);
  const [imageFiles, setImageFiles] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function refresh() {
    getAllPlacesAdmin().then(setPlaces);
  }

  useEffect(() => {
    refresh();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setLat(DEFAULT_CENTER.lat);
    setLng(DEFAULT_CENTER.lng);
    setImageFiles([]);
    setExistingImages([]);
    setModalOpen(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      name: p.name,
      type: p.type,
      description: p.description,
      province: p.province,
      district: p.district,
      city: p.city,
      category: p.category,
      operatingHours: p.operatingHours ?? "",
      entryFee: String(p.entryFee ?? 0),
      websiteUrl: p.websiteUrl ?? "",
      metaTitle: p.metaTitle ?? "",
      metaDescription: p.metaDescription ?? "",
      parentLandmarkId: p.parentLandmarkId ?? "",
    });
    setLat(p.coordinates.latitude);
    setLng(p.coordinates.longitude);
    setImageFiles([]);
    setExistingImages(p.images ?? []);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!profile) return;
    setLoading(true);
    setError("");
    try {
      const input = {
        name: form.name,
        type: form.type,
        description: form.description,
        lat,
        lng,
        province: form.province,
        district: form.district,
        city: form.city,
        category: form.category,
        operatingHours: form.operatingHours,
        entryFee: Number(form.entryFee) || 0,
        websiteUrl: form.websiteUrl,
        metaTitle: form.metaTitle || form.name,
        metaDescription: form.metaDescription || form.description.slice(0, 160),
        parentLandmarkId: form.parentLandmarkId || undefined,
        createdBy: profile.uid,
      };

      let placeId;
      if (editing) {
        await updatePlace(editing.id, input);
        placeId = editing.id;
      } else {
        placeId = await createPlace(input);
      }

      if (imageFiles.length > 0) {
        const imageUrls = [];
        for (let i = 0; i < imageFiles.length; i++) {
          imageUrls.push(await uploadPlaceImage(imageFiles[i], placeId, existingImages.length + i));
        }
        await updatePlace(placeId, { images: [...existingImages, ...imageUrls] });
      } else if (editing && existingImages.length !== (editing.images ?? []).length) {
        await updatePlace(placeId, { images: existingImages });
      }

      setModalOpen(false);
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save place";
      if (message.includes("storage/unauthorized")) {
        setError(
          `Image upload was rejected. Try a smaller image (under 10 MB) or sign out and back in. (${message})`
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this place?")) return;
    await deletePlace(id);
    refresh();
  }

  const landmarks = places.filter((p) => p.type === "landmark");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <CardHeader title="Places" subtitle="Manage landmarks and attractions" />
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add Place
        </Button>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)]">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border-light)] bg-[var(--color-bg)]">
            <tr>
              <th className="px-4 py-3 text-left">Place</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Location</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {places.map((p) => (
              <tr key={p.id} className="border-b border-[var(--color-border-light)]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveImageUrl(p.images[0])}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary-light)] text-xs font-bold text-[var(--color-primary)]">
                        {p.name.charAt(0)}
                      </div>
                    )}
                    <span className="font-medium text-[var(--color-fg)]">{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge label={p.type} status="approved" />
                </td>
                <td className="px-4 py-3 text-[var(--color-muted)]">
                  {p.city}, {p.district}
                </td>
                <td className="space-x-1 px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {places.length === 0 && (
          <p className="p-4 text-[var(--color-muted)]">No places yet.</p>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Place" : "Create Place"}
        size="lg"
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Select
            label="Type"
            options={[
              { value: "landmark", label: "Landmark" },
              { value: "attraction", label: "Attraction" },
            ]}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          />
          {form.type === "attraction" && (
            <Select
              label="Parent Landmark"
              options={[
                { value: "", label: "None" },
                ...landmarks.map((l) => ({ value: l.id, label: l.name })),
              ]}
              value={form.parentLandmarkId}
              onChange={(e) => setForm({ ...form, parentLandmarkId: e.target.value })}
            />
          )}
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Province"
              value={form.province}
              onChange={(e) => setForm({ ...form, province: e.target.value })}
            />
            <Input
              label="District"
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
            />
            <Input
              label="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <Input
            label="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          {form.type === "attraction" && (
            <>
              <Input
                label="Operating Hours"
                value={form.operatingHours}
                onChange={(e) => setForm({ ...form, operatingHours: e.target.value })}
              />
              <Input
                label="Entry Fee (LKR)"
                type="number"
                value={form.entryFee}
                onChange={(e) => setForm({ ...form, entryFee: e.target.value })}
              />
            </>
          )}
          <Input
            label="Website URL"
            value={form.websiteUrl}
            onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
          />
          <Input
            label="Meta Title"
            value={form.metaTitle}
            onChange={(e) => setForm({ ...form, metaTitle: e.target.value })}
          />
          <Textarea
            label="Meta Description"
            value={form.metaDescription}
            onChange={(e) => setForm({ ...form, metaDescription: e.target.value })}
          />
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-fg)]">
              Location
            </label>
            <LocationPicker
              lat={lat}
              lng={lng}
              onChange={(a, b) => {
                setLat(a);
                setLng(b);
              }}
            />
          </div>
          <ImageUploadField
            label="Images"
            existingUrls={existingImages}
            onExistingChange={setExistingImages}
            files={imageFiles}
            onFilesChange={setImageFiles}
          />
          {error && (
            <div className="rounded-[var(--radius-lg)] bg-[var(--color-danger-light)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
              {error}
            </div>
          )}
          <Button onClick={handleSave} loading={loading} className="w-full">
            Save
          </Button>
        </div>
      </Modal>
    </div>
  );
}
