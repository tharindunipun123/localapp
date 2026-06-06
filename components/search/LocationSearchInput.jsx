"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  fetchPlacePredictions,
  fetchPlaceDetails,
} from "@/lib/services/googlePlaces";

export function LocationSearchInput({
  placeholder = "Search cities, landmarks, attractions in Sri Lanka…",
  onSelect,
  className,
  inputClassName,
  initialValue = "",
}) {
  const [value, setValue] = useState(initialValue);
  const [predictions, setPredictions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setPredictions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await fetchPlacePredictions(value);
        setPredictions(results);
        setOpen(results.length > 0);
        setActiveIndex(-1);
      } catch {
        setPredictions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  async function pickPrediction(prediction) {
    setLoading(true);
    setOpen(false);
    try {
      const place = await fetchPlaceDetails(prediction.placeId);
      setValue(place.name);
      onSelect?.(place);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (!open || predictions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      pickPrediction(predictions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-primary)]" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-[var(--radius-lg)] border border-[var(--color-input)] bg-[var(--color-card)] py-2 pl-9 pr-9 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted-fg)] focus:border-[var(--color-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)]",
            inputClassName
          )}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--color-muted)]" />
        )}
      </div>

      {open && predictions.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-[var(--shadow-lg)]">
          {predictions.map((p, i) => (
            <li key={p.placeId}>
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-[var(--color-primary-light)]",
                  i === activeIndex && "bg-[var(--color-primary-light)]"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickPrediction(p)}
              >
                <span className="font-medium text-[var(--color-fg)]">{p.name}</span>
                <span className="text-xs text-[var(--color-muted)]">{p.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
