import { StyleSheet, Text, View } from "react-native";
import type { WorkerShiftHistoryItem } from "../types/shifts";
import {
  formatDateTime,
  formatMoneyWithCurrencyLabel,
  formatMinutes,
  formatOptionalLocation
} from "../utils/format";
import {
  getAttendanceStatusPresentation,
  getPayCalculationStatusPresentation,
  getPaymentStatusPresentation,
  getShiftStatusPresentation,
  pauseStatusPresentation,
  type StatusPresentation
} from "../utils/status";
import { theme } from "../utils/theme";
import type { AppIconName, AppIconProps } from "./AppIcon";
import { Card } from "./Card";
import { StatusBadge } from "./StatusBadge";

type WorkerShiftCardProps = {
  shift: WorkerShiftHistoryItem;
  onPress?: () => void;
};

type MetadataRowProps = {
  icon: AppIconName;
  text: string;
};

type MetadataRowValue = MetadataRowProps & {
  key: string;
};

function SemanticIcon(props: AppIconProps) {
  // Keep native icon loading on rendered card paths, not module import.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppIcon } = require("./AppIcon") as typeof import("./AppIcon");
  return <AppIcon {...props} />;
}

function MetadataRow({ icon, text }: MetadataRowProps) {
  return (
    <View style={styles.metadataRow}>
      <SemanticIcon name={icon} size="metadata" tone="muted" />
      <Text allowFontScaling style={styles.metadataText}>
        {text}
      </Text>
    </View>
  );
}

function Status({ presentation }: { presentation?: StatusPresentation }) {
  return presentation ? (
    <StatusBadge label={presentation.label} tone={presentation.tone} />
  ) : null;
}

function accessibilityAnnouncement(parts: readonly string[]): string {
  return parts
    .map((part) => (/[.!?…]$/u.test(part) ? part : `${part}.`))
    .join(" ");
}

export function WorkerShiftCard({ shift, onPress }: WorkerShiftCardProps) {
  const isDiscarded = shift.status === "DISCARDED";
  const location = formatOptionalLocation(shift.location);
  const shiftStatus = getShiftStatusPresentation(shift.status);
  const attendanceStatus = getAttendanceStatusPresentation(shift.attendanceStatus);
  const paymentStatus =
    !isDiscarded && shift.paymentStatus
      ? getPaymentStatusPresentation(shift.paymentStatus)
      : undefined;
  const calculationStatus =
    !isDiscarded && shift.payCalculation
      ? getPayCalculationStatusPresentation(shift.payCalculation.snapshotStatus)
      : undefined;
  const statusPresentations = [
    shiftStatus,
    attendanceStatus,
    paymentStatus,
    shift.pauseState?.personallyPaused
      ? pauseStatusPresentation.personalActive
      : undefined,
    shift.pauseState?.allPaused
      ? pauseStatusPresentation.crewActive
      : undefined,
    calculationStatus
  ].filter((presentation): presentation is StatusPresentation => presentation !== undefined);
  const startText = shift.actualStartTime
    ? `Started ${formatDateTime(shift.actualStartTime)}`
    : "Start time pending";
  const detailMetadata: MetadataRowValue[] = isDiscarded
    ? [
        { icon: "calendar", key: "start", text: startText },
        {
          icon: "warning",
          key: "discarded",
          text: "Discarded short shift. No payroll."
        }
      ]
    : [
        { icon: "calendar", key: "start", text: startText },
        ...(shift.payableStartTime
          ? [
              {
                icon: "time" as const,
                key: "payable-start",
                text: `Pay starts ${formatDateTime(shift.payableStartTime)}`
              }
            ]
          : []),
        {
          icon: "time",
          key: "worked",
          text:
            shift.workedMinutes === null || shift.workedMinutes === undefined
              ? "Worked time pending"
              : `Worked ${formatMinutes(shift.workedMinutes)}`
        },
        {
          icon: "wallet",
          key: "salary",
          text:
            shift.calculatedSalary === null ||
            shift.calculatedSalary === undefined
              ? "Salary pending"
              : `Salary ${formatMoneyWithCurrencyLabel(
                  shift.calculatedSalary,
                  shift.currencyLabel
                )}`
        },
        ...(shift.paidAt
          ? [
              {
                icon: "success" as const,
                key: "paid",
                text: `Paid ${formatDateTime(shift.paidAt)}`
              }
            ]
          : [])
      ];
  const metadata: MetadataRowValue[] = [
    { icon: "company", key: "company", text: shift.companyName },
    { icon: "location", key: "location", text: location },
    ...detailMetadata
  ];
  const accessibleName = accessibilityAnnouncement([
    "View shift details",
    shift.title,
    shift.companyName,
    location,
    ...statusPresentations.map((presentation) => presentation.label),
    ...detailMetadata.map((item) => item.text)
  ]);

  const content = (
    <View
      accessibilityElementsHidden={onPress ? true : undefined}
      accessible={onPress ? false : undefined}
      aria-hidden={onPress ? true : undefined}
      importantForAccessibility={onPress ? "no-hide-descendants" : undefined}
      style={styles.content}
    >
      <View style={styles.heading}>
        <Text allowFontScaling style={styles.title}>
          {shift.title}
        </Text>
        <View style={styles.badges}>
          {statusPresentations.map((presentation) => (
            <Status key={presentation.label} presentation={presentation} />
          ))}
        </View>
      </View>

      <View style={styles.metadata}>
        {metadata.map((item) => (
          <MetadataRow icon={item.icon} key={item.key} text={item.text} />
        ))}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Card
        accessibilityHint="Opens this shift's worker details."
        accessibilityLabel={accessibleName}
        onPress={onPress}
        testID={`worker-shift-card-${shift.attendanceId}`}
      >
        {content}
      </Card>
    );
  }

  return <Card testID={`worker-shift-card-${shift.attendanceId}`}>{content}</Card>;
}

const styles = StyleSheet.create({
  content: {
    flexShrink: 1,
    gap: theme.space[3],
    maxWidth: "100%"
  },
  heading: {
    flexShrink: 1,
    gap: theme.space[2],
    maxWidth: "100%"
  },
  title: {
    ...theme.typography.cardTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  badges: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexShrink: 1,
    flexWrap: "wrap",
    gap: theme.space[2],
    maxWidth: "100%"
  },
  metadata: {
    flexShrink: 1,
    gap: theme.space[2],
    maxWidth: "100%"
  },
  metadataRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexShrink: 1,
    gap: theme.space[2],
    maxWidth: "100%"
  },
  metadataText: {
    ...theme.typography.supporting,
    color: theme.colors.ink.secondary,
    flex: 1,
    flexShrink: 1
  }
});
