"use client";

import { useState } from "react";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { resolveImageUrl } from "@/lib/services/storage";
import { MapPin } from "lucide-react";

export function ImageGallery({
  images = [],
  alt = "Gallery image",
  fallbackIcon: FallbackIcon = MapPin,
  aspectClass = "aspect-[16/9]",
}) {
  const urls = images.map((img) => resolveImageUrl(img)).filter(Boolean);
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(null);

  if (!urls.length) {
    return (
      <div
        className={`relative overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-primary-light)] ${aspectClass}`}
      >
        <div className="flex h-full min-h-[200px] items-center justify-center text-[var(--color-accent)]">
          <FallbackIcon className="h-16 w-16" />
        </div>
      </div>
    );
  }

  const main = urls[active] ?? urls[0];

  return (
    <>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setLightbox(active)}
          className={`relative block w-full overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-primary-light)] ${aspectClass}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={main}
            alt={alt}
            className="h-full w-full object-cover transition-transform hover:scale-[1.02]"
          />
          <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white">
            Click to enlarge
          </span>
        </button>

        {urls.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {urls.map((url, i) => (
              <button
                key={url + i}
                type="button"
                onClick={() => {
                  setActive(i);
                  setLightbox(i);
                }}
                className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-[var(--radius-lg)] border-2 transition-colors ${
                  i === active
                    ? "border-[var(--color-primary)]"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {lightbox !== null && (
        <ImageLightbox
          key={lightbox}
          images={urls}
          startIndex={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
