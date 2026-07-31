import { StyleSheet, Text, View } from "react-native";
import type { StatusTone } from "../utils/status";
import { colors, radii, spacing, typography } from "../utils/theme";

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
};

const toneColors: Record<
  StatusTone,
  { backgroundColor: string; borderColor: string; color: string }
> = {
  neutral: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    color: colors.textSecondary
  },
  primary: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    color: colors.primary
  },
  success: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
    color: colors.success
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
    color: colors.warning
  },
  error: {
    backgroundColor: colors.errorSoft,
    borderColor: colors.error,
    color: colors.error
  }
};

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  const palette = toneColors[tone];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor
        }
      ]}
    >
      <Text style={[styles.label, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radii.control,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  label: {
    ...typography.caption,
    fontWeight: "700"
  }
});
