import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  createPayoutRequest,
  getMyPayoutRequests,
  getPayableAttendances,
  previewPayoutRequest
} from "../api/payroll";
import { Button } from "../components/Button";
import { DetailRow } from "../components/DetailRow";
import { PayoutRequestCard } from "../components/PayoutRequestCard";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import type { WorkerStackParamList } from "../types/navigation";
import type {
  PayableAttendance,
  PayoutRequest,
  PayoutRequestPreview
} from "../types/payroll";
import {
  formatDateTime,
  formatMinutes,
  formatMoney,
  formatOptionalLocation,
  formatRate,
  formatWholeMoney
} from "../utils/format";
import { getErrorMessage } from "../api/errors";
import {
  formatStatusLabel,
  getPaymentStatusTone,
  getPayoutRequestStatusTone
} from "../utils/status";
import { colors, radii, spacing, typography } from "../utils/theme";

type WorkerPayrollScreenProps = NativeStackScreenProps<
  WorkerStackParamList,
  "WorkerPayroll"
>;

type MutationName = "refresh" | "preview" | "create";

function doAttendanceIdsMatch(left: number[] | null, right: number[]): boolean {
  return (
    left !== null &&
    left.length === right.length &&
    left.every((attendanceId, index) => attendanceId === right[index])
  );
}

function formatPayrollError(error: unknown): string {
  const message = getErrorMessage(error);

  if (message.toLowerCase().includes("duplicate")) {
    return `${message}. Refreshing payroll data can clear stale selection.`;
  }

  if (
    message.toLowerCase().includes("already") ||
    message.toLowerCase().includes("not payable")
  ) {
    return `${message}. Refresh the list before trying again.`;
  }

  return message;
}

export function WorkerPayrollScreen({ navigation }: WorkerPayrollScreenProps) {
  const { authenticatedRequest, user } = useAuth();
  const [payableAttendances, setPayableAttendances] = useState<PayableAttendance[]>([]);
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [selectedAttendanceIds, setSelectedAttendanceIds] = useState<number[]>([]);
  const [preview, setPreview] = useState<PayoutRequestPreview | null>(null);
  const [previewAttendanceIds, setPreviewAttendanceIds] = useState<number[] | null>(null);
  const [createdRequest, setCreatedRequest] = useState<PayoutRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutation, setMutation] = useState<MutationName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const mutationInFlightRef = useRef(false);

  const selectedIds = useMemo(
    () => new Set(selectedAttendanceIds),
    [selectedAttendanceIds]
  );

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    setPreviewAttendanceIds(null);

    try {
      const [nextPayableAttendances, nextRequests] = await authenticatedRequest(
        async (token) =>
          Promise.all([getPayableAttendances(token), getMyPayoutRequests(token)])
      );
      setPayableAttendances(nextPayableAttendances);
      setRequests(nextRequests);
      setSelectedAttendanceIds((currentIds) => {
        const payableAttendanceIds = new Set(
          nextPayableAttendances.map((attendance) => attendance.attendanceId)
        );

        return currentIds.filter((attendanceId) =>
          payableAttendanceIds.has(attendanceId)
        );
      });
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest]);

  useFocusEffect(
    useCallback(() => {
      void loadPayroll();
      return undefined;
    }, [loadPayroll])
  );

  const beginMutation = (nextMutation: MutationName): boolean => {
    if (mutationInFlightRef.current) {
      return false;
    }

    mutationInFlightRef.current = true;
    setMutation(nextMutation);
    return true;
  };

  const finishMutation = () => {
    mutationInFlightRef.current = false;
    setMutation(null);
  };

  const handleRefresh = () => {
    if (!beginMutation("refresh")) {
      return;
    }

    setPreview(null);
    setCreatedRequest(null);
    setSuccessMessage(null);
    setPreviewAttendanceIds(null);

    void loadPayroll().finally(() => {
      finishMutation();
    });
  };

  const handleToggleAttendance = (attendanceId: number) => {
    setCreatedRequest(null);
    setSuccessMessage(null);
    setError(null);
    setPreview(null);
    setPreviewAttendanceIds(null);
    setSelectedAttendanceIds((currentIds) =>
      currentIds.includes(attendanceId)
        ? currentIds.filter((id) => id !== attendanceId)
        : [...currentIds, attendanceId]
    );
  };

  const handleClearSelection = () => {
    setSelectedAttendanceIds([]);
    setPreview(null);
    setPreviewAttendanceIds(null);
    setCreatedRequest(null);
    setSuccessMessage(null);
    setError(null);
  };

  const handlePreview = () => {
    if (loading) {
      setSuccessMessage(null);
      setPreview(null);
      setPreviewAttendanceIds(null);
      setError("Wait for payroll data to finish loading before previewing.");
      return;
    }

    if (selectedAttendanceIds.length === 0) {
      setSuccessMessage(null);
      setPreview(null);
      setPreviewAttendanceIds(null);
      setError("Select at least one unpaid attendance before previewing.");
      return;
    }

    if (!beginMutation("preview")) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    const previewIds = [...selectedAttendanceIds];

    void authenticatedRequest((token) =>
      previewPayoutRequest(token, { attendanceIds: previewIds })
    )
      .then((nextPreview) => {
        setPreview(nextPreview);
        setPreviewAttendanceIds(previewIds);
      })
      .catch((caughtError) => {
        setPreview(null);
        setPreviewAttendanceIds(null);
        setError(formatPayrollError(caughtError));
      })
      .finally(() => {
        finishMutation();
      });
  };

  const handleCreate = () => {
    if (loading) {
      setSuccessMessage(null);
      setError("Wait for payroll data to finish loading before creating a request.");
      return;
    }

    if (selectedAttendanceIds.length === 0) {
      setSuccessMessage(null);
      setError("Select at least one unpaid attendance before creating a request.");
      return;
    }

    if (!preview || !doAttendanceIdsMatch(previewAttendanceIds, selectedAttendanceIds)) {
      setSuccessMessage(null);
      setPreview(null);
      setPreviewAttendanceIds(null);
      setError("Preview the current payroll selection before creating a request.");
      return;
    }

    if (!beginMutation("create")) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    void authenticatedRequest((token) =>
      createPayoutRequest(token, { attendanceIds: selectedAttendanceIds })
    )
      .then((request) => {
        setCreatedRequest(request);
        setSuccessMessage("Payout request created.");
        setSelectedAttendanceIds([]);
        setPreview(null);
        setPreviewAttendanceIds(null);
        return loadPayroll();
      })
      .catch((caughtError) => {
        setError(formatPayrollError(caughtError));
      })
      .finally(() => {
        finishMutation();
      });
  };

  const isMutating = mutation !== null;
  const companyName = user?.company?.name ?? "Company not assigned";
  const previewMatchesSelection = doAttendanceIdsMatch(
    previewAttendanceIds,
    selectedAttendanceIds
  );

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Worker payroll</Text>
          <Text style={styles.title}>Payroll</Text>
          <Text style={styles.subtitle}>{companyName}</Text>
        </View>

        {successMessage ? (
          <StateMessage title="Updated" message={successMessage} tone="success" />
        ) : null}
        {error ? <StateMessage title="Payroll action failed" message={error} tone="error" /> : null}

        {createdRequest ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Created request</Text>
            <PayoutRequestCard request={createdRequest} />
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Unpaid work</Text>
            <Button
              disabled={isMutating || loading}
              label="Refresh"
              loading={mutation === "refresh"}
              onPress={handleRefresh}
              variant="ghost"
            />
          </View>

          {loading ? (
            <StateMessage loading title="Loading payroll" message="Fetching unpaid work." />
          ) : payableAttendances.length === 0 ? (
            <StateMessage
              title="No unpaid attendance"
              message="Closed approved unpaid work will appear here."
            />
          ) : (
            <View style={styles.list}>
              {payableAttendances.map((attendance) => {
                const selected = selectedIds.has(attendance.attendanceId);

                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    disabled={isMutating || loading}
                    key={attendance.attendanceId}
                    onPress={() => {
                      handleToggleAttendance(attendance.attendanceId);
                    }}
                    style={({ pressed }) => [
                      styles.attendanceCard,
                      selected && styles.selectedCard,
                      pressed && !isMutating && styles.pressed
                    ]}
                  >
                    <View style={styles.attendanceHeader}>
                      <View style={styles.checkbox}>
                        {selected ? <View style={styles.checkboxMark} /> : null}
                      </View>
                      <View style={styles.attendanceTitleBlock}>
                        <Text numberOfLines={2} style={styles.cardTitle}>
                          {attendance.title}
                        </Text>
                        <Text style={styles.cardSubtitle}>
                          {formatOptionalLocation(attendance.location)}
                        </Text>
                        <Text style={styles.cardSubtitle}>
                          {formatDateTime(attendance.actualEndTime)}
                        </Text>
                      </View>
                      <StatusBadge
                        label={formatStatusLabel(attendance.paymentStatus)}
                        tone={getPaymentStatusTone(attendance.paymentStatus)}
                      />
                    </View>

                    <View style={styles.compactRows}>
                      <DetailRow
                        label="Raw payable time"
                        value={formatMinutes(attendance.rawPayableMinutes)}
                      />
                      <DetailRow
                        label="Rounded payable time"
                        value={formatMinutes(attendance.payoutRoundedMinutes)}
                      />
                      <DetailRow label="Hourly rate" value={formatRate(attendance.hourlyRate)} />
                      <DetailRow
                        label="Exact calculated amount"
                        value={formatMoney(attendance.calculatedSalary)}
                      />
                      <DetailRow
                        label="Whole payout amount"
                        value={formatWholeMoney(attendance.payoutAmount)}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selected totals</Text>
          {selectedAttendanceIds.length === 0 ? (
            <StateMessage
              title="No selection"
              message="Select one or more unpaid work rows to preview backend totals."
            />
          ) : preview && previewMatchesSelection ? (
            <View style={styles.panel}>
              <DetailRow
                label="Raw payable time"
                value={formatMinutes(preview.rawPayableMinutes)}
              />
              <DetailRow
                label="Rounded payable time"
                value={formatMinutes(preview.payoutRoundedMinutes)}
              />
              <DetailRow
                label="Exact calculated amount"
                value={formatMoney(preview.exactCalculatedAmount)}
              />
              <DetailRow
                label="Whole payout amount"
                value={formatWholeMoney(preview.payoutAmount)}
              />
            </View>
          ) : (
            <StateMessage
              title="Preview required"
              message="Selected totals will appear after backend preview."
            />
          )}

          <View style={styles.actions}>
            <Button
              disabled={isMutating || loading || selectedAttendanceIds.length === 0}
              label="Preview"
              loading={mutation === "preview"}
              onPress={handlePreview}
              variant="secondary"
            />
            <Button
              disabled={
                isMutating ||
                loading ||
                selectedAttendanceIds.length === 0 ||
                !preview ||
                !previewMatchesSelection
              }
              label="Create payout request"
              loading={mutation === "create"}
              onPress={handleCreate}
            />
            {selectedAttendanceIds.length > 0 ? (
              <Button
                disabled={isMutating}
                label="Clear selection"
                onPress={handleClearSelection}
                variant="ghost"
              />
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Request history</Text>
          {loading ? (
            <StateMessage loading title="Loading requests" message="Fetching payout history." />
          ) : requests.length === 0 ? (
            <StateMessage
              title="No payout requests"
              message="Created payout requests will appear here."
            />
          ) : (
            <View style={styles.list}>
              {requests.map((request) => (
                <View key={request.id} style={styles.requestBlock}>
                  <View style={styles.requestStatus}>
                    <StatusBadge
                      label={formatStatusLabel(request.status)}
                      tone={getPayoutRequestStatusTone(request.status)}
                    />
                  </View>
                  <PayoutRequestCard request={request} />
                </View>
              ))}
            </View>
          )}
        </View>

        <Button
          label="Back to dashboard"
          onPress={() => {
            navigation.goBack();
          }}
          variant="ghost"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.xl
  },
  header: {
    gap: spacing.sm
  },
  kicker: {
    ...typography.label,
    color: colors.primary
  },
  title: {
    ...typography.screenTitle,
    color: colors.text
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary
  },
  section: {
    gap: spacing.md
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.text
  },
  list: {
    gap: spacing.md
  },
  attendanceCard: {
    gap: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: spacing.md
  },
  selectedCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  pressed: {
    opacity: 0.88
  },
  attendanceHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.white
  },
  checkboxMark: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: colors.primary
  },
  attendanceTitleBlock: {
    flex: 1,
    gap: spacing.xs
  },
  cardTitle: {
    ...typography.label,
    color: colors.text
  },
  cardSubtitle: {
    ...typography.caption,
    color: colors.textSecondary
  },
  compactRows: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm
  },
  panel: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md
  },
  actions: {
    gap: spacing.md
  },
  requestBlock: {
    gap: spacing.sm
  },
  requestStatus: {
    alignSelf: "flex-start"
  }
});
