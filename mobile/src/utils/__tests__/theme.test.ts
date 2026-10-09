import { colors, radii, spacing, theme, typography } from "../theme";

describe("theme tokens", () => {
  it("defines the documented semantic color, dimension, and typography tokens", () => {
    expect(theme.colors).toEqual({
      brand: { primary: "#0F766E", pressed: "#115E59", tint: "#CCFBF1" },
      canvas: "#F8FAFC",
      surface: { default: "#FFFFFF", subtle: "#F1F5F9" },
      ink: { primary: "#0F172A", secondary: "#475569", muted: "#64748B" },
      border: "#CBD5E1",
      focus: "#0F766E",
      success: { fg: "#166534", bg: "#DCFCE7" },
      warning: { fg: "#92400E", bg: "#FEF3C7" },
      danger: { fg: "#B91C1C", bg: "#FEE2E2" },
      info: { fg: "#075985", bg: "#E0F2FE" }
    });
    expect(theme.space).toEqual({ 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32 });
    expect(theme.height.control.min).toBe(48);
    expect(theme.target.min).toBe(44);
    expect(theme.icon.size).toEqual({ metadata: 16, control: 20, tile: 28 });
    expect(theme.radius).toEqual({ sm: 8, md: 12, lg: 16 });
    expect(theme.border.default).toBe(1);
    expect(theme.typography.display).toMatchObject({ fontSize: 32, lineHeight: 38 });
    expect(theme.typography.screenTitle).toMatchObject({ fontSize: 24, lineHeight: 30 });
  });

  it("retains compatibility aliases for existing presentation consumers", () => {
    expect(colors).toEqual({
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
    });
    expect(spacing).toEqual({
      xs: theme.space[1],
      sm: theme.space[2],
      md: theme.space[3],
      lg: theme.space[4],
      xl: theme.space[6],
      xxl: theme.space[8]
    });
    expect(radii).toEqual({ control: theme.radius.sm, card: theme.radius.lg });
    expect(typography).toEqual({
      ...theme.typography,
      button: theme.typography.label
    });
  });
});
