"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, RefreshCw, X } from "lucide-react";
import { validateImageFile } from "@/lib/services/storage";

export function KycDocumentCapture({
  label,
  hint,
  facing = "environment",
  file,
  onChange,
}) {
  const videoRef = useRef(null);
  const inputRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    return () => stopCamera(stream);
  }, [stream]);

  function stopCamera(active) {
    (active ?? stream)?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraOn(false);
  }

  async function startCamera() {
    setError("");
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing === "user" ? "user" : { ideal: "environment" },
          width: { ideal: 1600 },
        },
        audio: false,
      });
      setStream(next);
      setCameraOn(true);
      if (videoRef.current) {
        videoRef.current.srcObject = next;
      }
    } catch {
      setError("Camera access was blocked. Upload a photo instead.");
    }
  }

  function snap() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const captured = new File([blob], `${label.replace(/\s+/g, "-").toLowerCase()}.jpg`, {
          type: "image/jpeg",
        });
        onChange(captured);
        stopCamera();
      },
      "image/jpeg",
      0.88
    );
  }

  function handleFile(e) {
    setError("");
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    try {
      validateImageFile(picked);
      onChange(picked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid image");
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-[var(--color-fg)]">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-[var(--color-muted)]">{hint}</p>}
      </div>

      {preview && !cameraOn && (
        <div className="relative mb-3 overflow-hidden rounded-xl bg-[var(--color-secondary)]">
          <img src={preview} alt={label} className="mx-auto max-h-56 w-full object-contain" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-[var(--color-muted)] shadow"
            aria-label="Remove photo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {cameraOn && (
        <div className="mb-3 overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="mx-auto max-h-64 w-full object-contain" />
        </div>
      )}

      {error && <p className="mb-2 text-xs text-[var(--color-danger-fg)]">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {cameraOn ? (
          <>
            <button
              type="button"
              onClick={snap}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-medium text-white"
            >
              <Camera className="h-3.5 w-3.5" /> Capture
            </button>
            <button
              type="button"
              onClick={() => stopCamera()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-secondary)] px-3 py-2 text-xs font-medium text-[var(--color-fg)]"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={startCamera}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-medium text-white"
            >
              <Camera className="h-3.5 w-3.5" /> {file ? "Retake" : "Use camera"}
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-primary-light)] px-3 py-2 text-xs font-medium text-[var(--color-primary)]"
            >
              {file ? <RefreshCw className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
              Upload
            </button>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={facing === "user" ? "user" : "environment"}
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
