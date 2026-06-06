"use client";

import { useEffect } from "react";

export function Modal({ open, onClose, title, children, size = "md" }) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-[var(--color-fg)]/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${widths[size]} max-h-[90vh] overflow-y-auto rounded-[var(--radius-xl)] bg-[var(--color-card)] shadow-[var(--shadow-lg)]`}>
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--color-border-light)] bg-[var(--color-card)] px-5 py-4">
          <h3 className="text-lg font-semibold text-[var(--color-fg)]">{title}</h3>
          <button onClick={onClose} className="rounded-[var(--radius-md)] p-1 text-[var(--color-muted-fg)] hover:bg-[var(--color-border-light)]" aria-label="Close">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
