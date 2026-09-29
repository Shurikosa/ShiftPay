import { StyleSheet, Text, View, type ViewProps } from "react-native";
import type { StatusTone } from "../utils/status";
import { theme } from "../utils/theme";

export type StatusBadgeProps = Pick<
  ViewProps,
  "accessibilityHint" | "accessibilityLabel" | "nativeID" | "testID"
> & {
  label: string;
  tone?: StatusTone;
};

function getAccessibleName(label: string, context?: string): string {
  const normalizedContext = context?.trim();

  if (!normalizedContext || normalizedContext.includes(label)) {
    return normalizedContext || label;
  }

  return `${normalizedContext}: ${label}`;
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
  primary: {
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
  error: {
    backgroundColor: theme.colors.danger.bg,
    borderColor: theme.colors.danger.fg,
    color: theme.colors.danger.fg
  }
};

export function StatusBadge({
  label,
  tone = "neutral",
  accessibilityHint,
  accessibilityLabel,
  nativeID,
  testID
}: StatusBadgeProps) {
  const palette = toneColors[tone];

  return (
    <View
      accessible
      accessibilityHint={accessibilityHint}
      accessibilityLabel={getAccessibleName(label, accessibilityLabel)}
      accessibilityRole="text"
      nativeID={nativeID}
      style={[
        styles.badge,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor
        }
      ]}
      testID={testID}
    >
      <Text allowFontScaling style={[styles.label, { color: palette.color }]}>
        {label}
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
