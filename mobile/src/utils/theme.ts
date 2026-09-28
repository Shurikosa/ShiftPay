const palette = {
  brand: {
    primary: "#0F766E",
    pressed: "#115E59",
    tint: "#CCFBF1"
  },
  canvas: "#F8FAFC",
  surface: {
    default: "#FFFFFF",
    subtle: "#F1F5F9"
  },
  ink: {
    primary: "#0F172A",
    secondary: "#475569",
    muted: "#64748B"
  },
  border: "#CBD5E1",
  focus: "#0F766E",
  success: {
    fg: "#166534",
    bg: "#DCFCE7"
  },
  warning: {
    fg: "#92400E",
    bg: "#FEF3C7"
  },
  danger: {
    fg: "#B91C1C",
    bg: "#FEE2E2"
  },
  info: {
    fg: "#075985",
    bg: "#E0F2FE"
  }
} as const;

export const theme = {
  colors: palette,
  typography: {
    display: { fontSize: 32, lineHeight: 38, fontWeight: "700" as const },
    screenTitle: { fontSize: 24, lineHeight: 30, fontWeight: "700" as const },
    sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: "700" as const },
    cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: "600" as const },
    body: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
    label: { fontSize: 14, lineHeight: 20, fontWeight: "600" as const },
    supporting: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const }
  },
  space: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    6: 24,
    8: 32
  },
  inset: { screen: 20 },
  gap: { section: 24 },
  padding: { card: 16 },
  height: { control: { min: 48 } },
  target: { min: 44 },
  radius: { sm: 8, md: 12, lg: 16 },
  border: { default: 1 },
  elevation: {
    overlay: {
      shadowColor: palette.ink.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
      elevation: 2
    }
  }
} as const;

// Compatibility aliases keep existing consumers compiling until their dedicated
// shared-component and screen migration steps.
export const colors = {
  background: theme.colors.canvas,
  surface: theme.colors.surface.subtle,
  white: theme.colors.surface.default,
  text: theme.colors.ink.primary,
  textSecondary: theme.colors.ink.secondary,
  textMuted: theme.colors.ink.muted,
  border: theme.colors.border,
  primary: theme.colors.brand.primary,
  primaryPressed: theme.colors.brand.pressed,
  primarySoft: theme.colors.brand.tint,
  focus: theme.colors.focus,
  error: theme.colors.danger.fg,
  errorSoft: theme.colors.danger.bg,
  success: theme.colors.success.fg,
  successSoft: theme.colors.success.bg,
  warning: theme.colors.warning.fg,
  warningSoft: theme.colors.warning.bg,
  info: theme.colors.info.fg,
  infoSoft: theme.colors.info.bg
} as const;

export const spacing = {
  xs: theme.space[1],
  sm: theme.space[2],
  md: theme.space[3],
  lg: theme.space[4],
  xl: theme.space[6],
  xxl: theme.space[8]
} as const;

export const radii = {
  control: theme.radius.sm,
  card: theme.radius.lg
} as const;

export const typography = {
  ...theme.typography,
  button: theme.typography.label
} as const;
