import { StyleSheet, Text, View } from "react-native";
import type { PayCalculation, PaySegment } from "../types/payCalculation";
import { formatAuditDecimal, formatDateTime, formatMinutes } from "../utils/format";
import { formatStatusLabel } from "../utils/status";
import { colors, radii, spacing, typography } from "../utils/theme";
import { DetailRow } from "./DetailRow";
import { StateMessage } from "./StateMessage";

type PayCalculationBreakdownProps = {
  calculation: PayCalculation;
};

function formatSeconds(value: number): string {
  return `${value} sec`;
}

function formatExactMinutes(value: number): string {
  return `${formatAuditDecimal(value)} min`;
}

function formatPercentage(value: number): string {
  return `${formatAuditDecimal(value)}%`;
}

function SegmentRules({ segment }: { segment: PaySegment }) {
  if (segment.snapshotStatus === "UNAVAILABLE") {
    return (
      <StateMessage
        title="Breakdown details unavailable"
        message="Applied rule snapshots are unavailable for this segment. Returned audit values are shown without interpreting rule data."
      />
    );
  }

  if (segment.appliedRules.length === 0) {
    return (
      <StateMessage
        title="No premium rules applied"
        message="The complete backend snapshot recorded no applied premium rules for this segment."
      />
    );
  }

  return (
    <View style={styles.ruleList}>
      <Text style={styles.ruleListTitle}>Applied premium rules</Text>
      {segment.appliedRules.map((rule) => (
        <View key={rule.id} style={styles.ruleCard}>
          <Text style={styles.ruleName}>{rule.name}</Text>
          <DetailRow label="Rule type" value={formatStatusLabel(rule.type)} />
          <DetailRow
            label="Configured premium"
            value={formatPercentage(rule.premiumPercent)}
          />
        </View>
      ))}
    </View>
  );
}

export function PayCalculationBreakdown({
  calculation
}: PayCalculationBreakdownProps) {
  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>Pay breakdown</Text>
        <Text style={styles.subtitle}>
          Backend calculation details. Audit amounts are separate from the stored
          calculated salary.
        </Text>
      </View>

      {calculation.snapshotStatus === "UNAVAILABLE" ? (
        <StateMessage
          title="Breakdown details unavailable"
          message="The calculation snapshot is incomplete. Returned durations and audit amounts are shown without recalculating them."
        />
      ) : null}

      <View style={styles.panel}>
        <DetailRow label="Calculation snapshot status" value={calculation.snapshotStatus} />
        <DetailRow
          label="Total payable seconds"
          value={formatSeconds(calculation.totalRawSeconds)}
        />
        <DetailRow
          label="Exact payable minutes"
          value={formatExactMinutes(calculation.totalRawMinutesExact)}
        />
        <DetailRow
          label="Total base amount (audit)"
          value={formatAuditDecimal(calculation.totalBaseAmount)}
        />
        <DetailRow
          label="Total premium amount (audit)"
          value={formatAuditDecimal(calculation.totalPremiumAmount)}
        />
        <DetailRow
          label="Total amount (audit)"
          value={formatAuditDecimal(calculation.totalAmount)}
        />
      </View>

      <View style={styles.segmentList}>
        {calculation.segments.map((segment, index) => (
          <View
            key={`${segment.start}-${segment.end}-${index}`}
            style={styles.segmentCard}
          >
            <Text style={styles.segmentTitle}>{`Segment ${index + 1}`}</Text>
            <DetailRow label="Snapshot status" value={segment.snapshotStatus} />
            <DetailRow label="Start" value={formatDateTime(segment.start)} />
            <DetailRow label="End" value={formatDateTime(segment.end)} />
            <DetailRow
              label="Payable seconds"
              value={formatSeconds(segment.payableSeconds)}
            />
            <DetailRow
              label="Exact payable minutes"
              value={formatExactMinutes(segment.payableMinutesExact)}
            />
            <DetailRow
              label="Display payable time"
              value={formatMinutes(segment.payableMinutes)}
            />
            <DetailRow
              label="Base hourly rate"
              value={formatAuditDecimal(segment.baseHourlyRate)}
            />
            <DetailRow
              label="Stacking strategy"
              value={formatStatusLabel(segment.stackingStrategy)}
            />
            <DetailRow
              label="Effective premium"
              value={formatPercentage(segment.effectivePremiumPercent)}
            />
            <DetailRow
              label="Effective hourly rate"
              value={formatAuditDecimal(segment.effectiveHourlyRate)}
            />
            <DetailRow
              label="Base amount (audit)"
              value={formatAuditDecimal(segment.baseAmount)}
            />
            <DetailRow
              label="Premium amount (audit)"
              value={formatAuditDecimal(segment.premiumAmount)}
            />
            <DetailRow
              label="Total amount (audit)"
              value={formatAuditDecimal(segment.totalAmount)}
            />
            <SegmentRules segment={segment} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md
  },
  heading: {
    gap: spacing.xs
  },
  title: {
    ...typography.sectionTitle,
    color: colors.text
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary
  },
  panel: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md
  },
  segmentList: {
    gap: spacing.md
  },
  segmentCard: {
    gap: spacing.xs,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: spacing.md
  },
  segmentTitle: {
    ...typography.label,
    color: colors.primary
  },
  ruleList: {
    gap: spacing.sm,
    paddingTop: spacing.sm
  },
  ruleListTitle: {
    ...typography.label,
    color: colors.text
  },
  ruleCard: {
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm
  },
  ruleName: {
    ...typography.label,
    color: colors.text,
    paddingTop: spacing.sm
  }
});
