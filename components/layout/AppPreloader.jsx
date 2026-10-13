"use client";

import { useEffect } from "react";

const BOOT_MS = 700;

function markBooted() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.add("app-booted");
  try {
    sessionStorage.setItem("la_ready", "1");
  } catch {
    /* ignore private-mode quota */
  }
}

export function AppPreloader() {
  useEffect(() => {
    let idleId = 0;
    const maxTimer = window.setTimeout(markBooted, BOOT_MS);

    const onReady = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(markBooted, { timeout: 220 });
      } else {
        markBooted();
      }
    };

    if (document.readyState === "complete") {
      onReady();
    } else {
      window.addEventListener("DOMContentLoaded", onReady, { once: true });
      window.addEventListener("load", onReady, { once: true });
    }

    return () => {
      window.clearTimeout(maxTimer);
      if (idleId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      window.removeEventListener("DOMContentLoaded", onReady);
      window.removeEventListener("load", onReady);
    };
  }, []);

  return null;
}
