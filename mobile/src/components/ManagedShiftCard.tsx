import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ManagedShift } from "../types/shifts";
import { formatDateTime, formatRate } from "../utils/format";
import { getShiftStatusTone } from "../utils/status";
import { colors, radii, spacing, typography } from "../utils/theme";
import { StatusBadge } from "./StatusBadge";

type ManagedShiftCardProps = {
  shift: ManagedShift;
  onPress?: () => void;
};

export function ManagedShiftCard({ shift, onPress }: ManagedShiftCardProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && Boolean(onPress) && styles.pressed
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text numberOfLines={2} style={styles.title}>
            {shift.title}
          </Text>
          <Text numberOfLines={1} style={styles.location}>
            {shift.location}
          </Text>
        </View>
        <StatusBadge label={shift.status} tone={getShiftStatusTone(shift.status)} />
      </View>

      <View style={styles.metaGrid}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Planned start</Text>
          <Text style={styles.metaValue}>{formatDateTime(shift.plannedStartTime)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Join code</Text>
          <Text style={styles.metaValue}>{shift.joinCode}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Default rate</Text>
          <Text style={styles.metaValue}>{formatRate(shift.defaultHourlyRate)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: spacing.md
  },
  pressed: {
    opacity: 0.88
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs
  },
  title: {
    ...typography.label,
    color: colors.text
  },
  location: {
    ...typography.caption,
    color: colors.textSecondary
  },
  metaGrid: {
    gap: spacing.sm
  },
  metaItem: {
    gap: spacing.xs
  },
  metaLabel: {
    ...typography.caption,
    color: colors.textMuted
  },
  metaValue: {
    ...typography.caption,
    color: colors.textSecondary
  }
});
