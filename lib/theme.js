/**
 * Local App Sri Lanka — single source of truth for design tokens.
 * Used by globals.css (CSS variables) and available in JS for maps/charts.
 */
const theme = {
  colors: {
    background: "#f8fafc",
    foreground: "#0f172a",
    muted: "#64748b",
    mutedForeground: "#94a3b8",
    card: "#ffffff",
    cardForeground: "#0f172a",
    border: "#e2e8f0",
    borderLight: "#f1f5f9",
    input: "#e2e8f0",
    ring: "#7dd3fc",
    primary: {
      DEFAULT: "#0284c7",
      hover: "#0369a1",
      light: "#e0f2fe",
      foreground: "#ffffff",
    },
    secondary: {
      DEFAULT: "#f0f9ff",
      foreground: "#0369a1",
    },
    accent: {
      DEFAULT: "#0ea5e9",
      foreground: "#ffffff",
    },
    success: {
      DEFAULT: "#059669",
      light: "#ecfdf5",
      foreground: "#047857",
    },
    warning: {
      DEFAULT: "#d97706",
      light: "#fffbeb",
      foreground: "#b45309",
    },
    danger: {
      DEFAULT: "#dc2626",
      light: "#fef2f2",
      foreground: "#b91c1c",
    },
    hero: {
      from: "#0284c7",
      via: "#0ea5e9",
      to: "#0369a1",
    },
  },
  radius: {
    sm: "0.375rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
  },
  shadow: {
    sm: "0 1px 2px 0 rgb(15 23 42 / 0.05)",
    md: "0 4px 6px -1px rgb(15 23 42 / 0.07), 0 2px 4px -2px rgb(15 23 42 / 0.05)",
    lg: "0 10px 15px -3px rgb(15 23 42 / 0.08), 0 4px 6px -4px rgb(15 23 42 / 0.05)",
  },
  font: {
    sans: 'var(--font-inter), var(--font-noto-sinhala), system-ui, sans-serif',
  },
};

/** Tailwind-friendly flat color map */
theme.flat = {
  bg: theme.colors.background,
  fg: theme.colors.foreground,
  muted: theme.colors.muted,
  card: theme.colors.card,
  border: theme.colors.border,
  primary: theme.colors.primary.DEFAULT,
  primaryHover: theme.colors.primary.hover,
  primaryLight: theme.colors.primary.light,
  primaryFg: theme.colors.primary.foreground,
  success: theme.colors.success.DEFAULT,
  successLight: theme.colors.success.light,
  warning: theme.colors.warning.DEFAULT,
  warningLight: theme.colors.warning.light,
  danger: theme.colors.danger.DEFAULT,
  dangerLight: theme.colors.danger.light,
};

module.exports = theme;
