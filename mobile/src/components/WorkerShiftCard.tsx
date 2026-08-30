import { Pressable, StyleSheet, Text, View } from "react-native";
import type { WorkerShiftHistoryItem } from "../types/shifts";
import {
  formatDateTime,
  formatMoney,
  formatMinutes,
  formatOptionalLocation
} from "../utils/format";
import { getWorkerPauseBadgeLabel } from "../utils/pauseDisplay";
import {
  formatStatusLabel,
  getAttendanceStatusTone,
  getPaymentStatusTone,
  getShiftStatusTone
} from "../utils/status";
import { colors, radii, spacing, typography } from "../utils/theme";
import { StatusBadge } from "./StatusBadge";

type WorkerShiftCardProps = {
  shift: WorkerShiftHistoryItem;
  onPress?: () => void;
};

export function WorkerShiftCard({ shift, onPress }: WorkerShiftCardProps) {
  const startTime = shift.actualStartTime ?? null;
  const payableStartTime = shift.payableStartTime ?? null;
  const approvalLabel =
    shift.attendanceStatus === "JOINED" ? "Waiting for foreman approval" : null;
  const pauseBadgeLabel = getWorkerPauseBadgeLabel(shift.pauseState);
  const salaryLabel =
    shift.calculatedSalary === null ? "Salary pending" : `Salary ${formatMoney(shift.calculatedSalary)}`;
  const workedLabel =
    shift.workedMinutes === null ? "Worked time pending" : `Worked ${formatMinutes(shift.workedMinutes)}`;

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
          {shift.paymentStatus ? (
            <StatusBadge
              label={formatStatusLabel(shift.paymentStatus)}
              tone={getPaymentStatusTone(shift.paymentStatus)}
            />
          ) : null}
          {pauseBadgeLabel ? (
            <StatusBadge label={pauseBadgeLabel} tone="warning" />
          ) : null}
        </View>
      </View>

      <Text style={styles.time}>
        {startTime ? formatDateTime(startTime) : "Not started yet"}
      </Text>

      <View style={styles.metaRow}>
        <StatusBadge
          label={shift.attendanceStatus}
          tone={getAttendanceStatusTone(shift.attendanceStatus)}
        />
        <View style={styles.numbers}>
          {approvalLabel ? <Text style={styles.metaText}>{approvalLabel}</Text> : null}
          {payableStartTime ? (
            <Text style={styles.metaText}>
              Pay starts {formatDateTime(payableStartTime)}
            </Text>
          ) : null}
          <Text style={styles.metaText}>{workedLabel}</Text>
          <Text style={styles.metaText}>{salaryLabel}</Text>
          {shift.paidAt ? (
            <Text style={styles.metaText}>Paid {formatDateTime(shift.paidAt)}</Text>
          ) : null}
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
  time: {
    ...typography.caption,
    color: colors.textSecondary
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  numbers: {
    flex: 1,
    gap: spacing.xs
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary
  }
});
