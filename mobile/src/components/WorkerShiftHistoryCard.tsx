import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { WorkerShiftHistoryItem } from "../types/shifts";
import {
  formatDateTime,
  formatMoneyWithCurrencyLabel,
  formatMinutes
} from "../utils/format";
import {
  getAttendanceStatusPresentation,
  getPayCalculationStatusPresentation,
  getPaymentStatusPresentation,
  getShiftStatusPresentation,
  pauseStatusPresentation
} from "../utils/status";
import { theme } from "../utils/theme";
import { Button } from "./Button";
import { Card } from "./Card";
import { DetailRow } from "./DetailRow";
import { StatusBadge } from "./StatusBadge";

type WorkerShiftHistoryCardProps = {
  shift: WorkerShiftHistoryItem;
  onFullView: () => void;
};

function getActionContext(
  shift: WorkerShiftHistoryItem,
  shiftStatusLabel: string | undefined,
  attendanceStatusLabel: string
): string {
  const context = [shift.title, shift.companyName];

  if (shift.location) {
    context.push(shift.location);
  }
  if (shift.actualStartTime) {
    context.push(`started ${formatDateTime(shift.actualStartTime)}`);
  } else {
    context.push(shiftStatusLabel ?? attendanceStatusLabel);
  }

  return context.join(", ");
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  // Keep native icon loading on the rendered card path, not route registration.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppIcon } = require("./AppIcon") as typeof import("./AppIcon");
  return (
    <AppIcon
      name={expanded ? "chevronUp" : "chevronDown"}
      tone="secondary"
    />
  );
}

export function WorkerShiftHistoryCard({
  shift,
  onFullView
}: WorkerShiftHistoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const shiftStatus = getShiftStatusPresentation(shift.status);
  const attendanceStatus = getAttendanceStatusPresentation(shift.attendanceStatus);
  const isTerminalNonPayable =
    shift.status === "CANCELLED" ||
    shift.status === "DISCARDED" ||
    shift.attendanceStatus === "REJECTED" ||
    shift.attendanceStatus === "CANCELLED";
  const paymentStatus =
    !isTerminalNonPayable && shift.paymentStatus
      ? getPaymentStatusPresentation(shift.paymentStatus)
      : undefined;
  const calculationStatus =
    !isTerminalNonPayable && shift.payCalculation
      ? getPayCalculationStatusPresentation(shift.payCalculation.snapshotStatus)
      : undefined;
  const actionContext = getActionContext(
    shift,
    shiftStatus?.label,
    attendanceStatus.label
  );

  return (
    <Card testID={`worker-shift-history-card-${shift.attendanceId}`}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headingText}>
            <Text allowFontScaling style={styles.title}>
              {shift.title}
            </Text>
            <View style={styles.badges}>
              {shiftStatus ? (
                <StatusBadge label={shiftStatus.label} tone={shiftStatus.tone} />
              ) : null}
              <StatusBadge
                label={attendanceStatus.label}
                tone={attendanceStatus.tone}
              />
              {paymentStatus ? (
                <StatusBadge label={paymentStatus.label} tone={paymentStatus.tone} />
              ) : null}
              {!isTerminalNonPayable && shift.pauseState?.personallyPaused ? (
                <StatusBadge {...pauseStatusPresentation.personalActive} />
              ) : null}
              {!isTerminalNonPayable && shift.pauseState?.allPaused ? (
                <StatusBadge {...pauseStatusPresentation.crewActive} />
              ) : null}
              {calculationStatus ? (
                <StatusBadge
                  label={calculationStatus.label}
                  tone={calculationStatus.tone}
                />
              ) : null}
            </View>
          </View>
          <Pressable
            accessibilityLabel={`${expanded ? "Collapse" : "Expand"} details. ${actionContext}`}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            hitSlop={0}
            onPress={() => {
              setExpanded((current) => !current);
            }}
            style={({ pressed }) => [styles.chevron, pressed && styles.chevronPressed]}
            testID={`worker-shift-expand-${shift.attendanceId}`}
          >
            <ChevronIcon expanded={expanded} />
          </Pressable>
        </View>

        {expanded ? (
          <View
            style={styles.details}
            testID={`worker-shift-details-${shift.attendanceId}`}
          >
            <DetailRow label="Company" value={shift.companyName} />
            {shift.location ? <DetailRow label="Location" value={shift.location} /> : null}
            {shiftStatus ? (
              <DetailRow label="Shift status" value={shiftStatus.label} />
            ) : null}
            <DetailRow
              label="Attendance status"
              value={attendanceStatus.label}
            />
            {paymentStatus ? (
              <DetailRow label="Payment status" value={paymentStatus.label} />
            ) : null}
            {isTerminalNonPayable ? (
              <DetailRow label="Pay result" value="Not payable" />
            ) : null}
            {shift.actualStartTime ? (
              <DetailRow
                label="Actual start"
                value={formatDateTime(shift.actualStartTime)}
              />
            ) : null}
            {shift.actualEndTime ? (
              <DetailRow
                label="Actual end"
                value={formatDateTime(shift.actualEndTime)}
              />
            ) : null}
            {!isTerminalNonPayable && shift.payableStartTime ? (
              <DetailRow
                label="Payable start"
                value={formatDateTime(shift.payableStartTime)}
              />
            ) : null}
            <DetailRow label="Break" value={`${shift.breakMinutes} min`} />
            {!isTerminalNonPayable && shift.pauseMinutes != null ? (
              <DetailRow
                label="Pause time"
                value={formatMinutes(shift.pauseMinutes)}
              />
            ) : null}
            {!isTerminalNonPayable && shift.workedMinutes != null ? (
              <DetailRow
                label="Worked time"
                value={formatMinutes(shift.workedMinutes)}
              />
            ) : null}
            <DetailRow
              label="Hourly rate snapshot"
              value={formatMoneyWithCurrencyLabel(
                shift.hourlyRate,
                shift.currencyLabel
              )}
            />
            {!isTerminalNonPayable && shift.calculatedSalary != null ? (
              <DetailRow
                label="Calculated salary"
                value={formatMoneyWithCurrencyLabel(
                  shift.calculatedSalary,
                  shift.currencyLabel
                )}
              />
            ) : null}
            <DetailRow
              label="Currency label"
              value={shift.currencyLabel ?? "Unavailable"}
            />
            {!isTerminalNonPayable && shift.pauseState ? (
              <>
                <DetailRow
                  label="Personal pause"
                  value={shift.pauseState.personallyPaused ? "Active" : "Inactive"}
                />
                {shift.pauseState.personalPauseStartedAt ? (
                  <DetailRow
                    label="Personal pause started"
                    value={formatDateTime(shift.pauseState.personalPauseStartedAt)}
                  />
                ) : null}
                <DetailRow
                  label="Crew pause"
                  value={shift.pauseState.allPaused ? "Active" : "Inactive"}
                />
                {shift.pauseState.allPauseStartedAt ? (
                  <DetailRow
                    label="Crew pause started"
                    value={formatDateTime(shift.pauseState.allPauseStartedAt)}
                  />
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        <Button
          accessibilityLabel={`Full view. ${actionContext}`}
          label="Full view"
          onPress={onFullView}
          trailingIcon="forward"
          variant="secondary"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: theme.space[3]
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.space[3]
  },
  headingText: {
    alignItems: "flex-start",
    flex: 1,
    gap: theme.space[2]
  },
  title: {
    ...theme.typography.cardTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  badges: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space[2]
  },
  chevron: {
    alignItems: "center",
    borderRadius: theme.radius.sm,
    justifyContent: "center",
    minHeight: theme.target.min,
    minWidth: theme.target.min
  },
  chevronPressed: {
    backgroundColor: theme.colors.surface.subtle
  },
  details: {
    borderTopColor: theme.colors.border,
    borderTopWidth: theme.border.default,
    paddingTop: theme.space[2]
  }
});
