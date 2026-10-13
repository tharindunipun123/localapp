"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { googleMapsApiKey } from "@/lib/config";
import { resolveImageUrl } from "@/lib/services/storage";

let mapsLoaded = false;
let mapsLoading = null;

function loadGoogleMaps() {
  if (mapsLoaded && window.google?.maps) return Promise.resolve();
  if (mapsLoading) return mapsLoading;

  mapsLoading = new Promise((resolve, reject) => {
    window.initGoogleMaps = () => {
      mapsLoaded = true;
      resolve();
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places&callback=initGoogleMaps`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return mapsLoading;
}

const MARKER_COLORS = {
  event: "#1B7FDB",
  place: "#2B93E0",
  landmark: "#0A4E8A",
  attraction: "#3BA4F0",
  search: "#0A3A6B",
};

function buildInfoWindowContent(marker) {
  const imageUrl = resolveImageUrl(marker.imageUrl);
  const typeLabel =
    marker.type === "event"
      ? "Event"
      : marker.type === "landmark"
        ? "Landmark"
        : marker.type === "attraction"
          ? "Attraction"
          : marker.type === "search"
            ? "Location"
            : "Place";

  const imageHtml = imageUrl
    ? `<img src="${imageUrl}" alt="" style="width:100%;height:96px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />`
    : "";

  const subtitle = marker.subtitle
    ? `<p style="margin:0 0 6px;font-size:12px;color:#64748b;">${marker.subtitle}</p>`
    : "";

  const distance = marker.distanceKm
    ? `<p style="margin:0 0 8px;font-size:12px;color:#1B7FDB;">${marker.distanceKm.toFixed(1)} km away</p>`
    : "";

  const link = marker.href
    ? `<a href="${marker.href}" style="display:inline-block;margin-top:4px;font-size:13px;font-weight:600;color:#1B7FDB;text-decoration:none;">View details →</a>`
    : "";

  return `
    <div style="max-width:220px;font-family:system-ui,sans-serif;padding:4px;">
      ${imageHtml}
      <span style="display:inline-block;margin-bottom:4px;font-size:10px;font-weight:600;text-transform:uppercase;color:#64748b;">${typeLabel}</span>
      <h3 style="margin:0 0 4px;font-size:14px;font-weight:600;color:#0f172a;">${marker.title}</h3>
      ${subtitle}
      ${distance}
      ${link}
    </div>
  `;
}

function createRoundPhotoOverlay(map, marker, onMarkerClick, infoWindow) {
  const { lat, lng, title, type, imageUrl: rawImage } = marker;
  const imageUrl = resolveImageUrl(rawImage);
  const borderColor = MARKER_COLORS[type] ?? MARKER_COLORS.event;
  const letter = (title?.charAt(0) ?? "?").toUpperCase();

  class RoundPhotoMarker extends window.google.maps.OverlayView {
    onAdd() {
      this.container = document.createElement("div");
      this.container.style.position = "absolute";
      this.container.style.width = "52px";
      this.container.style.height = "52px";
      this.container.style.cursor = "pointer";
      this.container.style.transform = "translate(-50%, -50%)";
      this.container.style.zIndex = "10";

      const ring = document.createElement("div");
      ring.style.width = "100%";
      ring.style.height = "100%";
      ring.style.borderRadius = "50%";
      ring.style.border = `3px solid ${borderColor}`;
      ring.style.overflow = "hidden";
      ring.style.background = "#ffffff";
      ring.style.boxShadow = "0 2px 8px rgba(0,0,0,0.35)";

      if (imageUrl) {
        const img = document.createElement("img");
        img.src = imageUrl;
        img.alt = title ?? "";
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";
        img.referrerPolicy = "no-referrer";
        img.onerror = () => {
          ring.innerHTML = `<span style="display:flex;align-items:center;justify-content:center;height:100%;font:bold 18px sans-serif;color:${borderColor}">${letter}</span>`;
        };
        ring.appendChild(img);
      } else {
        ring.innerHTML = `<span style="display:flex;align-items:center;justify-content:center;height:100%;font:bold 18px sans-serif;color:${borderColor}">${letter}</span>`;
      }

      this.container.appendChild(ring);
      this.container.addEventListener("click", (e) => {
        e.stopPropagation();
        if (infoWindow && title) {
          infoWindow.setContent(buildInfoWindowContent(marker));
          infoWindow.setPosition({ lat, lng });
          infoWindow.open(map);
        }
        onMarkerClick?.(marker);
      });

      this.getPanes().overlayMouseTarget.appendChild(this.container);
    }

    draw() {
      if (!this.container) return;
      const projection = this.getProjection();
      if (!projection) return;
      const point = projection.fromLatLngToDivPixel(
        new window.google.maps.LatLng(lat, lng)
      );
      if (point) {
        this.container.style.left = `${point.x}px`;
        this.container.style.top = `${point.y}px`;
      }
    }

    onRemove() {
      this.container?.remove();
      this.container = null;
    }
  }

  const overlay = new RoundPhotoMarker();
  overlay.setMap(map);
  return overlay;
}

export function MapView({
  lat,
  lng,
  zoom = 14,
  className = "h-64 w-full rounded-[var(--radius-xl)]",
  markers = [],
  onClick,
  onMarkerClick,
  selectedId,
  interactive = true,
  hideDefaultMarker = false,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const overlaysRef = useRef([]);
  const infoWindowRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  const clearOverlays = useCallback(() => {
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapRef.current || !window.google?.maps) return;

        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          center: { lat, lng },
          zoom,
          mapTypeId: "satellite",
          mapTypeControl: interactive,
          disableDefaultUI: !interactive,
          gestureHandling: interactive ? "auto" : "none",
          zoomControl: interactive,
          scrollwheel: interactive,
          draggable: interactive,
        });

        infoWindowRef.current = new window.google.maps.InfoWindow();

        if (onClick && interactive) {
          mapInstanceRef.current.addListener("click", (e) => {
            if (e.latLng) onClick(e.latLng.lat(), e.latLng.lng());
          });
        }

        setReady(true);
      })
      .catch(() => setError("Map unavailable"));

    return () => {
      cancelled = true;
      clearOverlays();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClick, interactive, clearOverlays]);

  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat, lng });
    }
  }, [lat, lng]);

  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setZoom(zoom);
    }
  }, [zoom]);

  useEffect(() => {
    if (!ready || !mapInstanceRef.current || !window.google?.maps) return;

    clearOverlays();

    const items = markers.length
      ? markers
      : hideDefaultMarker
        ? []
        : [{ id: "center", lat, lng, title: "", type: "event" }];

    items.forEach((m) => {
      const overlay = createRoundPhotoOverlay(
        mapInstanceRef.current,
        m,
        onMarkerClick,
        infoWindowRef.current
      );
      overlaysRef.current.push(overlay);
    });
  }, [ready, markers, lat, lng, selectedId, onMarkerClick, clearOverlays, hideDefaultMarker]);

  if (error) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-[var(--color-primary-light)] text-sm text-[var(--color-muted)]`}
      >
        {error}
      </div>
    );
  }

  return <div ref={mapRef} className={className} />;
}

export function LocationPicker({ lat, lng, onChange, className }) {
  const [label, setLabel] = useState("");

  const handleClick = async (newLat, newLng) => {
    onChange(newLat, newLng, label);
    if (window.google?.maps) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          setLabel(results[0].formatted_address);
          onChange(newLat, newLng, results[0].formatted_address);
        }
      });
    }
  };

  return (
    <div className="space-y-2">
      <MapView
        lat={lat}
        lng={lng}
        hideDefaultMarker
        onClick={handleClick}
        className={className ?? "h-72 w-full rounded-[var(--radius-xl)]"}
      />
      {label && <p className="text-sm text-[var(--color-muted)]">{label}</p>}
    </div>
  );
}

export { loadGoogleMaps };
