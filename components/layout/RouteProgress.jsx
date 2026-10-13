"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function RouteProgress() {
  const pathname = usePathname();
  const first = useRef(true);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setActive(true);
    const done = window.setTimeout(() => setActive(false), 480);
    return () => window.clearTimeout(done);
  }, [pathname]);

  return (
    <div
      className={`route-progress${active ? " is-active" : ""}`}
      aria-hidden="true"
    />
  );
}
