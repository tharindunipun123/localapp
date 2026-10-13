"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, X, ZoomIn } from "lucide-react";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { resolveImageUrl, validateImageFile } from "@/lib/services/storage";

export function ImageUploadField({
  label = "Images",
  existingUrls = [],
  onExistingChange,
  files = [],
  onFilesChange,
  maxFiles = 8,
  hint = "PNG, JPG up to 10 MB each. Click a thumbnail to preview.",
}) {
  const inputRef = useRef(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [error, setError] = useState("");

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);

  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews]);

  const resolvedExisting = existingUrls.map((u) => resolveImageUrl(u)).filter(Boolean);
  const allLightboxImages = [...resolvedExisting, ...previews];

  function handleFileSelect(e) {
    setError("");
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;

    try {
      const combined = [...files, ...picked].slice(0, maxFiles);
      for (const f of picked) validateImageFile(f);
      if (files.length + picked.length > maxFiles) {
        setError(`Maximum ${maxFiles} images allowed.`);
      }
      onFilesChange(combined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid file");
    }
    e.target.value = "";
  }

  function removeExisting(index) {
    const next = existingUrls.filter((_, i) => i !== index);
    onExistingChange?.(next);
  }

  function removeFile(index) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  const total = resolvedExisting.length + files.length;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--color-fg)]">{label}</label>
      {hint && <p className="text-xs text-[var(--color-muted)]">{hint}</p>}

      <div className="flex flex-wrap gap-3">
        {resolvedExisting.map((url, i) => (
          <Thumbnail
            key={`existing-${url}-${i}`}
            src={url}
            onView={() => setLightboxIndex(i)}
            onRemove={() => removeExisting(i)}
            label="Saved"
          />
        ))}
        {previews.map((url, i) => (
          <Thumbnail
            key={`new-${url}`}
            src={url}
            onView={() => setLightboxIndex(resolvedExisting.length + i)}
            onRemove={() => removeFile(i)}
            label="New"
          />
        ))}

        {total < maxFiles && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            <Upload className="h-5 w-5" />
            <span className="text-xs">Add</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {error && (
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      )}

      {lightboxIndex !== null && (
        <ImageLightbox
          key={lightboxIndex}
          images={allLightboxImages}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

function Thumbnail({ src, onView, onRemove, label }) {
  return (
    <div className="group relative h-24 w-24 shrink-0">
      <button
        type="button"
        onClick={onView}
        className="h-full w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-sm"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/30 group-hover:opacity-100">
          <ZoomIn className="h-6 w-6 text-white" />
        </span>
      </button>
      {label && (
        <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute -right-1.5 -top-1.5 rounded-full bg-[var(--color-danger)] p-0.5 text-white shadow"
        aria-label="Remove image"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
