import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { endMyPause, startMyPause } from "../api/shifts";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { DetailRow } from "../components/DetailRow";
import { Feedback } from "../components/Feedback";
import { PayCalculationBreakdown } from "../components/PayCalculationBreakdown";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useWorkerShiftHistory } from "../hooks/useWorkerShiftHistory";
import type { WorkerStackParamList } from "../types/navigation";
import type { WorkerShiftHistoryItem } from "../types/shifts";
import {
  formatDateTime,
  formatMoneyWithCurrencyLabel,
  formatMinutes,
  formatRate
} from "../utils/format";
import {
  allPauseActiveMessage,
  formatPauseMinutes,
  getPauseActionErrorMessage,
  missingPauseStateMessage
} from "../utils/pauseDisplay";
import {
  getAttendanceStatusPresentation,
  getAttendanceStatusTone,
  getPaymentStatusPresentation,
  getPaymentStatusTone,
  getShiftStatusPresentation,
  getShiftStatusTone
} from "../utils/status";
import { theme } from "../utils/theme";

type WorkerShiftDetailsScreenProps = NativeStackScreenProps<
  WorkerStackParamList,
  "WorkerShiftDetails"
>;

type MutationName = "pause-self" | "refresh";
type ErrorAction = "pause-self" | "refresh";
type PublishedShift = {
  routeSnapshot: WorkerShiftHistoryItem;
  value: WorkerShiftHistoryItem;
};

function formatRateWithCurrencyLabel(
  value: number,
  currencyLabel: string | null
): string {
  return currencyLabel
    ? `${formatRate(value)} ${currencyLabel}`
    : `${formatRate(value)} · currency unavailable`;
}

function ReturnedMetric({
  label,
  value,
  testID
}: {
  label: string;
  value: string;
  testID?: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      accessibilityRole="text"
      style={styles.metric}
      testID={testID}
    >
      <Text allowFontScaling style={styles.metricLabel}>
        {label}
      </Text>
      <Text allowFontScaling style={styles.metricValue}>
        {value}
      </Text>
    </View>
  );
}

function findMatchingShift(
  shifts: WorkerShiftHistoryItem[],
  identity: { shiftId: number; attendanceId: number }
): WorkerShiftHistoryItem | undefined {
  return shifts.find(
    (item) =>
      item.shiftId === identity.shiftId &&
      item.attendanceId === identity.attendanceId
  );
}

export function WorkerShiftDetailsScreen({
  navigation,
  route
}: WorkerShiftDetailsScreenProps) {
  const { authenticatedRequest, user } = useAuth();
  const { refresh } = useWorkerShiftHistory({ loadOnFocus: false });
  const [publishedShift, setPublishedShift] = useState<PublishedShift>(() => ({
    routeSnapshot: route.params.shift,
    value: route.params.shift
  }));
  const [mutation, setMutation] = useState<MutationName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<ErrorAction | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pauseStateNeedsRefresh, setPauseStateNeedsRefresh] = useState(false);
  const mountedRef = useRef(true);
  const canAccess =
    user?.role === "WORKER" &&
    user.company !== null &&
    user.company.id === route.params.shift.companyId;
  const canAccessRef = useRef(canAccess);
  const mutationInFlightRef = useRef(false);
  const pauseStateNeedsRefreshRef = useRef(false);
  const operationSequenceRef = useRef(0);
  const identityRef = useRef({
    shiftId: route.params.shift.shiftId,
    attendanceId: route.params.shift.attendanceId
  });
  const latestRouteSnapshotRef = useRef(route.params.shift);
  const shift =
    publishedShift.routeSnapshot === route.params.shift
      ? publishedShift.value
      : route.params.shift;

  useLayoutEffect(() => {
    latestRouteSnapshotRef.current = route.params.shift;
  }, [route.params.shift]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      mutationInFlightRef.current = false;
      operationSequenceRef.current += 1;
    };
  }, []);

  useEffect(() => {
    canAccessRef.current = canAccess;
    if (!canAccess) {
      mutationInFlightRef.current = false;
      operationSequenceRef.current += 1;
    }
  }, [canAccess]);

  const isCurrentOperation = (operation: number): boolean =>
    mountedRef.current &&
    canAccessRef.current &&
    operationSequenceRef.current === operation;

  const beginMutation = (nextMutation: MutationName): number | null => {
    if (!canAccessRef.current || mutationInFlightRef.current) {
      return null;
    }
    if (nextMutation === "pause-self" && pauseStateNeedsRefreshRef.current) {
      return null;
    }

    const operation = operationSequenceRef.current + 1;
    operationSequenceRef.current = operation;
    mutationInFlightRef.current = true;
    setMutation(nextMutation);
    return operation;
  };

  const finishMutation = (operation: number) => {
    if (!isCurrentOperation(operation)) {
      return;
    }

    mutationInFlightRef.current = false;
    setMutation(null);
  };

  const refreshShift = async (
    operation: number,
    routeSnapshotOwner: WorkerShiftHistoryItem
  ): Promise<boolean> => {
    if (!isCurrentOperation(operation)) {
      return false;
    }

    const nextShifts = await refresh();
    if (!isCurrentOperation(operation)) {
      return false;
    }
    if (latestRouteSnapshotRef.current !== routeSnapshotOwner) {
      return false;
    }

    const nextShift = findMatchingShift(nextShifts, identityRef.current);
    if (!nextShift) {
      throw new Error("This attendance is no longer available in your shift history.");
    }

    setPublishedShift({
      routeSnapshot: routeSnapshotOwner,
      value: nextShift
    });
    pauseStateNeedsRefreshRef.current = false;
    setPauseStateNeedsRefresh(false);
    return true;
  };

  const handleRefresh = () => {
    const routeSnapshotOwner = latestRouteSnapshotRef.current;
    const operation = beginMutation("refresh");
    if (operation === null) return;

    setError(null);
    setErrorAction(null);
    setSuccessMessage(null);

    void refreshShift(operation, routeSnapshotOwner)
      .catch((caughtError) => {
        if (isCurrentOperation(operation)) {
          setError(getPauseActionErrorMessage(caughtError));
          setErrorAction("refresh");
        }
      })
      .finally(() => finishMutation(operation));
  };

  const handleTogglePause = () => {
    if (pauseStateNeedsRefreshRef.current) {
      setSuccessMessage(null);
      setError(
        "The previous pause action succeeded. Refresh this attendance before another pause action."
      );
      setErrorAction("refresh");
      return;
    }

    if (shift.status !== "ACTIVE" || shift.attendanceStatus !== "APPROVED") {
      setSuccessMessage(null);
      setError("Pause is available after foreman approval during an active shift.");
      setErrorAction(null);
      return;
    }
    if (!shift.pauseState) {
      setSuccessMessage(null);
      setError(missingPauseStateMessage);
      setErrorAction("refresh");
      return;
    }
    if (shift.pauseState.allPaused) {
      setSuccessMessage(null);
      setError(allPauseActiveMessage);
      setErrorAction("refresh");
      return;
    }

    const operation = beginMutation("pause-self");
    if (operation === null) return;

    const wasPaused = shift.pauseState.personallyPaused;
    const nextAction = wasPaused ? endMyPause : startMyPause;
    let pauseRequestSucceeded = false;
    setError(null);
    setErrorAction(null);
    setSuccessMessage(null);

    void authenticatedRequest((token) => nextAction(token, identityRef.current.shiftId))
      .then(() => {
        pauseRequestSucceeded = true;
        if (!isCurrentOperation(operation)) {
          return false;
        }
        pauseStateNeedsRefreshRef.current = true;
        setPauseStateNeedsRefresh(true);
        return refreshShift(operation, latestRouteSnapshotRef.current);
      })
      .then((didRefresh) => {
        if (didRefresh && isCurrentOperation(operation)) {
          setSuccessMessage(wasPaused ? "Your pause ended." : "Your pause started.");
        }
      })
      .catch((caughtError) => {
        if (isCurrentOperation(operation)) {
          const message = getPauseActionErrorMessage(caughtError);
          setError(
            pauseRequestSucceeded
              ? `The pause action succeeded, but the latest attendance could not be loaded. ${message}`
              : message
          );
          setErrorAction(pauseRequestSucceeded ? "refresh" : "pause-self");
        }
      })
      .finally(() => finishMutation(operation));
  };

  if (!canAccess) {
    return (
      <Screen scroll scrollProps={{ testID: "worker-shift-details-scroll" }}>
        <View style={styles.page} testID="worker-shift-details-access-gate">
          <ScreenHeader
            backAction={{ label: "Back", onPress: navigation.goBack }}
            eyebrow="Shift details"
            subtitle="This view is available only to a worker who belongs to a company."
            title="Worker access required"
          />
          <Feedback
            message="Return to your current role flow to continue."
            mode="screen"
            title="Shift details unavailable"
            tone="error"
          />
        </View>
      </Screen>
    );
  }

  const isMutating = mutation !== null;
  const isDiscarded = shift.status === "DISCARDED";
  const isActiveWorkerShift =
    shift.status === "ACTIVE" &&
    shift.attendanceStatus !== "REJECTED" &&
    shift.attendanceStatus !== "CANCELLED";
  const isApprovedActiveShift =
    isActiveWorkerShift && shift.attendanceStatus === "APPROVED";
  const isPendingActiveJoin =
    shift.status === "ACTIVE" && shift.attendanceStatus === "JOINED";
  const isAllPaused = shift.pauseState?.allPaused === true;
  const isPersonallyPaused = shift.pauseState?.personallyPaused === true;
  const canPause = isApprovedActiveShift && Boolean(shift.pauseState) && !isAllPaused;
  const needsPauseStateRefresh = isApprovedActiveShift && !shift.pauseState;
  const canShowFinalPayBreakdown =
    shift.status === "CLOSED" &&
    shift.attendanceStatus === "APPROVED" &&
    shift.calculatedSalary !== null;
  const hasTimingDetails =
    shift.actualStartTime !== null ||
    shift.actualEndTime !== null ||
    (shift.payableStartTime !== undefined && shift.payableStartTime !== null);
  const retryErrorAction =
    errorAction === "pause-self" ? handleTogglePause : handleRefresh;

  return (
    <Screen
      scroll
      scrollProps={{
        accessibilityLabel: "Worker shift details",
        testID: "worker-shift-details-scroll"
      }}
    >
      <View style={styles.page} testID="worker-shift-details-content">
        <ScreenHeader
          backAction={{ label: "Back", onPress: navigation.goBack }}
          eyebrow="Worker shift"
          subtitle={shift.companyName}
          title={shift.title}
        />

        <Card testID="worker-shift-status-card">
          <View style={styles.cardContent}>
            <SectionHeader
              supportingText="Shift, attendance, payment, and pause remain separate states."
              title="Current status"
            />
            <View style={styles.statusGroups}>
              <View style={styles.statusGroup}>
                <Text allowFontScaling style={styles.statusLabel}>Shift</Text>
                <StatusBadge
                  accessibilityLabel="Shift status"
                  label={
                    getShiftStatusPresentation(shift.status)?.label ??
                    "Status unavailable"
                  }
                  tone={getShiftStatusTone(shift.status)}
                />
              </View>
              <View style={styles.statusGroup}>
                <Text allowFontScaling style={styles.statusLabel}>Attendance</Text>
                <StatusBadge
                  accessibilityLabel="Attendance status"
                  label={getAttendanceStatusPresentation(shift.attendanceStatus).label}
                  tone={getAttendanceStatusTone(shift.attendanceStatus)}
                />
              </View>
              {shift.paymentStatus && !isDiscarded ? (
                <View style={styles.statusGroup}>
                  <Text allowFontScaling style={styles.statusLabel}>Payment</Text>
                  <StatusBadge
                    accessibilityLabel="Payment status"
                    label={getPaymentStatusPresentation(shift.paymentStatus).label}
                    tone={getPaymentStatusTone(shift.paymentStatus)}
                  />
                </View>
              ) : null}
              {!isDiscarded && isPersonallyPaused ? (
                <View style={styles.statusGroup}>
                  <Text allowFontScaling style={styles.statusLabel}>Personal pause</Text>
                  <StatusBadge
                    accessibilityLabel="Personal pause status"
                    label="Personal pause active"
                    tone="warning"
                  />
                </View>
              ) : null}
              {!isDiscarded && isAllPaused ? (
                <View style={styles.statusGroup}>
                  <Text allowFontScaling style={styles.statusLabel}>Crew pause</Text>
                  <StatusBadge
                    accessibilityLabel="Crew pause status"
                    label="Crew pause active"
                    tone="warning"
                  />
                </View>
              ) : null}
            </View>
          </View>
        </Card>

        {successMessage ? (
          <Feedback message={successMessage} testID="worker-shift-details-success" title="Shift updated" tone="success" />
        ) : null}
        {error ? (
          <Feedback
            action={errorAction ? {
              accessibilityHint: errorAction === "pause-self"
                ? "Retries the same personal pause action."
                : "Refreshes this exact attendance again.",
              disabled: isMutating,
              label: "Retry",
              loading: mutation === errorAction,
              onPress: retryErrorAction,
              testID: "worker-shift-details-retry"
            } : undefined}
            message={error}
            testID="worker-shift-details-error"
            title={errorAction === "refresh" ? "Could not refresh shift" : "Could not update pause"}
            tone="error"
          />
        ) : null}
        {isPendingActiveJoin ? (
          <Feedback
            message="Your foreman must approve this attendance before pause or resume is available."
            title="Waiting for approval"
            tone="info"
          />
        ) : null}
        {isApprovedActiveShift && isAllPaused ? (
          <Feedback message={allPauseActiveMessage} title="Paused by foreman" tone="warning" />
        ) : null}
        {isDiscarded ? (
          <Feedback
            message="This short shift was not saved for payroll and is not payable."
            title="Discarded shift"
            tone="warning"
          />
        ) : null}

        <Card testID="worker-shift-information-card">
          <View style={styles.cardContent}>
            <SectionHeader title="Shift information" />
            <View style={styles.details}>
              <DetailRow label="Company" value={shift.companyName} />
              {shift.location !== null ? <DetailRow label="Location" value={shift.location} /> : null}
            </View>
          </View>
        </Card>

        <Card testID="worker-shift-timing-card">
          <View style={styles.cardContent}>
            <SectionHeader
              supportingText="Only timestamps returned for this attendance are shown."
              title="Timing"
            />
            {hasTimingDetails ? (
              <View style={styles.details}>
                {shift.actualStartTime !== null ? (
                  <DetailRow label="Actual start" value={formatDateTime(shift.actualStartTime)} />
                ) : null}
                {shift.actualEndTime !== null ? (
                  <DetailRow label="Actual end" value={formatDateTime(shift.actualEndTime)} />
                ) : null}
                {shift.payableStartTime !== undefined && shift.payableStartTime !== null && !isDiscarded ? (
                  <DetailRow label="Payable start" value={formatDateTime(shift.payableStartTime)} />
                ) : null}
              </View>
            ) : (
              <Feedback
                message="No start, end, or payable-start timestamp was returned."
                title="Timing not available yet"
              />
            )}
          </View>
        </Card>

        <Card testID="worker-shift-work-card">
          <View style={styles.cardContent}>
            <SectionHeader supportingText="These values come from this attendance record." title="Work" />
            <View style={styles.metricGrid}>
              <ReturnedMetric label="Static break" value={`${shift.breakMinutes} min`} />
              {!isDiscarded && shift.pauseMinutes !== undefined && shift.pauseMinutes !== null ? (
                <ReturnedMetric label="Pause time" value={formatPauseMinutes(shift.pauseMinutes)} />
              ) : null}
              {!isDiscarded && shift.workedMinutes !== null ? (
                <ReturnedMetric label="Worked time" value={formatMinutes(shift.workedMinutes)} />
              ) : null}
            </View>
          </View>
        </Card>

        <Card testID="worker-shift-pay-card">
          <View style={styles.cardContent}>
            <SectionHeader
              supportingText="Amounts are backend results; this screen does not calculate totals."
              title="Pay"
            />
            <View style={styles.metricGrid}>
              <ReturnedMetric
                label="Hourly rate"
                value={formatRateWithCurrencyLabel(shift.hourlyRate, shift.currencyLabel)}
              />
              {!isDiscarded && shift.calculatedSalary !== null ? (
                <ReturnedMetric
                  label="Calculated salary"
                  testID="worker-shift-calculated-salary"
                  value={formatMoneyWithCurrencyLabel(shift.calculatedSalary, shift.currencyLabel)}
                />
              ) : null}
            </View>
            {!isDiscarded && (shift.paymentStatus || shift.paidAt) ? (
              <View style={styles.details}>
                {shift.paymentStatus ? (
                  <DetailRow
                    label="Payment status"
                    value={getPaymentStatusPresentation(shift.paymentStatus).label}
                  />
                ) : null}
                {shift.paidAt ? <DetailRow label="Paid" value={formatDateTime(shift.paidAt)} /> : null}
              </View>
            ) : null}
            {isDiscarded ? (
              <Feedback
                message="No calculated salary or payment state is presented for a discarded shift."
                title="Not payable"
                tone="warning"
              />
            ) : null}
          </View>
        </Card>

        {canShowFinalPayBreakdown ? (
          <View style={styles.section} testID="worker-shift-breakdown-section">
            <SectionHeader
              supportingText="Read-only persisted audit data for this closed attendance."
              title="Calculation details"
            />
            {shift.payCalculation ? (
              <PayCalculationBreakdown calculation={shift.payCalculation} currencyLabel={shift.currencyLabel} />
            ) : (
              <Feedback
                message="No calculation snapshot was returned. The stored calculated salary remains the authoritative final amount."
                testID="worker-shift-breakdown-absent"
                title="Breakdown not recorded"
              />
            )}
          </View>
        ) : null}

        {isActiveWorkerShift ? (
          <Card testID="worker-shift-actions-card">
            <View style={styles.cardContent}>
              <SectionHeader
                supportingText="Pause affects only your approved attendance. Refresh retrieves the latest returned state."
                title="Shift actions"
              />
              {needsPauseStateRefresh ? (
                <Feedback
                  action={{
                    disabled: isMutating,
                    label: "Refresh status",
                    loading: mutation === "refresh",
                    onPress: handleRefresh,
                    testID: "worker-shift-missing-pause-refresh"
                  }}
                  message={missingPauseStateMessage}
                  title="Pause state unavailable"
                  tone="warning"
                />
              ) : null}
              <View style={styles.actions}>
                {canPause ? (
                  <Button
                    accessibilityHint={isPersonallyPaused
                      ? "Ends your personal pause, then refreshes this attendance."
                      : "Starts your personal pause, then refreshes this attendance."}
                    disabled={isMutating || pauseStateNeedsRefresh}
                    label={isPersonallyPaused ? "Resume my work" : "Pause my work"}
                    loading={mutation === "pause-self"}
                    onPress={handleTogglePause}
                    testID="worker-shift-pause-action"
                  />
                ) : null}
                <Button
                  accessibilityHint="Refreshes this exact shift and attendance from worker history."
                  disabled={isMutating}
                  label="Refresh status"
                  loading={mutation === "refresh"}
                  onPress={handleRefresh}
                  testID="worker-shift-refresh-action"
                  variant="secondary"
                />
              </View>
            </View>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { width: "100%", gap: theme.gap.section },
  cardContent: { width: "100%", gap: theme.space[4] },
  statusGroups: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: theme.space[3]
  },
  statusGroup: { maxWidth: "100%", flexShrink: 1, gap: theme.space[1] },
  statusLabel: {
    ...theme.typography.caption,
    color: theme.colors.ink.muted,
    flexShrink: 1
  },
  details: { width: "100%" },
  metricGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    gap: theme.space[2]
  },
  metric: {
    minWidth: 120,
    flexBasis: "46%",
    flexGrow: 1,
    flexShrink: 1,
    gap: theme.space[1],
    borderRadius: theme.radius.md,
    borderWidth: theme.border.default,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface.subtle,
    padding: theme.space[3]
  },
  metricLabel: {
    ...theme.typography.caption,
    color: theme.colors.ink.muted,
    flexShrink: 1
  },
  metricValue: {
    ...theme.typography.cardTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  section: { width: "100%", gap: theme.space[3] },
  actions: { width: "100%", gap: theme.space[2] }
});
