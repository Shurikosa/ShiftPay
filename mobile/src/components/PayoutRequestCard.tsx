import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { PayoutRequest } from "../types/payroll";
import {
  formatDateTime,
  formatMinutes,
  formatMoney,
  formatWholeMoney
} from "../utils/format";
import {
  formatStatusLabel,
  getPaymentStatusTone,
  getPayoutRequestStatusTone
} from "../utils/status";
import { colors, radii, spacing, typography } from "../utils/theme";
import { DetailRow } from "./DetailRow";
import { StatusBadge } from "./StatusBadge";

type PayoutRequestCardProps = {
  request: PayoutRequest;
  action?: ReactNode;
  showWorker?: boolean;
};

export function PayoutRequestCard({
  request,
  action,
  showWorker = false
}: PayoutRequestCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Request #{request.id}</Text>
          {showWorker ? (
            <Text style={styles.subtitle}>
              {request.workerFirstName} {request.workerLastName}
            </Text>
          ) : (
            <Text style={styles.subtitle}>{request.companyName}</Text>
          )}
        </View>
        <StatusBadge
          label={formatStatusLabel(request.status)}
          tone={getPayoutRequestStatusTone(request.status)}
        />
      </View>

      <View style={styles.panel}>
        <DetailRow label="Requested" value={formatDateTime(request.requestedAt)} />
        <DetailRow label="Approved" value={formatDateTime(request.approvedAt)} />
        <DetailRow label="Paid" value={formatDateTime(request.paidAt)} />
        <DetailRow
          label="Raw payable time"
          value={formatMinutes(request.rawPayableMinutes)}
        />
        <DetailRow
          label="Rounded payable time"
          value={formatMinutes(request.payoutRoundedMinutes)}
        />
        <DetailRow
          label="Exact calculated amount"
          value={formatMoney(request.exactCalculatedAmount)}
        />
        <DetailRow
          label="Whole payout amount"
          value={formatWholeMoney(request.payoutAmount)}
        />
      </View>

      <View style={styles.items}>
        <Text style={styles.itemsTitle}>Selected work</Text>
        {request.items.map((item) => (
          <View key={`${request.id}-${item.attendanceId}`} style={styles.item}>
            <View style={styles.itemHeader}>
              <View style={styles.itemTitleBlock}>
                <Text numberOfLines={2} style={styles.itemTitle}>
                  {item.title}
                </Text>
                <Text style={styles.itemSubtitle}>
                  {formatDateTime(item.actualEndTime)}
                </Text>
              </View>
              <StatusBadge
                label={formatStatusLabel(item.paymentStatus)}
                tone={getPaymentStatusTone(item.paymentStatus)}
              />
            </View>
            <View style={styles.compactRows}>
              <DetailRow
                label="Raw time"
                value={formatMinutes(item.rawPayableMinutes)}
              />
              <DetailRow
                label="Rounded time"
                value={formatMinutes(item.payoutRoundedMinutes)}
              />
              <DetailRow
                label="Exact amount"
                value={formatMoney(item.calculatedSalary)}
              />
              <DetailRow
                label="Payout"
                value={formatWholeMoney(item.payoutAmount)}
              />
            </View>
          </View>
        ))}
      </View>

      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
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
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary
  },
  panel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm
  },
  items: {
    gap: spacing.sm
  },
  itemsTitle: {
    ...typography.label,
    color: colors.text
  },
  item: {
    gap: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  itemTitleBlock: {
    flex: 1,
    gap: spacing.xs
  },
  itemTitle: {
    ...typography.label,
    color: colors.text
  },
  itemSubtitle: {
    ...typography.caption,
    color: colors.textSecondary
  },
  compactRows: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm
  },
  action: {
    paddingTop: spacing.xs
  }
});
