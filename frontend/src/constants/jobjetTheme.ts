// JobJet visual identity — mostly a clean black/white/grey system, with a
// touch of blue as the brand accent (buttons, active tab, hero gradients).
// Status is still communicated primarily with fill/outline/weight, so the
// app stays legible even where colour isn't the only signal.

export const colors = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F5F5F6",
  border: "#E4E4E7",
  borderStrong: "#D4D4D8",

  textPrimary: "#0A0A0A",
  textSecondary: "#52525B",
  textMuted: "#9A9AA0",

  // Primary "action" colour — a confident blue, used for buttons, active
  // states, links, and anywhere an accent is needed.
  primary: "#2563EB",
  primaryDark: "#1D4ED8",

  // Soft blue tint for subtle backgrounds/highlights (selected cards, etc).
  primaryMuted: "#EFF4FF",

  // Kept for backward compatibility with older screens.
  accentTeal: "#3F3F46",
  accentPink: "#71717A",

  black: "#000000",
  white: "#FFFFFF",

  // Status colours are intentionally desaturated near-blacks/greys —
  // differentiation comes from the badge's fill vs. outline vs. label,
  // not from colour.
  danger: "#0A0A0A",
  dangerBg: "#F0F0F1",
  success: "#0A0A0A",
  successBg: "#F0F0F1",
  info: "#0A0A0A",
  infoBg: "#F0F0F1",
  warning: "#0A0A0A",
  warningBg: "#F0F0F1",
};

// Gradient stops for LinearGradient usage (primary buttons, hero screens,
// highlights) — a subtle blue shading rather than a flat colour.
export const gradients = {
  brand: [colors.primary, colors.primaryDark] as const,
  accent: ["#3B82F6", colors.primaryDark] as const,
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
