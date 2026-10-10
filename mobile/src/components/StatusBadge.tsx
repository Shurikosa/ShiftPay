import { StyleSheet, Text, View, type ViewProps } from "react-native";
import type { StatusTone } from "../utils/status";
import { theme } from "../utils/theme";

/** Temporary compile bridge for WorkerShiftCard until the deferred F5 adoption. */
type LegacyStatusTone = "primary";

export type StatusBadgeProps = Pick<
  ViewProps,
  "accessibilityHint" | "accessibilityLabel" | "nativeID" | "testID"
> & {
  label: string;
  tone?: StatusTone | LegacyStatusTone;
};

function normalizeAccessiblePart(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function containsEquivalentPart(context: string, label: string): boolean {
  const normalizedLabel = normalizeAccessiblePart(label);
  if (!normalizedLabel) {
    return false;
  }

  return [context, ...context.split(/[.!?…;:]+/u)].some(
    (part) => {
      const normalizedPart = normalizeAccessiblePart(part);
      return normalizedPart.length > 0 && normalizedPart === normalizedLabel;
    }
  );
}

function getAccessibleName(label: string, context?: unknown): string {
  const normalizedContext =
    typeof context === "string" ? context.trim() : undefined;

  if (!normalizedContext || containsEquivalentPart(normalizedContext, label)) {
    return normalizedContext || label;
  }

  const separator = /\p{P}$/u.test(normalizedContext) ? " " : ": ";
  return `${normalizedContext}${separator}${label}`;
}

const toneColors: Record<
  StatusTone,
  { backgroundColor: string; borderColor: string; color: string }
> = {
  neutral: {
    backgroundColor: theme.colors.surface.subtle,
    borderColor: theme.colors.border,
    color: theme.colors.ink.secondary
  },
  info: {
    backgroundColor: theme.colors.info.bg,
    borderColor: theme.colors.info.fg,
    color: theme.colors.info.fg
  },
  success: {
    backgroundColor: theme.colors.success.bg,
    borderColor: theme.colors.success.fg,
    color: theme.colors.success.fg
  },
  warning: {
    backgroundColor: theme.colors.warning.bg,
    borderColor: theme.colors.warning.fg,
    color: theme.colors.warning.fg
  },
  danger: {
    backgroundColor: theme.colors.danger.bg,
    borderColor: theme.colors.danger.fg,
    color: theme.colors.danger.fg
  }
};

function resolveTone(value: unknown): StatusTone {
  switch (value) {
    case "info":
    case "success":
    case "warning":
    case "danger":
    case "neutral":
      return value;
    case "primary":
      return "info";
    default:
      return "neutral";
  }
}

export function StatusBadge({
  label,
  tone = "neutral",
  accessibilityHint,
  accessibilityLabel,
  nativeID,
  testID
}: StatusBadgeProps) {
  if (typeof label !== "string" || label.trim().length === 0) {
    return null;
  }

  const visibleLabel = label.trim();
  const palette = toneColors[resolveTone(tone)];

  return (
    <View
      accessible
      accessibilityElementsHidden={false}
      accessibilityHint={
        typeof accessibilityHint === "string" ? accessibilityHint : undefined
      }
      accessibilityLabel={getAccessibleName(visibleLabel, accessibilityLabel)}
      accessibilityRole="text"
      aria-hidden={false}
      importantForAccessibility="yes"
      nativeID={typeof nativeID === "string" ? nativeID : undefined}
      style={[
        styles.badge,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor
        }
      ]}
      testID={typeof testID === "string" ? testID : undefined}
    >
      <Text allowFontScaling style={[styles.label, { color: palette.color }]}>
        {visibleLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexShrink: 1,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.default,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1]
  },
  label: {
    ...theme.typography.caption,
    flexShrink: 1
  }
});
