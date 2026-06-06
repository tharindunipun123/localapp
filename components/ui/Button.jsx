import { cn } from "@/lib/utils/cn";
import { forwardRef } from "react";

const variants = {
  primary: "bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)] shadow-[var(--shadow-sm)]",
  secondary: "bg-[var(--color-secondary)] text-[var(--color-secondary-fg)] hover:opacity-90",
  outline: "border border-[var(--color-primary-light)] text-[var(--color-primary)] hover:bg-[var(--color-secondary)]",
  ghost: "text-[var(--color-muted)] hover:bg-[var(--color-border-light)]",
  danger: "bg-[var(--color-danger)] text-white hover:opacity-90",
};

const sizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = forwardRef(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-lg)] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      )}
      {children}
    </button>
  );
});
