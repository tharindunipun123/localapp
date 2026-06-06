import { cn } from "@/lib/utils/cn";

export function Select({ label, options, className, id, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-[var(--color-fg)]">
          {label}
        </label>
      )}
      <select
        id={id}
        className={cn(
          "w-full rounded-[var(--radius-lg)] border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-[var(--color-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)]",
          className
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
