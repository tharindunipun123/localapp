"use client";

import { useEffect } from "react";
import { getAnalytics, isSupported } from "firebase/analytics";
import { app } from "@/lib/firebase/client";
import { firebaseConfig } from "@/lib/config";

/** Initializes Firebase Analytics in the browser only */
export function AnalyticsInit() {
  useEffect(() => {
    if (!firebaseConfig.measurementId) return;
    isSupported().then((supported) => {
      if (supported) getAnalytics(app);
    });
  }, []);

  return null;
}
