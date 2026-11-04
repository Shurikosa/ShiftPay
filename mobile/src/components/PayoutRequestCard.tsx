import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { PayoutRequest } from "../types/payroll";
import {
  formatDateTime,
  formatMinutes,
  formatWholeMoneyWithCurrencyLabel
} from "../utils/format";
import {
  getPaymentStatusPresentation,
  getPayoutRequestStatusPresentation
} from "../utils/status";
import { theme } from "../utils/theme";
import { Card } from "./Card";
import { DetailRow } from "./DetailRow";
import { StatusBadge } from "./StatusBadge";

type PayoutRequestCardProps = {
  request: PayoutRequest;
  action?: ReactNode;
  showWorker?: boolean;
  timeZone?: string | null;
};

export function PayoutRequestCard({
  request,
  action,
  showWorker = false,
  timeZone
}: PayoutRequestCardProps) {
  const requestStatus = getPayoutRequestStatusPresentation(request.status);

  return (
    <Card testID={`payout-request-${request.id}`}>
      <View style={styles.cardContent}>
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
            label={requestStatus.label}
            tone={requestStatus.tone}
          />
        </View>

        <View style={styles.panel}>
          <DetailRow
            label="Requested"
            value={formatDateTime(request.requestedAt, timeZone)}
          />
          {request.approvedAt ? (
            <DetailRow
              label="Approved"
              value={formatDateTime(request.approvedAt, timeZone)}
            />
          ) : null}
          {request.paidAt ? (
            <DetailRow
              label="Paid"
              value={formatDateTime(request.paidAt, timeZone)}
            />
          ) : null}
          <DetailRow
            label="Raw payable time"
            value={formatMinutes(request.rawPayableMinutes)}
          />
          <DetailRow
            label="Final payout amount"
            value={formatWholeMoneyWithCurrencyLabel(
              request.payoutAmount,
              request.currencyLabel
            )}
          />
        </View>

        <View style={styles.items}>
          <Text style={styles.itemsTitle}>Selected work</Text>
          {request.items.map((item) => {
            const paymentStatus = getPaymentStatusPresentation(item.paymentStatus);

            return (
              <View key={`${request.id}-${item.attendanceId}`} style={styles.item}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemTitleBlock}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    {item.actualEndTime ? (
                      <Text style={styles.itemSubtitle}>
                        {formatDateTime(item.actualEndTime, timeZone)}
                      </Text>
                    ) : null}
                  </View>
                  <StatusBadge
                    label={paymentStatus.label}
                    tone={paymentStatus.tone}
                  />
                </View>
                <View style={styles.compactRows}>
                  <DetailRow
                    label="Raw time"
                    value={formatMinutes(item.rawPayableMinutes)}
                  />
                  <DetailRow
                    label="Final payout"
                    value={formatWholeMoneyWithCurrencyLabel(
                      item.payoutAmount,
                      request.currencyLabel
                    )}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardContent: {
    gap: theme.space[3]
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: theme.space[3]
  },
  titleBlock: {
    flex: 1,
    gap: theme.space[1]
  },
  title: {
    ...theme.typography.label,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  subtitle: {
    ...theme.typography.caption,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  panel: {
    borderTopWidth: theme.border.default,
    borderTopColor: theme.colors.border,
    paddingTop: theme.space[2]
  },
  items: {
    gap: theme.space[2]
  },
  itemsTitle: {
    ...theme.typography.label,
    color: theme.colors.ink.primary
  },
  item: {
    gap: theme.space[2],
    borderRadius: theme.radius.md,
    borderWidth: theme.border.default,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface.subtle,
    padding: theme.space[3]
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: theme.space[3]
  },
  itemTitleBlock: {
    flex: 1,
    gap: theme.space[1]
  },
  itemTitle: {
    ...theme.typography.label,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  itemSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  compactRows: {
    borderTopWidth: theme.border.default,
    borderTopColor: theme.colors.border,
    paddingTop: theme.space[2]
  },
  action: {
    paddingTop: theme.space[1]
  }
});
