import { cn } from "@/lib/utils/cn";
import { forwardRef } from "react";

export const Textarea = forwardRef(function Textarea({ className, label, error, id, ...props }, ref) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-[var(--color-fg)]">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        className={cn(
          "w-full min-h-[100px] rounded-[var(--radius-lg)] border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted-fg)] focus:border-[var(--color-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)]",
          error && "border-[var(--color-danger)]",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
});
