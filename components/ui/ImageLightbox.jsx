"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { resolveImageUrl } from "@/lib/services/storage";

export function ImageLightbox({ images, startIndex = 0, onClose }) {
  const urls = images.map((img) => resolveImageUrl(img)).filter(Boolean);
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, urls.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, urls.length]);

  if (!urls.length) return null;

  const src = urls[index];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>

      {urls.length > 1 && (
        <>
          <button
            type="button"
            disabled={index === 0}
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => Math.max(0, i - 1));
            }}
            className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button
            type="button"
            disabled={index === urls.length - 1}
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => Math.min(urls.length - 1, i + 1));
            }}
            className="absolute right-4 top-16 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30"
            aria-label="Next image"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80">
            {index + 1} / {urls.length}
          </p>
        </>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
