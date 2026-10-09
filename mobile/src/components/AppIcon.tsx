import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { theme } from "../utils/theme";

type IoniconsName = ComponentProps<typeof Ionicons>["name"];

const iconGlyphs = {
  email: "mail-outline",
  password: "lock-closed-outline",
  visibilityOn: "eye-outline",
  visibilityOff: "eye-off-outline",
  person: "person-outline",
  role: "id-card-outline",
  company: "business-outline",
  calendar: "calendar-outline",
  date: "calendar-outline",
  time: "time-outline",
  location: "location-outline",
  wallet: "wallet-outline",
  payroll: "wallet-outline",
  document: "document-text-outline",
  rules: "document-text-outline",
  join: "enter-outline",
  code: "qr-code-outline",
  scan: "scan-outline",
  add: "add-outline",
  create: "create-outline",
  back: "arrow-back-outline",
  forward: "arrow-forward-outline",
  refresh: "refresh-outline",
  settings: "settings-outline",
  logout: "log-out-outline",
  success: "checkmark-circle-outline",
  info: "information-circle-outline",
  warning: "warning-outline",
  error: "alert-circle-outline",
  play: "play-outline",
  pause: "pause-outline",
  stop: "stop-outline"
} as const satisfies Record<string, IoniconsName>;

const iconColors = {
  primary: theme.colors.ink.primary,
  secondary: theme.colors.ink.secondary,
  muted: theme.colors.ink.muted,
  brand: theme.colors.brand.primary,
  success: theme.colors.success.fg,
  info: theme.colors.info.fg,
  warning: theme.colors.warning.fg,
  error: theme.colors.danger.fg,
  inverse: theme.colors.surface.default
} as const;

export type AppIconName = keyof typeof iconGlyphs;
export type AppIconSize = keyof typeof theme.icon.size;
export type AppIconTone = keyof typeof iconColors;

export type AppIconProps = {
  name: AppIconName;
  size?: AppIconSize;
  tone?: AppIconTone;
  accessibilityLabel?: string;
};

export function AppIcon({
  accessibilityLabel,
  name,
  size = "control",
  tone = "primary"
}: AppIconProps) {
  const informativeLabel = accessibilityLabel?.trim() || undefined;
  const informative = informativeLabel !== undefined;

  return (
    <Ionicons
      accessibilityElementsHidden={!informative}
      accessibilityLabel={informativeLabel}
      accessibilityRole={informative ? "image" : undefined}
      accessible={informative}
      aria-hidden={!informative}
      color={iconColors[tone]}
      importantForAccessibility={informative ? "yes" : "no-hide-descendants"}
      name={iconGlyphs[name]}
      size={theme.icon.size[size]}
    />
  );
}
