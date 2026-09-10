// JobJet visual identity — matches the "jj" logo mark: a deep indigo to
// violet to magenta gradient. Hierarchy still comes mostly from
// black/white/grey contrast, weight, and spacing; the violet/magenta accent
// is used for buttons, active states, and hero gradients so the whole app
// reads as one consistent brand instead of a generic template.

export const colors = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F6F4FB",
  // A faint violet-tinted surface, used behind selected cards/rows so the
  // brand shading reads as an intentional accent rather than pure grey.
  surfaceTintBlue: "#F1EBFC",
  border: "#E7E1F2",
  borderStrong: "#D8CFEC",

  textPrimary: "#150C2E",
  textSecondary: "#5B5470",
  textMuted: "#9C93AF",

  // Primary "action" colour — the violet from the jj logo, used for
  // buttons, active tab states, links, and selection highlights.
  primary: "#7C1FE0",
  primaryDark: "#2B1093",
  primaryLight: "#C93AF6",

  // Kept for backward compatibility with older screens.
  accentTeal: "#3F3F46",
  accentPink: "#C93AF6",

  black: "#000000",
  white: "#FFFFFF",

  // Status colours are intentionally desaturated near-blacks/greys —
  // differentiation comes from the badge's fill vs. outline vs. label,
  // not from colour.
  danger: "#150C2E",
  dangerBg: "#F1EEF6",
  success: "#150C2E",
  successBg: "#F1EEF6",
  info: "#7C1FE0",
  infoBg: "#F1EBFC",
  warning: "#150C2E",
  warningBg: "#F1EEF6",
};

// Gradient stops for LinearGradient usage (hero sections, primary buttons,
// FAB, highlights). "brand" sweeps from deep indigo to violet, "accent"
// sweeps from violet into magenta — both lifted straight from the jj logo
// mark so gradients and the logo always feel like the same palette.
export const gradients = {
  brand: [colors.primaryDark, colors.primary] as const,
  accent: [colors.primary, colors.primaryLight] as const,
};

// Each status is visually distinct through fill vs. outline vs. weight,
// not hue — keeping everything strictly black / white / grey.
export const statusMeta: Record<string, { fg: string; bg: string; label: string }> = {
  draft: { fg: colors.textSecondary, bg: colors.surfaceMuted, label: "Draft" },
  generated: { fg: colors.textPrimary, bg: colors.surfaceMuted, label: "Generated" },
  ready_to_send: { fg: colors.textPrimary, bg: colors.surfaceMuted, label: "Ready to Send" },
  sent: { fg: colors.white, bg: colors.black, label: "Sent" },
  replied: { fg: colors.white, bg: colors.black, label: "Replied" },
  interview: { fg: colors.white, bg: colors.black, label: "Interview" },
  rejected: { fg: colors.textMuted, bg: colors.surfaceMuted, label: "Rejected" },
  archived: { fg: colors.textMuted, bg: colors.surfaceMuted, label: "Archived" },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const radius = { sm: 10, md: 14, lg: 20, full: 999 };

export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  bodyBold: { fontSize: 15, fontWeight: "600" as const },
  small: { fontSize: 13, fontWeight: "400" as const },
  tiny: { fontSize: 11, fontWeight: "500" as const, letterSpacing: 0.3 as number },
};
