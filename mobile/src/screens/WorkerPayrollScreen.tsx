import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { ApiError, getErrorMessage } from "../api/errors";
import {
  createPayoutRequest,
  getMyPayoutRequests,
  getPayableAttendances,
  previewPayoutRequest
} from "../api/payroll";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { DetailRow } from "../components/DetailRow";
import { EmptyState } from "../components/EmptyState";
import { Feedback } from "../components/Feedback";
import { PayoutRequestCard } from "../components/PayoutRequestCard";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import type { WorkerStackParamList, WorkerTabParamList } from "../types/navigation";
import type {
  PayableAttendance,
  PayoutRequest,
  PayoutRequestPreview,
  PayoutRequestStatus
} from "../types/payroll";
import {
  formatDateTime,
  formatMinutes,
  formatWholeMoneyWithCurrencyLabel
} from "../utils/format";
import { getPaymentStatusPresentation } from "../utils/status";
import { theme } from "../utils/theme";

type WorkerPayrollScreenProps = CompositeScreenProps<
  BottomTabScreenProps<WorkerTabParamList, "WorkerPayroll">,
  NativeStackScreenProps<WorkerStackParamList>
>;

type MutationName = "refresh" | "preview" | "create";

function doAttendanceIdsMatch(left: readonly number[] | null, right: readonly number[]): boolean {
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

function getAttendanceAccessibleLabel(
  attendance: PayableAttendance,
  timeZone: string | null | undefined
): string {
  const parts = [attendance.title.trim()];

  if (attendance.companyName.trim()) {
    parts.push(attendance.companyName.trim());
  }
  if (attendance.location?.trim()) {
    parts.push(attendance.location.trim());
  }
  if (attendance.actualEndTime) {
    parts.push(formatDateTime(attendance.actualEndTime, timeZone));
  }

  return `Select payable attendance. ${parts.filter(Boolean).join(". ")}`;
}

export function WorkerPayrollScreen({ navigation }: WorkerPayrollScreenProps) {
  const { authenticatedRequest, user } = useAuth();
  const canAccess = user?.role === "WORKER" && user.company !== null;
  const company = canAccess ? user.company : null;
  const [payableAttendances, setPayableAttendances] = useState<PayableAttendance[]>([]);
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [selectedAttendanceIds, setSelectedAttendanceIds] = useState<number[]>([]);
  const [preview, setPreview] = useState<PayoutRequestPreview | null>(null);
  const [previewAttendanceIds, setPreviewAttendanceIds] = useState<number[] | null>(null);
  const [createdRequest, setCreatedRequest] = useState<PayoutRequest | null>(null);
  const [initialLoading, setInitialLoading] = useState(canAccess);
  const [refreshing, setRefreshing] = useState(false);
  const [mutation, setMutation] = useState<MutationName | null>(null);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<PayoutRequestStatus>("PENDING");

  const mountedRef = useRef(true);
  const canAccessRef = useRef(canAccess);
  const hasUsableDataRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const previewGenerationRef = useRef(0);
  const actionGenerationRef = useRef(0);
  const selectionRevisionRef = useRef(0);
  const selectedAttendanceIdsRef = useRef<number[]>([]);
  const submittedAttendanceIdsRef = useRef(new Set<number>());
  const mutationInFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadGenerationRef.current += 1;
      previewGenerationRef.current += 1;
      actionGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    canAccessRef.current = canAccess;
    loadGenerationRef.current += 1;
    previewGenerationRef.current += 1;
    actionGenerationRef.current += 1;
    if (!canAccess) {
      hasUsableDataRef.current = false;
      selectedAttendanceIdsRef.current = [];
      submittedAttendanceIdsRef.current.clear();
      selectionRevisionRef.current += 1;
      mutationInFlightRef.current = false;
    }
  }, [canAccess]);

  const selectedIds = useMemo(
    () => new Set(selectedAttendanceIds),
    [selectedAttendanceIds]
  );
  const selectedCurrencyLabel = useMemo(() => {
    const selected = payableAttendances.find((attendance) =>
      selectedIds.has(attendance.attendanceId)
    );
    return selected?.currencyLabel ?? null;
  }, [payableAttendances, selectedIds]);

  const invalidatePreview = useCallback(
    (options: { preserveError?: boolean } = {}) => {
      previewGenerationRef.current += 1;
      setPreview(null);
      setPreviewAttendanceIds(null);
      if (!options.preserveError) {
        setPreviewError(null);
      }
    },
    []
  );

  const publishSelection = useCallback(
    (
      nextAttendanceIds: number[],
      options: {
        preserveFeedback?: boolean;
        preservePreviewError?: boolean;
      } = {}
    ) => {
      selectedAttendanceIdsRef.current = nextAttendanceIds;
      selectionRevisionRef.current += 1;
      setSelectedAttendanceIds(nextAttendanceIds);
      invalidatePreview({ preserveError: options.preservePreviewError });
      if (!options.preserveFeedback) {
        setCreatedRequest(null);
        setCreateError(null);
        setSuccessMessage(null);
      }
    },
    [invalidatePreview]
  );

  const loadPayroll = useCallback(async (
    options: { preservePreviewError?: boolean } = {}
  ): Promise<boolean> => {
    if (!canAccessRef.current) {
      return false;
    }

    invalidatePreview({ preserveError: options.preservePreviewError });
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    const hasUsableData = hasUsableDataRef.current;

    if (hasUsableData) {
      setRefreshing(true);
      setRefreshError(null);
    } else {
      setInitialLoading(true);
      setInitialError(null);
    }

    try {
      const [nextPayableAttendances, nextRequests] = await authenticatedRequest(
        async (token) =>
          Promise.all([getPayableAttendances(token), getMyPayoutRequests(token)])
      );

      if (
        !mountedRef.current ||
        !canAccessRef.current ||
        generation !== loadGenerationRef.current
      ) {
        return false;
      }

      const payableIds = new Set(
        nextPayableAttendances.map((attendance) => attendance.attendanceId)
      );
      const nextSelection = selectedAttendanceIdsRef.current.filter((attendanceId) =>
        payableIds.has(attendanceId)
      );

      hasUsableDataRef.current = true;
      submittedAttendanceIdsRef.current.clear();
      setPayableAttendances(nextPayableAttendances);
      setRequests(nextRequests);
      setInitialError(null);
      setRefreshError(null);
      setCreatedRequest((current) =>
        current && !nextRequests.some((request) => request.id === current.id)
          ? current
          : null
      );
      publishSelection(nextSelection, {
        preserveFeedback: true,
        preservePreviewError: options.preservePreviewError
      });
      return true;
    } catch (caughtError) {
      if (
        !mountedRef.current ||
        !canAccessRef.current ||
        generation !== loadGenerationRef.current
      ) {
        return false;
      }

      const message = getErrorMessage(caughtError);
      if (hasUsableDataRef.current) {
        setRefreshError(message);
      } else {
        setInitialError(message);
      }
      return false;
    } finally {
      if (
        mountedRef.current &&
        canAccessRef.current &&
        generation === loadGenerationRef.current
      ) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, [authenticatedRequest, invalidatePreview, publishSelection]);

  useFocusEffect(
    useCallback(() => {
      if (canAccess) {
        void loadPayroll();
      }

      return () => {
        loadGenerationRef.current += 1;
        previewGenerationRef.current += 1;
        actionGenerationRef.current += 1;
      };
    }, [canAccess, loadPayroll])
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
    if (mountedRef.current) {
      setMutation(null);
    }
  };

  const getSelectionError = (attendanceIds: readonly number[]): string | null => {
    if (attendanceIds.length === 0) {
      return "Select at least one unpaid attendance before continuing.";
    }

    const selected = attendanceIds.map((attendanceId) =>
      payableAttendances.find((attendance) => attendance.attendanceId === attendanceId)
    );
    if (
      attendanceIds.some((attendanceId) =>
        submittedAttendanceIdsRef.current.has(attendanceId)
      )
    ) {
      return "This attendance was already submitted. Refresh payroll before selecting it again.";
    }
    if (selected.some((attendance) => attendance === undefined)) {
      return "The payroll selection changed. Refresh the list and select the work again.";
    }

    const labels = selected.map((attendance) => attendance?.currencyLabel ?? null);
    if (labels.some((label) => label === null)) {
      return "Historical currency label is unavailable. This attendance cannot be submitted for payout.";
    }
    if (new Set(labels).size !== 1) {
      return "Select attendance with one currency label per payout request. Create separate requests for different labels.";
    }

    return null;
  };

  const handleRefresh = () => {
    if (!canAccess || !beginMutation("refresh")) {
      return;
    }

    setSuccessMessage(null);
    setCreateError(null);
    void loadPayroll().finally(finishMutation);
  };

  const handleToggleAttendance = (attendanceId: number) => {
    const attendance = payableAttendances.find((item) => item.attendanceId === attendanceId);
    if (
      !attendance ||
      mutationInFlightRef.current ||
      submittedAttendanceIdsRef.current.has(attendanceId)
    ) {
      return;
    }

    const currentIds = selectedAttendanceIdsRef.current;
    const isSelected = currentIds.includes(attendanceId);
    const currentCurrencyLabel = payableAttendances.find((item) =>
      currentIds.includes(item.attendanceId)
    )?.currencyLabel ?? null;
    if (!isSelected && attendance.currencyLabel === null) {
      setCreateError(
        "Historical currency label is unavailable. This attendance cannot be submitted for payout."
      );
      return;
    }
    if (
      !isSelected &&
      currentCurrencyLabel !== null &&
      attendance.currencyLabel !== currentCurrencyLabel
    ) {
      setCreateError(
        "Select attendance with one currency label per payout request. Create separate requests for different labels."
      );
      return;
    }

    publishSelection(
      isSelected
        ? currentIds.filter((id) => id !== attendanceId)
        : [...currentIds, attendanceId]
    );
  };

  const handleClearSelection = () => {
    if (!mutationInFlightRef.current) {
      publishSelection([]);
    }
  };

  const handlePreview = () => {
    if (initialLoading || refreshing) {
      setPreviewError("Wait for payroll data to finish loading before previewing.");
      return;
    }

    const previewIds = [...selectedAttendanceIdsRef.current];
    const validationError = getSelectionError(previewIds);
    if (validationError) {
      invalidatePreview();
      setPreviewError(validationError);
      return;
    }
    if (!beginMutation("preview")) {
      return;
    }

    const revision = selectionRevisionRef.current;
    const generation = previewGenerationRef.current + 1;
    previewGenerationRef.current = generation;
    setPreviewError(null);
    setCreateError(null);
    setSuccessMessage(null);

    void authenticatedRequest((token) =>
      previewPayoutRequest(token, { attendanceIds: previewIds })
    )
      .then((nextPreview) => {
        if (
          mountedRef.current &&
          canAccessRef.current &&
          generation === previewGenerationRef.current &&
          revision === selectionRevisionRef.current &&
          doAttendanceIdsMatch(previewIds, selectedAttendanceIdsRef.current)
        ) {
          setPreview(nextPreview);
          setPreviewAttendanceIds(previewIds);
        }
      })
      .catch(async (caughtError) => {
        if (
          mountedRef.current &&
          canAccessRef.current &&
          generation === previewGenerationRef.current &&
          revision === selectionRevisionRef.current
        ) {
          setPreview(null);
          setPreviewAttendanceIds(null);
          setPreviewError(formatPayrollError(caughtError));
          if (caughtError instanceof ApiError && caughtError.status === 400) {
            await loadPayroll({ preservePreviewError: true });
          }
        }
      })
      .finally(finishMutation);
  };

  const handleCreate = () => {
    if (initialLoading || refreshing) {
      setCreateError("Wait for payroll data to finish loading before creating a request.");
      return;
    }

    const createIds = [...selectedAttendanceIdsRef.current];
    const validationError = getSelectionError(createIds);
    if (validationError) {
      setCreateError(validationError);
      return;
    }
    if (!preview || !doAttendanceIdsMatch(previewAttendanceIds, createIds)) {
      invalidatePreview();
      setCreateError("Preview the current payroll selection before creating a request.");
      return;
    }
    if (!beginMutation("create")) {
      return;
    }

    const revision = selectionRevisionRef.current;
    const generation = actionGenerationRef.current + 1;
    actionGenerationRef.current = generation;
    setCreateError(null);
    setPreviewError(null);
    setSuccessMessage(null);

    void authenticatedRequest((token) =>
      createPayoutRequest(token, { attendanceIds: createIds })
    )
      .then(async (request) => {
        if (
          !mountedRef.current ||
          !canAccessRef.current ||
          generation !== actionGenerationRef.current ||
          revision !== selectionRevisionRef.current
        ) {
          return;
        }

        for (const attendanceId of createIds) {
          submittedAttendanceIdsRef.current.add(attendanceId);
        }
        const submittedIds = new Set(createIds);
        setPayableAttendances((currentAttendances) =>
          currentAttendances.filter(
            (attendance) => !submittedIds.has(attendance.attendanceId)
          )
        );
        publishSelection([], { preserveFeedback: true });
        setCreatedRequest(request);
        setSuccessMessage("Payout request created.");
        setHistoryFilter("PENDING");
        await loadPayroll();
      })
      .catch(async (caughtError) => {
        if (
          !mountedRef.current ||
          !canAccessRef.current ||
          generation !== actionGenerationRef.current
        ) {
          return;
        }

        setCreateError(formatPayrollError(caughtError));
        if (caughtError instanceof ApiError && [400, 409].includes(caughtError.status)) {
          await loadPayroll();
        }
      })
      .finally(finishMutation);
  };

  if (!canAccess || !company) {
    return (
      <Screen>
        <View style={styles.page} testID="worker-payroll-boundary">
          <Feedback
            message="Worker payroll is available after joining a company."
            mode="screen"
            title="Payroll unavailable"
            tone="error"
          />
        </View>
      </Screen>
    );
  }

  const isMutating = mutation !== null;
  const previewMatchesSelection = doAttendanceIdsMatch(
    previewAttendanceIds,
    selectedAttendanceIds
  );
  const filteredRequests = requests.filter((request) => request.status === historyFilter);
  const selectedCount = selectedAttendanceIds.length;

  return (
    <Screen
      scroll
      scrollProps={{
        refreshControl: (
          <RefreshControl
            enabled={!isMutating}
            onRefresh={handleRefresh}
            refreshing={refreshing || mutation === "refresh"}
          />
        ),
        testID: "worker-payroll-scroll"
      }}
    >
      <View style={styles.page} testID="worker-payroll-content">
        <View style={styles.header} testID="worker-payroll-header">
          <Text allowFontScaling style={styles.brand}>ShiftPay</Text>
          <Text accessibilityRole="header" allowFontScaling style={styles.title}>Payroll</Text>
          <Text allowFontScaling style={styles.supporting}>
            Select approved unpaid work, review backend totals, then create one payout request.
          </Text>
          <View style={styles.companyLine}>
            <Text allowFontScaling style={styles.companyLabel}>Company</Text>
            <Text allowFontScaling style={styles.companyName}>{company.name}</Text>
          </View>
        </View>

        {successMessage ? (
          <Feedback
            message={successMessage}
            testID="worker-payroll-success"
            title="Request submitted"
            tone="success"
          />
        ) : null}
        {refreshError ? (
          <Feedback
            action={{
              disabled: isMutating,
              label: "Retry refresh",
              onPress: handleRefresh,
              testID: "worker-payroll-refresh-retry"
            }}
            message={refreshError}
            testID="worker-payroll-refresh-error"
            title="Could not refresh payroll"
            tone="error"
          />
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            action={{
              disabled: isMutating || initialLoading,
              icon: "refresh",
              label: "Refresh",
              onPress: handleRefresh
            }}
            supportingText="Only backend-returned approved, unpaid attendance can be selected."
            title="Payable work"
          />

          {initialLoading ? (
            <Feedback
              loading
              message="Fetching approved unpaid attendance and request history."
              mode="screen"
              testID="worker-payroll-loading"
              title="Loading payroll"
            />
          ) : initialError ? (
            <Feedback
              action={{
                disabled: isMutating,
                label: "Retry",
                onPress: handleRefresh,
                testID: "worker-payroll-initial-retry"
              }}
              message={initialError}
              mode="screen"
              testID="worker-payroll-initial-error"
              title="Could not load payroll"
              tone="error"
            />
          ) : payableAttendances.length === 0 ? (
            <EmptyState
              message="Closed, approved, unpaid attendance will appear here."
              testID="worker-payroll-empty"
              title="No payable work"
            />
          ) : (
            <View style={styles.list} testID="worker-payroll-attendance-list">
              {payableAttendances.map((attendance) => {
                const selected = selectedIds.has(attendance.attendanceId);
                const unavailableCurrency = attendance.currencyLabel === null;
                const mixedCurrency =
                  !selected &&
                  selectedCurrencyLabel !== null &&
                  attendance.currencyLabel !== selectedCurrencyLabel;
                const disabled =
                  isMutating || refreshing || unavailableCurrency || mixedCurrency;
                const paymentStatus = getPaymentStatusPresentation(attendance.paymentStatus);

                return (
                  <Pressable
                    accessible
                    accessibilityLabel={getAttendanceAccessibleLabel(
                      attendance,
                      company.timeZone
                    )}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected, disabled }}
                    aria-checked={selected}
                    aria-disabled={disabled}
                    disabled={disabled}
                    importantForAccessibility="yes"
                    key={attendance.attendanceId}
                    onPress={() => handleToggleAttendance(attendance.attendanceId)}
                    style={({ pressed }) => [
                      styles.attendanceCard,
                      selected && styles.selectedCard,
                      pressed && !disabled && styles.pressed,
                      disabled && styles.disabledCard
                    ]}
                    testID={`worker-payroll-attendance-${attendance.attendanceId}`}
                  >
                    <View
                      accessibilityElementsHidden
                      accessible={false}
                      importantForAccessibility="no-hide-descendants"
                      style={styles.attendanceHeader}
                    >
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected ? <View style={styles.checkboxMark} /> : null}
                      </View>
                      <View style={styles.attendanceTitleBlock}>
                        <Text allowFontScaling style={styles.cardTitle}>{attendance.title}</Text>
                        {attendance.location?.trim() ? (
                          <Text allowFontScaling style={styles.cardSubtitle}>
                            {attendance.location.trim()}
                          </Text>
                        ) : null}
                        {attendance.actualEndTime ? (
                          <Text allowFontScaling style={styles.cardSubtitle}>
                            {formatDateTime(attendance.actualEndTime, company.timeZone)}
                          </Text>
                        ) : null}
                      </View>
                      <StatusBadge label={paymentStatus.label} tone={paymentStatus.tone} />
                    </View>

                    <View
                      accessibilityElementsHidden
                      accessible={false}
                      importantForAccessibility="no-hide-descendants"
                      style={styles.compactRows}
                    >
                      <DetailRow
                        label="Raw payable time"
                        value={formatMinutes(attendance.rawPayableMinutes)}
                      />
                      <DetailRow
                        label="Final payout amount"
                        value={formatWholeMoneyWithCurrencyLabel(
                          attendance.payoutAmount,
                          attendance.currencyLabel
                        )}
                      />
                    </View>
                    {unavailableCurrency ? (
                      <Text allowFontScaling style={styles.currencyWarning}>
                        Historical currency unavailable. This row cannot be selected for payout.
                      </Text>
                    ) : null}
                    {mixedCurrency ? (
                      <Text allowFontScaling style={styles.currencyWarning}>
                        Select this currency in a separate payout request.
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader
            supportingText={`${selectedCount} attendance ${selectedCount === 1 ? "row" : "rows"} selected.`}
            title="Selection preview"
          />
          {previewError ? (
            <Feedback
              action={{
                disabled: isMutating || selectedCount === 0,
                label: "Retry preview",
                onPress: handlePreview,
                testID: "worker-payroll-preview-retry"
              }}
              message={previewError}
              testID="worker-payroll-preview-error"
              title="Could not preview selection"
              tone="error"
            />
          ) : null}
          {createError ? (
            <Feedback
              message={createError}
              testID="worker-payroll-create-error"
              title="Could not create request"
              tone="error"
            />
          ) : null}

          {preview && previewMatchesSelection ? (
            <Card testID="worker-payroll-preview-card">
              <View style={styles.previewCard}>
                <View style={styles.previewHeading}>
                  <Text accessibilityRole="header" allowFontScaling style={styles.previewTitle}>
                    Backend preview ready
                  </Text>
                  <StatusBadge label="Current selection" tone="success" />
                </View>
                <View style={styles.metricGrid}>
                  <View style={styles.metric}>
                    <Text allowFontScaling style={styles.metricLabel}>Raw payable time</Text>
                    <Text allowFontScaling style={styles.metricValue}>
                      {formatMinutes(preview.rawPayableMinutes)}
                    </Text>
                  </View>
                  <View style={styles.metric}>
                    <Text allowFontScaling style={styles.metricLabel}>Final payout</Text>
                    <Text allowFontScaling style={styles.metricValue}>
                      {formatWholeMoneyWithCurrencyLabel(
                        preview.payoutAmount,
                        preview.currencyLabel
                      )}
                    </Text>
                  </View>
                </View>
                <Text allowFontScaling style={styles.previewNote}>
                  These totals come from the latest backend preview for this exact selection.
                </Text>
              </View>
            </Card>
          ) : (
            <Feedback
              message={
                selectedCount === 0
                  ? "Select one or more payable attendance cards to continue."
                  : "Preview the current selection to receive authoritative totals."
              }
              testID="worker-payroll-preview-required"
              title={selectedCount === 0 ? "No work selected" : "Preview required"}
            />
          )}

          <View style={styles.actions}>
            <Button
              disabled={isMutating || initialLoading || refreshing || selectedCount === 0}
              label="Preview selection"
              loading={mutation === "preview"}
              onPress={handlePreview}
              testID="worker-payroll-preview"
              variant="secondary"
            />
            <Button
              accessibilityHint="Creates one payout request using this exact backend preview."
              disabled={
                isMutating ||
                initialLoading ||
                refreshing ||
                selectedCount === 0 ||
                !preview ||
                !previewMatchesSelection
              }
              label="Create payout request"
              leadingIcon="payroll"
              loading={mutation === "create"}
              onPress={handleCreate}
              testID="worker-payroll-create"
            />
            {selectedCount > 0 ? (
              <Button
                disabled={isMutating}
                label="Clear selection"
                onPress={handleClearSelection}
                variant="ghost"
              />
            ) : null}
          </View>
        </View>

        {createdRequest ? (
          <View style={styles.section} testID="worker-payroll-created-request">
            <SectionHeader title="Latest submitted request" />
            <PayoutRequestCard request={createdRequest} timeZone={company.timeZone} />
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            supportingText="Switch between requests waiting for review and approved requests."
            title="Request history"
          />
          <SegmentedControl
            accessibilityLabel="Payout request status"
            disabled={isMutating}
            onChange={setHistoryFilter}
            options={[
              { label: "Pending", value: "PENDING" },
              { label: "Approved", value: "APPROVED" }
            ]}
            testID="worker-payroll-history-filter"
            value={historyFilter}
          />

          {initialLoading ? (
            <Feedback loading message="Fetching payout requests." title="Loading requests" />
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              message={
                historyFilter === "PENDING"
                  ? "New payout requests waiting for review will appear here."
                  : "Approved payout requests will appear here."
              }
              testID={`worker-payroll-no-${historyFilter.toLowerCase()}`}
              title={`No ${historyFilter === "PENDING" ? "pending" : "approved"} requests`}
            />
          ) : (
            <View style={styles.list} testID="worker-payroll-request-list">
              {filteredRequests.map((request) => (
                <PayoutRequestCard
                  key={request.id}
                  request={request}
                  timeZone={company.timeZone}
                />
              ))}
            </View>
          )}
        </View>

        <Button
          label="Back to dashboard"
          leadingIcon="back"
          onPress={() => navigation.navigate("WorkerDashboard")}
          testID="worker-payroll-back-dashboard"
          variant="ghost"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    gap: theme.gap.section
  },
  header: {
    gap: theme.space[2]
  },
  brand: {
    ...theme.typography.label,
    color: theme.colors.brand.primary
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  supporting: {
    ...theme.typography.body,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  companyLine: {
    alignItems: "baseline",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space[2]
  },
  companyLabel: {
    ...theme.typography.caption,
    color: theme.colors.ink.muted
  },
  companyName: {
    ...theme.typography.label,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  section: {
    gap: theme.space[3]
  },
  list: {
    gap: theme.space[3]
  },
  attendanceCard: {
    backgroundColor: theme.colors.surface.default,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: theme.border.default,
    gap: theme.space[3],
    minHeight: theme.target.min,
    padding: theme.padding.card,
    ...theme.elevation.overlay
  },
  selectedCard: {
    backgroundColor: theme.colors.brand.tint,
    borderColor: theme.colors.brand.primary
  },
  disabledCard: {
    borderStyle: "dashed",
    opacity: 0.65
  },
  pressed: {
    opacity: 0.88,
    transform: [{ translateY: theme.border.default }]
  },
  attendanceHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space[3]
  },
  checkbox: {
    alignItems: "center",
    backgroundColor: theme.colors.surface.default,
    borderColor: theme.colors.brand.primary,
    borderRadius: theme.radius.sm,
    borderWidth: 2,
    height: 24,
    justifyContent: "center",
    width: 24
  },
  checkboxSelected: {
    backgroundColor: theme.colors.brand.primary
  },
  checkboxMark: {
    backgroundColor: theme.colors.surface.default,
    borderRadius: 2,
    height: 8,
    width: 12
  },
  attendanceTitleBlock: {
    flexBasis: 180,
    flexGrow: 1,
    flexShrink: 1,
    gap: theme.space[1]
  },
  cardTitle: {
    ...theme.typography.cardTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  cardSubtitle: {
    ...theme.typography.supporting,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  compactRows: {
    borderTopColor: theme.colors.border,
    borderTopWidth: theme.border.default,
    paddingTop: theme.space[2]
  },
  currencyWarning: {
    ...theme.typography.supporting,
    color: theme.colors.warning.fg,
    flexShrink: 1
  },
  previewCard: {
    gap: theme.space[3]
  },
  previewHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space[2],
    justifyContent: "space-between"
  },
  previewTitle: {
    ...theme.typography.cardTitle,
    color: theme.colors.ink.primary,
    flexGrow: 1,
    flexShrink: 1
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space[3]
  },
  metric: {
    backgroundColor: theme.colors.surface.subtle,
    borderRadius: theme.radius.md,
    flexBasis: 140,
    flexGrow: 1,
    flexShrink: 1,
    gap: theme.space[1],
    padding: theme.space[3]
  },
  metricLabel: {
    ...theme.typography.caption,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  metricValue: {
    ...theme.typography.sectionTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  previewNote: {
    ...theme.typography.supporting,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  actions: {
    gap: theme.space[3]
  }
});
