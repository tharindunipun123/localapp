/**
 * Local App — light blue + blue theme.
 * Keep in sync with app/globals.css.
 */
const theme = {
  colors: {
    ink: "#0A3A6B",
    inkSoft: "#0E4D8A",
    background: "#EAF4FB",
    foreground: "#0A3A6B",
    muted: "#4D7394",
    mutedForeground: "#7EA0BB",
    card: "#FFFFFF",
    cardForeground: "#0A3A6B",
    border: "#C5DDF0",
    borderLight: "#DCEEF9",
    input: "#C5DDF0",
    ring: "#7EC8F0",
    primary: {
      DEFAULT: "#1B7FDB",
      hover: "#1464B4",
      light: "#D7ECFB",
      foreground: "#FFFFFF",
    },
    secondary: {
      DEFAULT: "#E3F2FC",
      foreground: "#0E4D8A",
    },
    accent: {
      DEFAULT: "#3BA4F0",
      foreground: "#FFFFFF",
    },
    money: {
      DEFAULT: "#0E6BC4",
      light: "#D7ECFB",
      foreground: "#0A4E8A",
    },
    success: {
      DEFAULT: "#17806A",
      light: "#E5F6F2",
      foreground: "#126655",
    },
    warning: {
      DEFAULT: "#C4841D",
      light: "#F8F1E2",
      foreground: "#8A5C12",
    },
    danger: {
      DEFAULT: "#C43A3A",
      light: "#F8EAEA",
      foreground: "#9A2C2C",
    },
    hero: {
      from: "#0A3A6B",
      via: "#1B7FDB",
      to: "#3BA4F0",
    },
    segment: {
      events: "#1B7FDB",
      places: "#2B93E0",
      wallet: "#0E6BC4",
      lottery: "#3BA4F0",
      matrimonial: "#4A8FD9",
      kyc: "#0A4E8A",
      family: "#2A7FBF",
      admin: "#0A3A6B",
    },
  },
  radius: {
    sm: "0.375rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
  },
  shadow: {
    sm: "0 1px 2px 0 rgb(10 58 107 / 0.06)",
    md: "0 4px 6px -1px rgb(10 58 107 / 0.08), 0 2px 4px -2px rgb(10 58 107 / 0.05)",
    lg: "0 10px 15px -3px rgb(10 58 107 / 0.1), 0 4px 6px -4px rgb(10 58 107 / 0.06)",
  },
  font: {
    sans: "var(--font-jakarta), var(--font-noto-sinhala), system-ui, sans-serif",
  },
};

theme.flat = {
  bg: theme.colors.background,
  fg: theme.colors.foreground,
  ink: theme.colors.ink,
  muted: theme.colors.muted,
  card: theme.colors.card,
  border: theme.colors.border,
  primary: theme.colors.primary.DEFAULT,
  primaryHover: theme.colors.primary.hover,
  primaryLight: theme.colors.primary.light,
  primaryFg: theme.colors.primary.foreground,
  money: theme.colors.money.DEFAULT,
  success: theme.colors.success.DEFAULT,
  successLight: theme.colors.success.light,
  warning: theme.colors.warning.DEFAULT,
  warningLight: theme.colors.warning.light,
  danger: theme.colors.danger.DEFAULT,
  dangerLight: theme.colors.danger.light,
};

module.exports = theme;
