import { cn } from "@/lib/utils/cn";

const styles = {
  pending: "bg-[var(--color-warning-light)] text-[var(--color-warning-fg)] ring-[var(--color-warning)]/20",
  approved: "bg-[var(--color-success-light)] text-[var(--color-success-fg)] ring-[var(--color-success)]/20",
  active: "bg-[var(--color-success-light)] text-[var(--color-success-fg)] ring-[var(--color-success)]/20",
  rejected: "bg-[var(--color-danger-light)] text-[var(--color-danger-fg)] ring-[var(--color-danger)]/20",
  expired: "bg-[var(--color-border-light)] text-[var(--color-muted)] ring-[var(--color-border)]",
  cancelled: "bg-[var(--color-border-light)] text-[var(--color-muted)] ring-[var(--color-border)]",
  hidden: "bg-[var(--color-border-light)] text-[var(--color-muted)] ring-[var(--color-border)]",
  published: "bg-[var(--color-primary-light)] text-[var(--color-primary)] ring-[var(--color-primary)]/20",
  reported: "bg-[var(--color-warning-light)] text-[var(--color-warning-fg)] ring-[var(--color-warning)]/20",
  success: "bg-[var(--color-success-light)] text-[var(--color-success-fg)] ring-[var(--color-success)]/20",
  failed: "bg-[var(--color-danger-light)] text-[var(--color-danger-fg)] ring-[var(--color-danger)]/20",
  free: "bg-[var(--color-primary-light)] text-[var(--color-primary)] ring-[var(--color-primary)]/20",
  paid_inapp: "bg-[var(--color-secondary)] text-[var(--color-secondary-fg)] ring-[var(--color-primary)]/20",
  paid_external: "bg-[var(--color-secondary)] text-[var(--color-secondary-fg)] ring-[var(--color-primary)]/20",
};

export function Badge({ label, status, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        styles[status] ?? "bg-[var(--color-border-light)] text-[var(--color-muted)] ring-[var(--color-border)]",
        className
      )}
    >
      {label}
    </span>
  );
}
