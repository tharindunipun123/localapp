"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { LocationPicker } from "@/components/maps/MapView";
import { useAuth } from "@/providers/AuthProvider";
import { createEvent, updateEventImages } from "@/lib/services/events";
import { uploadEventImage } from "@/lib/services/storage";
import { DEFAULT_CENTER } from "@/lib/utils/geohash";

const categoryOptions = [
  { value: "musical", label: "Musical" },
  { value: "dansal", label: "Dansal" },
  { value: "shramadana", label: "Shramadana" },
  { value: "cultural", label: "Cultural" },
  { value: "sports", label: "Sports" },
  { value: "meetup", label: "Meetup" },
  { value: "matrimonial", label: "Matrimonial" },
  { value: "other", label: "Other" },
];

const typeOptions = [
  { value: "free", label: "Free" },
  { value: "paid_inapp", label: "Paid (In-app wallet)" },
  { value: "paid_external", label: "Paid (External link)" },
];

export default function CreateEventPage() {
  return (
    <RoleGuard requireAuth>
      <CreateEventForm />
    </RoleGuard>
  );
}

function CreateEventForm() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lat, setLat] = useState(DEFAULT_CENTER.lat);
  const [lng, setLng] = useState(DEFAULT_CENTER.lng);
  const [locationLabel, setLocationLabel] = useState("");
  const [images, setImages] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "cultural",
    eventType: "free",
    startDatetime: "",
    endDatetime: "",
    ticketPrice: "",
    externalLink: "",
    maxAttendees: "",
    tags: "",
    chatEnabled: true,
  });

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    setError("");
    try {
      const eventId = await createEvent({
        title: form.title,
        description: form.description,
        category: form.category,
        eventType: form.eventType,
        lat,
        lng,
        locationLabel: locationLabel || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        startDatetime: new Date(form.startDatetime),
        endDatetime: new Date(form.endDatetime),
        createdBy: profile.uid,
        ticketPrice: form.eventType === "paid_inapp" ? Number(form.ticketPrice) : undefined,
        externalLink: form.eventType === "paid_external" ? form.externalLink : undefined,
        maxAttendees: form.maxAttendees ? Number(form.maxAttendees) : undefined,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        chatEnabled: form.chatEnabled,
      });

      if (images.length > 0) {
        const imageUrls = [];
        for (let i = 0; i < images.length; i++) {
          imageUrls.push(await uploadEventImage(images[i], eventId, i));
        }
        await updateEventImages(eventId, imageUrls);
      }

      router.push("/profile/events");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Card>
          <CardHeader
            title="Create Event"
            subtitle="Submit your event for admin review"
          />
          {error && (
            <div className="mb-4 rounded-[var(--radius-lg)] bg-[var(--color-danger-light)] px-3 py-2 text-sm text-[var(--color-danger-fg)]">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              required
              maxLength={120}
            />
            <Textarea
              label="Description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              required
              maxLength={2000}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Category"
                options={categoryOptions}
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
              />
              <Select
                label="Event type"
                options={typeOptions}
                value={form.eventType}
                onChange={(e) => update("eventType", e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Start"
                type="datetime-local"
                value={form.startDatetime}
                onChange={(e) => update("startDatetime", e.target.value)}
                required
              />
              <Input
                label="End"
                type="datetime-local"
                value={form.endDatetime}
                onChange={(e) => update("endDatetime", e.target.value)}
                required
              />
            </div>
            {form.eventType === "paid_inapp" && (
              <Input
                label="Ticket price (LKR)"
                type="number"
                value={form.ticketPrice}
                onChange={(e) => update("ticketPrice", e.target.value)}
                required
                min={1}
              />
            )}
            {form.eventType === "paid_external" && (
              <Input
                label="External purchase link"
                type="url"
                value={form.externalLink}
                onChange={(e) => update("externalLink", e.target.value)}
                required
              />
            )}
            <Input
              label="Max attendees (optional)"
              type="number"
              value={form.maxAttendees}
              onChange={(e) => update("maxAttendees", e.target.value)}
              min={1}
            />
            <Input
              label="Tags (comma separated)"
              value={form.tags}
              onChange={(e) => update("tags", e.target.value)}
              placeholder="wesak, colombo"
            />
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--color-fg)]">
                Location
              </label>
              <LocationPicker
                lat={lat}
                lng={lng}
                onChange={(newLat, newLng, label) => {
                  setLat(newLat);
                  setLng(newLng);
                  if (label) setLocationLabel(label);
                }}
              />
            </div>
            <ImageUploadField
              label="Event images"
              files={images}
              onFilesChange={setImages}
              hint="Add photos for your event. Click thumbnails to preview full size."
            />
            <label className="flex items-center gap-2 text-sm text-[var(--color-fg)]">
              <input
                type="checkbox"
                checked={form.chatEnabled}
                onChange={(e) => update("chatEnabled", e.target.checked)}
              />
              Enable group chat
            </label>
            <Button type="submit" className="w-full" loading={loading}>
              Submit for Review
            </Button>
          </form>
        </Card>
      </div>
    </PublicLayout>
  );
}
