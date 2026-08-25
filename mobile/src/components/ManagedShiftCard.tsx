import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ManagedShift } from "../types/shifts";
import { formatDateTime, formatOptionalLocation, formatRate } from "../utils/format";
import { isPaused } from "../utils/pauseDisplay";
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
            {formatOptionalLocation(shift.location)}
          </Text>
          <Text numberOfLines={1} style={styles.company}>
            {shift.companyName}
          </Text>
        </View>
        <View style={styles.badges}>
          <StatusBadge label={shift.status} tone={getShiftStatusTone(shift.status)} />
          {isPaused(shift.pauseState) ? (
            <StatusBadge label="PAUSED" tone="warning" />
          ) : null}
        </View>
      </View>

      <View style={styles.metaGrid}>
        {shift.actualStartTime ? (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Actual start</Text>
            <Text style={styles.metaValue}>{formatDateTime(shift.actualStartTime)}</Text>
          </View>
        ) : null}
        {shift.actualEndTime ? (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Actual end</Text>
            <Text style={styles.metaValue}>{formatDateTime(shift.actualEndTime)}</Text>
          </View>
        ) : null}
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Join code</Text>
          <Text style={styles.metaValue}>{shift.joinCode}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Default rate</Text>
          <Text style={styles.metaValue}>{formatRate(shift.defaultHourlyRate)}</Text>
        </View>
        {shift.foremanHourlyRate !== undefined ? (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Foreman rate</Text>
            <Text style={styles.metaValue}>{formatRate(shift.foremanHourlyRate)}</Text>
          </View>
        ) : null}
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
  badges: {
    alignItems: "flex-end",
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
  company: {
    ...typography.caption,
    color: colors.textMuted
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
