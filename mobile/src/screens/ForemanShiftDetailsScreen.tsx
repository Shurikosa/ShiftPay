import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { ApiError, getErrorMessage } from "../api/errors";
import {
  approveAttendance,
  cancelShift,
  closeShift,
  discardShift,
  endAllPause,
  endMyPause,
  getShiftAttendance,
  getShiftById,
  startAllPause,
  startMyPause,
  startShift
} from "../api/shifts";
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
import { useForemanManagedShifts } from "../hooks/useForemanManagedShifts";
import type { User } from "../types/auth";
import type { ForemanStackParamList } from "../types/navigation";
import type {
  ManagedShift,
  ShiftAttendance,
  ShiftStatus
} from "../types/shifts";
import {
  formatDateTime,
  formatMoneyWithCurrencyLabel,
  formatMinutes
} from "../utils/format";
import {
  formatPauseMinutes,
  getPauseActionErrorMessage,
  missingPauseStateMessage
} from "../utils/pauseDisplay";
import {
  formatStatusLabel,
  getAttendanceStatusPresentation,
  getPaymentStatusPresentation,
  getShiftStatusPresentation
} from "../utils/status";
import { theme } from "../utils/theme";

type ForemanShiftDetailsScreenProps = NativeStackScreenProps<
  ForemanStackParamList,
  "ForemanShiftDetails"
>;

type MutationName =
  | "approve"
  | "start"
  | "cancel"
  | "close"
  | "discard"
  | "pause-self"
  | "pause-all";

type MutationState = {
  type: MutationName;
  attendanceId?: number;
};

type MutationOptions = {
  allowDuringShortShiftDecision?: boolean;
  closeShortShiftDecisionAfterSuccess?: boolean;
  handleError?: (error: unknown) => boolean;
};

const shortShiftDecisionCode = "SHORT_SHIFT_REQUIRES_DECISION";

function isShortShiftDecisionError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.details?.code === shortShiftDecisionCode
  );
}

function ownsShift(user: User | null, shift: ManagedShift | null | undefined): boolean {
  return Boolean(
    user?.role === "FOREMAN" &&
      user.company &&
      shift &&
      shift.createdBy === user.id &&
      shift.companyId === user.company.id
  );
}

function lifecycleMessage(status: ShiftStatus): string {
  switch (status) {
    case "OPEN":
      return "Workers can join. Start or cancel this shift when ready.";
    case "ACTIVE":
      return "The shift is active. Attendance, pauses and close actions are available.";
    case "CLOSED":
      return "The shift is closed. Returned final attendance results are available below.";
    case "CANCELLED":
      return "This shift was cancelled before completion and has no summary action.";
    case "DISCARDED":
      return "This short shift was discarded and is not payable or summarizable.";
    case "CREATED":
      return "The current lifecycle state is not available for mobile actions.";
  }
}

function shortDecisionMessage(error: ApiError): string {
  const duration = formatMinutes(error.details?.actualDurationMinutes ?? null);
  const minimum = formatMinutes(error.details?.minimumDurationMinutes ?? null);
  return `Backend measured ${duration}; the configured minimum is ${minimum}. Save the shift for payroll, discard it, or keep it active.`;
}

function getCancelErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return "Shift can only be cancelled before it starts.";
    if (error.status === 403) return "You are not authorized to cancel this shift.";
  }
  return getErrorMessage(error);
}

export function ForemanShiftDetailsScreen({
  navigation,
  route
}: ForemanShiftDetailsScreenProps) {
  const { shiftId, initialShift } = route.params;
  const { authenticatedRequest, user } = useAuth();
  const { refresh: refreshManagedShifts } = useForemanManagedShifts({
    loadOnFocus: false
  });
  const baseAccess = user?.role === "FOREMAN" && user.company !== null;
  const safeInitialShift = ownsShift(user, initialShift) ? initialShift ?? null : null;
  const [shift, setShift] = useState<ManagedShift | null>(safeInitialShift);
  const [attendance, setAttendance] = useState<ShiftAttendance[]>([]);
  const [shiftLoading, setShiftLoading] = useState(baseAccess);
  const [attendanceLoading, setAttendanceLoading] = useState(baseAccess);
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [ownershipDenied, setOwnershipDenied] = useState(false);
  const [mutation, setMutation] = useState<MutationState | null>(null);
  const [shortShiftDecisionOpen, setShortShiftDecisionOpen] = useState(false);
  const [shortShiftDecisionMessage, setShortShiftDecisionMessage] = useState("");
  const [awaitingAuthoritativeRefresh, setAwaitingAuthoritativeRefresh] =
    useState(baseAccess);
  const mountedRef = useRef(true);
  const focusedRef = useRef(false);
  const shiftRef = useRef<ManagedShift | null>(safeInitialShift);
  const attendanceRef = useRef<ShiftAttendance[]>([]);
  const userRef = useRef(user);
  const loadSequenceRef = useRef(0);
  const mutationSequenceRef = useRef(0);
  const mutationInFlightRef = useRef(false);
  const shortShiftDecisionOpenRef = useRef(false);
  const awaitingAuthoritativeRefreshRef = useRef(baseAccess);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      focusedRef.current = false;
      loadSequenceRef.current += 1;
      mutationSequenceRef.current += 1;
      mutationInFlightRef.current = false;
      shortShiftDecisionOpenRef.current = false;
      awaitingAuthoritativeRefreshRef.current = false;
    };
  }, []);

  useEffect(() => {
    shiftRef.current = shift;
    attendanceRef.current = attendance;
    userRef.current = user;
  }, [attendance, shift, user]);

  const setShortShiftDecision = (open: boolean, message = "") => {
    shortShiftDecisionOpenRef.current = open;
    setShortShiftDecisionOpen(open);
    setShortShiftDecisionMessage(message);
  };

  const setAuthoritativeRefreshRequired = (required: boolean) => {
    awaitingAuthoritativeRefreshRef.current = required;
    setAwaitingAuthoritativeRefresh(required);
  };

  const loadDetails = useCallback(
    async (authoritativeRefreshRequired = false): Promise<boolean> => {
      if (!focusedRef.current || !baseAccess) return false;

      const sequence = ++loadSequenceRef.current;
      const isCurrent = () =>
        mountedRef.current &&
        focusedRef.current &&
        loadSequenceRef.current === sequence;

      if (authoritativeRefreshRequired) {
        awaitingAuthoritativeRefreshRef.current = true;
        setAwaitingAuthoritativeRefresh(true);
      }
      setShiftLoading(true);
      setAttendanceLoading(true);
      setShiftError(null);
      setAttendanceError(null);

      let nextShift: ManagedShift;
      try {
        nextShift = await authenticatedRequest((token) =>
          getShiftById(token, shiftId)
        );
      } catch (caughtError) {
        if (isCurrent()) {
          setShiftError(getErrorMessage(caughtError));
          setShiftLoading(false);
          setAttendanceLoading(false);
        }
        return false;
      }

      if (!isCurrent()) return false;

      if (!ownsShift(userRef.current, nextShift)) {
        shiftRef.current = null;
        attendanceRef.current = [];
        setShift(null);
        setAttendance([]);
        setOwnershipDenied(true);
        setShiftLoading(false);
        setAttendanceLoading(false);
        setAuthoritativeRefreshRequired(false);
        return false;
      }

      shiftRef.current = nextShift;
      setShift(nextShift);
      setOwnershipDenied(false);
      setShiftLoading(false);

      try {
        const nextAttendance = await authenticatedRequest((token) =>
          getShiftAttendance(token, shiftId)
        );
        if (!isCurrent()) return false;

        attendanceRef.current = nextAttendance;
        setAttendance(nextAttendance);
        setAttendanceError(null);
        setAuthoritativeRefreshRequired(false);
        return true;
      } catch (caughtError) {
        if (isCurrent()) {
          setAttendanceError(getErrorMessage(caughtError));
        }
        return false;
      } finally {
        if (isCurrent()) setAttendanceLoading(false);
      }
    },
    [authenticatedRequest, baseAccess, shiftId]
  );

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      mutationInFlightRef.current = false;
      shortShiftDecisionOpenRef.current = false;
      setMutation(null);
      setShortShiftDecisionOpen(false);
      setShortShiftDecisionMessage("");
      setActionError(null);
      setSuccessMessage(null);
      setAuthoritativeRefreshRequired(true);
      if (baseAccess) void loadDetails(true);

      return () => {
        focusedRef.current = false;
        loadSequenceRef.current += 1;
        mutationSequenceRef.current += 1;
        mutationInFlightRef.current = false;
        shortShiftDecisionOpenRef.current = false;
      };
    }, [baseAccess, loadDetails])
  );

  const currentOwnedShift = (): ManagedShift | null => {
    const current = shiftRef.current;
    return ownsShift(userRef.current, current) ? current : null;
  };

  const canRunForStatuses = (statuses: readonly ShiftStatus[]): boolean => {
    const current = currentOwnedShift();
    return Boolean(
      mountedRef.current &&
        focusedRef.current &&
        current &&
        statuses.includes(current.status) &&
        !awaitingAuthoritativeRefreshRef.current
    );
  };

  const beginMutation = (
    nextMutation: MutationState,
    options: MutationOptions
  ): number | null => {
    if (
      mutationInFlightRef.current ||
      awaitingAuthoritativeRefreshRef.current ||
      (shortShiftDecisionOpenRef.current &&
        !options.allowDuringShortShiftDecision)
    ) {
      return null;
    }

    mutationInFlightRef.current = true;
    const sequence = ++mutationSequenceRef.current;
    setMutation(nextMutation);
    setActionError(null);
    setSuccessMessage(null);
    return sequence;
  };

  const refreshAfterMutation = async (): Promise<void> => {
    await loadDetails(true);
    void refreshManagedShifts().catch(() => undefined);
  };

  const runMutation = (
    nextMutation: MutationState,
    request: (token: string) => Promise<unknown>,
    success: string,
    options: MutationOptions = {}
  ) => {
    const sequence = beginMutation(nextMutation, options);
    if (sequence === null) return;

    const isCurrent = () =>
      mountedRef.current &&
      focusedRef.current &&
      mutationSequenceRef.current === sequence;

    void Promise.resolve()
      .then(() => authenticatedRequest(request))
      .then(async () => {
        if (!isCurrent()) return;
        if (options.closeShortShiftDecisionAfterSuccess) {
          setShortShiftDecision(false);
        }
        setSuccessMessage(success);
        setAuthoritativeRefreshRequired(true);
        await refreshAfterMutation();
      })
      .catch((caughtError) => {
        if (!isCurrent()) return;
        if (!options.handleError?.(caughtError)) {
          setActionError(getErrorMessage(caughtError));
        }
      })
      .finally(() => {
        if (!isCurrent()) return;
        mutationInFlightRef.current = false;
        setMutation(null);
      });
  };

  const handleApprove = (attendanceId: number) => {
    if (!canRunForStatuses(["OPEN", "ACTIVE"])) return;
    const currentAttendance = attendanceRef.current.find(
      (item) => item.attendanceId === attendanceId
    );
    if (currentAttendance?.status !== "JOINED") return;

    runMutation(
      { type: "approve", attendanceId },
      (token) => approveAttendance(token, shiftId, attendanceId),
      "Worker attendance approved."
    );
  };

  const handleStart = () => {
    if (!canRunForStatuses(["OPEN"])) return;
    runMutation(
      { type: "start" },
      (token) => startShift(token, shiftId),
      "Shift started."
    );
  };

  const handleCancel = () => {
    if (!canRunForStatuses(["OPEN"])) return;
    runMutation(
      { type: "cancel" },
      (token) => cancelShift(token, shiftId),
      "Shift cancelled.",
      {
        handleError: (caughtError) => {
          setActionError(getCancelErrorMessage(caughtError));
          return true;
        }
      }
    );
  };

  const handleConfirmCancel = () => {
    if (!canRunForStatuses(["OPEN"]) || mutationInFlightRef.current) return;
    Alert.alert(
      "Cancel shift?",
      "This can only be done before the shift starts. Workers will no longer be able to join.",
      [
        { text: "Keep shift", style: "cancel" },
        { text: "Cancel shift", style: "destructive", onPress: handleCancel }
      ]
    );
  };

  const handleToggleSelfPause = () => {
    if (!canRunForStatuses(["ACTIVE"])) return;
    const current = currentOwnedShift();
    if (!current?.pauseState) {
      setSuccessMessage(null);
      setActionError(missingPauseStateMessage);
      return;
    }
    const wasPaused = current.pauseState.personallyPaused;
    runMutation(
      { type: "pause-self" },
      (token) =>
        wasPaused ? endMyPause(token, shiftId) : startMyPause(token, shiftId),
      wasPaused ? "Your pause ended." : "Your pause started.",
      {
        handleError: (caughtError) => {
          setActionError(getPauseActionErrorMessage(caughtError));
          return true;
        }
      }
    );
  };

  const handleToggleAllPause = () => {
    if (!canRunForStatuses(["ACTIVE"])) return;
    const current = currentOwnedShift();
    if (!current?.pauseState) {
      setSuccessMessage(null);
      setActionError(missingPauseStateMessage);
      return;
    }
    const wasPaused = current.pauseState.allPaused;
    runMutation(
      { type: "pause-all" },
      (token) =>
        wasPaused ? endAllPause(token, shiftId) : startAllPause(token, shiftId),
      wasPaused ? "Pause for everyone ended." : "Pause for everyone started.",
      {
        handleError: (caughtError) => {
          setActionError(getPauseActionErrorMessage(caughtError));
          return true;
        }
      }
    );
  };

  const handleClose = (saveShortShift = false) => {
    if (saveShortShift && !shortShiftDecisionOpenRef.current) return;
    if (!canRunForStatuses(["ACTIVE"])) return;
    runMutation(
      { type: "close" },
      (token) =>
        closeShift(
          token,
          shiftId,
          saveShortShift ? { saveShortShift: true } : undefined
        ),
      "Shift closed. Summary is available.",
      {
        allowDuringShortShiftDecision: saveShortShift,
        closeShortShiftDecisionAfterSuccess: saveShortShift,
        handleError: (caughtError) => {
          if (!saveShortShift && isShortShiftDecisionError(caughtError)) {
            setShortShiftDecision(true, shortDecisionMessage(caughtError));
            return true;
          }
          return false;
        }
      }
    );
  };

  const handleDiscardShortShift = () => {
    if (!canRunForStatuses(["ACTIVE"]) || !shortShiftDecisionOpenRef.current) {
      return;
    }
    runMutation(
      { type: "discard" },
      (token) => discardShift(token, shiftId),
      "Short shift discarded.",
      {
        allowDuringShortShiftDecision: true,
        closeShortShiftDecisionAfterSuccess: true
      }
    );
  };

  const handleKeepShortShiftActive = () => {
    if (!shortShiftDecisionOpenRef.current || mutationInFlightRef.current) return;
    setShortShiftDecision(false);
    void loadDetails(true);
  };

  const handleOpenSummary = () => {
    const current = currentOwnedShift();
    if (
      !current ||
      current.status !== "CLOSED" ||
      mutationInFlightRef.current ||
      awaitingAuthoritativeRefreshRef.current
    ) {
      return;
    }
    navigation.navigate("ShiftSummary", {
      shiftId,
      shiftTitle: current.title
    });
  };

  const handleRetry = () => {
    if (mutationInFlightRef.current || shortShiftDecisionOpenRef.current) return;
    void loadDetails(awaitingAuthoritativeRefreshRef.current);
  };

  if (!baseAccess) {
    return (
      <Screen>
        <View style={styles.page} testID="foreman-shift-access-gate">
          <ScreenHeader
            backAction={{ label: "Back", onPress: navigation.goBack }}
            eyebrow="Foreman shift"
            title="Shift details"
          />
          <Feedback
            message="Only a foreman with a company can manage shift details."
            mode="screen"
            title="Foreman company access required"
            tone="error"
          />
        </View>
      </Screen>
    );
  }

  const statusPresentation = shift
    ? getShiftStatusPresentation(shift.status)
    : undefined;
  const owned = ownsShift(user, shift);
  const actionBlocked =
    mutation !== null ||
    shortShiftDecisionOpen ||
    awaitingAuthoritativeRefresh ||
    shiftLoading ||
    attendanceLoading;
  const canStart = owned && shift?.status === "OPEN";
  const canCancel = owned && shift?.status === "OPEN";
  const canPause = owned && shift?.status === "ACTIVE" && shift.pauseState !== undefined;
  const canClose = owned && shift?.status === "ACTIVE";
  const canShowSummary = owned && shift?.status === "CLOSED";
  const canApproveAttendance =
    owned && (shift?.status === "OPEN" || shift?.status === "ACTIVE");

  return (
    <Screen
      scroll
      scrollProps={{
        accessibilityLabel: "Foreman shift details",
        testID: "foreman-shift-details-scroll"
      }}
    >
      <View style={styles.page} testID="foreman-shift-details-content">
        <ScreenHeader
          backAction={{
            disabled: mutation !== null,
            label: "Back",
            onPress: navigation.goBack
          }}
          eyebrow="Foreman shift"
          subtitle={shift ? shift.companyName : "Manage one of your company shifts."}
          title={shift?.title ?? "Shift details"}
        />

        {successMessage ? (
          <Feedback
            message={successMessage}
            testID="foreman-shift-success"
            title="Updated"
            tone="success"
          />
        ) : null}
        {actionError ? (
          <Feedback
            message={actionError}
            testID="foreman-shift-action-error"
            title="Shift action failed"
            tone="error"
          />
        ) : null}

        {ownershipDenied ? (
          <Feedback
            message="This shift does not belong to your foreman account and company."
            mode="screen"
            testID="foreman-shift-owner-gate"
            title="Shift access denied"
            tone="error"
          />
        ) : shiftLoading && !shift ? (
          <Feedback
            loading
            message="Fetching the shift before showing private details and actions."
            mode="screen"
            testID="foreman-shift-loading"
            title="Loading shift"
          />
        ) : shiftError && !shift ? (
          <Feedback
            action={{
              label: "Retry",
              onPress: handleRetry,
              testID: "foreman-shift-retry"
            }}
            message={shiftError}
            mode="screen"
            testID="foreman-shift-error"
            title="Could not load shift"
            tone="error"
          />
        ) : shift && owned ? (
          <>
            {shiftError ? (
              <Feedback
                action={{ label: "Retry refresh", onPress: handleRetry }}
                message={shiftError}
                testID="foreman-shift-refresh-error"
                title="Could not refresh shift"
                tone="error"
              />
            ) : null}

            <Card testID="foreman-shift-lifecycle-card">
              <View style={styles.cardContent}>
                <SectionHeader
                  supportingText={lifecycleMessage(shift.status)}
                  title="Lifecycle"
                />
                <View style={styles.badges}>
                  {statusPresentation ? (
                    <StatusBadge
                      accessibilityLabel="Shift status"
                      label={statusPresentation.label}
                      tone={statusPresentation.tone}
                    />
                  ) : null}
                  {shift.pauseState?.personallyPaused ? (
                    <StatusBadge label="Personal pause active" tone="warning" />
                  ) : null}
                  {shift.pauseState?.allPaused ? (
                    <StatusBadge label="Crew pause active" tone="warning" />
                  ) : null}
                </View>
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
                {shift.discardedAt ? (
                  <DetailRow
                    label="Discarded"
                    value={formatDateTime(shift.discardedAt)}
                  />
                ) : null}
                {shift.discardReason ? (
                  <DetailRow
                    label="Discard reason"
                    value={formatStatusLabel(shift.discardReason)}
                  />
                ) : null}
              </View>
            </Card>

            <Card testID="foreman-shift-info-card">
              <View style={styles.cardContent}>
                <SectionHeader
                  supportingText="Identifiers and location returned for this shift."
                  title="Shift information"
                />
                <DetailRow label="Company" value={shift.companyName} />
                <DetailRow label="Join code" value={shift.joinCode} />
                {shift.location?.trim() ? (
                  <DetailRow label="Location" value={shift.location} />
                ) : null}
              </View>
            </Card>

            <Card testID="foreman-shift-rates-card">
              <View style={styles.cardContent}>
                <SectionHeader
                  supportingText="Shift snapshots returned by the backend. No pay is calculated on this screen."
                  title="Rates and default break"
                />
                <DetailRow
                  label="Worker hourly rate"
                  value={formatMoneyWithCurrencyLabel(
                    shift.defaultHourlyRate,
                    shift.currencyLabel
                  )}
                />
                {shift.foremanHourlyRate !== undefined ? (
                  <DetailRow
                    label="Foreman hourly rate"
                    value={formatMoneyWithCurrencyLabel(
                      shift.foremanHourlyRate,
                      shift.currencyLabel
                    )}
                  />
                ) : null}
                <DetailRow
                  label="Default break"
                  value={`${shift.defaultBreakMinutes} min`}
                />
              </View>
            </Card>

            <Card testID="foreman-shift-pause-card">
              <View style={styles.cardContent}>
                <SectionHeader
                  supportingText="Returned crew and personal pause state for the owner foreman."
                  title="Pause status"
                />
                {shift.pauseState ? (
                  <>
                    <DetailRow
                      label="Personal pause"
                      value={
                        shift.pauseState.personallyPaused ? "Active" : "Not active"
                      }
                    />
                    {shift.pauseState.personalPauseStartedAt ? (
                      <DetailRow
                        label="Personal pause started"
                        value={formatDateTime(
                          shift.pauseState.personalPauseStartedAt
                        )}
                      />
                    ) : null}
                    <DetailRow
                      label="Crew pause"
                      value={shift.pauseState.allPaused ? "Active" : "Not active"}
                    />
                    {shift.pauseState.allPauseStartedAt ? (
                      <DetailRow
                        label="Crew pause started"
                        value={formatDateTime(shift.pauseState.allPauseStartedAt)}
                      />
                    ) : null}
                    {shift.pauseState.effectivePauseMinutes !== null ? (
                      <DetailRow
                        label="Foreman effective pause"
                        value={formatPauseMinutes(
                          shift.pauseState.effectivePauseMinutes
                        )}
                      />
                    ) : null}
                  </>
                ) : (
                  <Feedback
                    message={missingPauseStateMessage}
                    testID="foreman-shift-pause-unavailable"
                    title="Pause state unavailable"
                  />
                )}
              </View>
            </Card>

            <Card testID="foreman-shift-actions-card">
              <View style={styles.cardContent}>
                <SectionHeader
                  supportingText="Only actions valid for the current backend lifecycle are shown."
                  title="Shift actions"
                />
                <View style={styles.actions}>
                  {canStart ? (
                    <Button
                      disabled={actionBlocked}
                      label="Start shift"
                      leadingIcon="play"
                      loading={mutation?.type === "start"}
                      onPress={handleStart}
                      testID="foreman-shift-start"
                    />
                  ) : null}
                  {canPause ? (
                    <>
                      <Button
                        disabled={actionBlocked}
                        label={
                          shift.pauseState?.personallyPaused
                            ? "Resume myself"
                            : "Pause myself"
                        }
                        leadingIcon={
                          shift.pauseState?.personallyPaused ? "play" : "pause"
                        }
                        loading={mutation?.type === "pause-self"}
                        onPress={handleToggleSelfPause}
                        testID="foreman-shift-self-pause"
                        variant="secondary"
                      />
                      <Button
                        disabled={actionBlocked}
                        label={
                          shift.pauseState?.allPaused
                            ? "Resume everyone"
                            : "Pause everyone"
                        }
                        leadingIcon={
                          shift.pauseState?.allPaused ? "play" : "pause"
                        }
                        loading={mutation?.type === "pause-all"}
                        onPress={handleToggleAllPause}
                        testID="foreman-shift-all-pause"
                        variant="secondary"
                      />
                    </>
                  ) : null}
                  {canClose ? (
                    <Button
                      disabled={actionBlocked}
                      label="Close shift"
                      leadingIcon="stop"
                      loading={mutation?.type === "close"}
                      onPress={() => handleClose(false)}
                      testID="foreman-shift-close"
                    />
                  ) : null}
                  {canShowSummary ? (
                    <Button
                      disabled={actionBlocked}
                      label="Open summary"
                      leadingIcon="document"
                      onPress={handleOpenSummary}
                      testID="foreman-shift-summary"
                      variant="secondary"
                    />
                  ) : null}
                  <Button
                    disabled={actionBlocked}
                    label="Refresh"
                    leadingIcon="refresh"
                    loading={shiftLoading || attendanceLoading}
                    onPress={handleRetry}
                    testID="foreman-shift-refresh"
                    variant="secondary"
                  />
                </View>
              </View>
            </Card>

            {shortShiftDecisionOpen ? (
              <Card subtle testID="foreman-short-shift-decision">
                <View style={styles.cardContent}>
                  <SectionHeader
                    supportingText={shortShiftDecisionMessage}
                    title="Short shift decision"
                  />
                  <Button
                    disabled={mutation !== null}
                    label="Save shift"
                    loading={mutation?.type === "close"}
                    onPress={() => handleClose(true)}
                    testID="foreman-short-shift-save"
                  />
                  <Button
                    disabled={mutation !== null}
                    label="Keep active"
                    onPress={handleKeepShortShiftActive}
                    testID="foreman-short-shift-keep"
                    variant="secondary"
                  />
                  <Button
                    disabled={mutation !== null}
                    label="Discard short shift"
                    loading={mutation?.type === "discard"}
                    onPress={handleDiscardShortShift}
                    testID="foreman-short-shift-discard"
                    variant="destructive"
                  />
                </View>
              </Card>
            ) : null}

            {canCancel ? (
              <Card subtle testID="foreman-shift-destructive-card">
                <View style={styles.cardContent}>
                  <SectionHeader
                    supportingText="Cancellation is only available before this shift starts."
                    title="Destructive action"
                  />
                  <Button
                    disabled={actionBlocked}
                    label="Cancel shift"
                    loading={mutation?.type === "cancel"}
                    onPress={handleConfirmCancel}
                    testID="foreman-shift-cancel"
                    variant="destructive"
                  />
                </View>
              </Card>
            ) : null}

            <View style={styles.section} testID="foreman-shift-attendance-section">
              <SectionHeader
                supportingText="Worker attendance, returned pause state and finalized pay data."
                title="Attendance"
              />

              {attendanceLoading && attendance.length === 0 ? (
                <Feedback
                  loading
                  message="Fetching workers for this shift."
                  mode="screen"
                  testID="foreman-attendance-loading"
                  title="Loading attendance"
                />
              ) : attendanceError && attendance.length === 0 ? (
                <Feedback
                  action={{
                    label: "Retry",
                    onPress: handleRetry,
                    testID: "foreman-attendance-retry"
                  }}
                  message={attendanceError}
                  mode="screen"
                  testID="foreman-attendance-error"
                  title="Could not load attendance"
                  tone="error"
                />
              ) : attendance.length === 0 ? (
                <Feedback
                  message={
                    canApproveAttendance
                      ? "No workers have joined this shift yet."
                      : "No attendance records were returned for this shift."
                  }
                  mode="screen"
                  testID="foreman-attendance-empty"
                  title="No attendance"
                />
              ) : (
                <View style={styles.list}>
                  {attendanceError ? (
                    <Feedback
                      action={{ label: "Retry refresh", onPress: handleRetry }}
                      message={attendanceError}
                      testID="foreman-attendance-refresh-error"
                      title="Could not refresh attendance"
                      tone="error"
                    />
                  ) : null}
                  {attendance.map((item) => {
                    const attendanceStatus = getAttendanceStatusPresentation(
                      item.status
                    );
                    const paymentStatus = item.paymentStatus
                      ? getPaymentStatusPresentation(item.paymentStatus)
                      : undefined;
                    const canApprove =
                      canApproveAttendance && item.status === "JOINED";
                    const finalPay =
                      shift.status === "CLOSED" &&
                      item.status === "APPROVED" &&
                      item.calculatedSalary !== null;

                    return (
                      <Card
                        key={item.attendanceId}
                        testID={`foreman-attendance-${item.attendanceId}`}
                      >
                        <View style={styles.cardContent}>
                          <View style={styles.attendanceHeader}>
                            <View style={styles.workerCopy}>
                              <Text allowFontScaling style={styles.workerName}>
                                {item.firstName} {item.lastName}
                              </Text>
                              <Text allowFontScaling style={styles.workerMeta}>
                                Worker #{item.workerId}
                              </Text>
                            </View>
                            <View style={styles.attendanceBadges}>
                              <StatusBadge
                                accessibilityLabel="Attendance status"
                                label={attendanceStatus.label}
                                tone={attendanceStatus.tone}
                              />
                              {paymentStatus && shift.status !== "DISCARDED" ? (
                                <StatusBadge
                                  accessibilityLabel="Payment status"
                                  label={paymentStatus.label}
                                  tone={paymentStatus.tone}
                                />
                              ) : null}
                              {item.pauseState?.personallyPaused ? (
                                <StatusBadge
                                  label="Personal pause active"
                                  tone="warning"
                                />
                              ) : null}
                              {item.pauseState?.allPaused ? (
                                <StatusBadge
                                  label="Crew pause active"
                                  tone="warning"
                                />
                              ) : null}
                            </View>
                          </View>

                          <View style={styles.rows}>
                            <DetailRow
                              label="Joined"
                              value={formatDateTime(item.joinedAt)}
                            />
                            {item.approvedAt ? (
                              <DetailRow
                                label="Approved"
                                value={formatDateTime(item.approvedAt)}
                              />
                            ) : null}
                            <DetailRow
                              label="Hourly rate"
                              value={formatMoneyWithCurrencyLabel(
                                item.hourlyRate,
                                item.currencyLabel
                              )}
                            />
                            <DetailRow
                              label="Break"
                              value={`${item.breakMinutes} min`}
                            />
                            {item.payableStartTime ? (
                              <DetailRow
                                label="Payable start"
                                value={formatDateTime(item.payableStartTime)}
                              />
                            ) : null}
                            {item.pauseMinutes !== null &&
                            item.pauseMinutes !== undefined ? (
                              <DetailRow
                                label="Pause time"
                                value={formatPauseMinutes(item.pauseMinutes)}
                              />
                            ) : null}
                            {item.workedMinutes !== null ? (
                              <DetailRow
                                label="Worked time"
                                value={formatMinutes(item.workedMinutes)}
                              />
                            ) : null}
                            {item.calculatedSalary !== null ? (
                              <DetailRow
                                label="Calculated salary"
                                value={formatMoneyWithCurrencyLabel(
                                  item.calculatedSalary,
                                  item.currencyLabel
                                )}
                              />
                            ) : null}
                            {item.paidAt ? (
                              <DetailRow
                                label="Paid"
                                value={formatDateTime(item.paidAt)}
                              />
                            ) : null}
                            {item.pauseState?.personalPauseStartedAt ? (
                              <DetailRow
                                label="Worker personal pause started"
                                value={formatDateTime(
                                  item.pauseState.personalPauseStartedAt
                                )}
                              />
                            ) : null}
                            {item.pauseState?.allPauseStartedAt ? (
                              <DetailRow
                                label="Worker crew pause started"
                                value={formatDateTime(
                                  item.pauseState.allPauseStartedAt
                                )}
                              />
                            ) : null}
                            {item.pauseState?.effectivePauseMinutes !== null &&
                            item.pauseState?.effectivePauseMinutes !== undefined ? (
                              <DetailRow
                                label="Current effective pause"
                                value={formatPauseMinutes(
                                  item.pauseState.effectivePauseMinutes
                                )}
                              />
                            ) : null}
                          </View>

                          {shift.status === "DISCARDED" ? (
                            <Feedback
                              message="The backend returned this attendance as non-payable for a discarded shift."
                              title="Not payable"
                            />
                          ) : null}

                          {finalPay ? (
                            item.payCalculation?.snapshotStatus === "COMPLETE" ? (
                              <PayCalculationBreakdown
                                calculation={item.payCalculation}
                                currencyLabel={item.currencyLabel}
                              />
                            ) : item.payCalculation?.snapshotStatus ===
                              "UNAVAILABLE" ? (
                              <Feedback
                                message="The backend returned an unavailable calculation snapshot. No breakdown is inferred or recalculated."
                                testID={`foreman-attendance-breakdown-unavailable-${item.attendanceId}`}
                                title="Pay breakdown unavailable"
                              />
                            ) : (
                              <Feedback
                                message="No calculation snapshot was returned. The stored calculated salary remains authoritative."
                                testID={`foreman-attendance-breakdown-absent-${item.attendanceId}`}
                                title="Historical breakdown unavailable"
                              />
                            )
                          ) : null}

                          {canApprove ? (
                            <Button
                              accessibilityLabel={`Approve attendance for ${item.firstName} ${item.lastName}`}
                              disabled={actionBlocked}
                              label="Approve attendance"
                              loading={
                                mutation?.type === "approve" &&
                                mutation.attendanceId === item.attendanceId
                              }
                              onPress={() => handleApprove(item.attendanceId)}
                              testID={`foreman-attendance-approve-${item.attendanceId}`}
                              variant="secondary"
                            />
                          ) : null}
                        </View>
                      </Card>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        ) : (
          <Feedback
            action={{ label: "Retry", onPress: handleRetry }}
            message="No authoritative shift details are available."
            mode="screen"
            title="No shift details"
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    gap: theme.gap.section
  },
  cardContent: {
    width: "100%",
    gap: theme.space[3]
  },
  badges: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space[2]
  },
  actions: {
    width: "100%",
    gap: theme.space[2]
  },
  section: {
    width: "100%",
    gap: theme.space[3]
  },
  list: {
    width: "100%",
    gap: theme.space[3]
  },
  attendanceHeader: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: theme.space[3]
  },
  workerCopy: {
    minWidth: theme.target.min,
    flexGrow: 1,
    flexShrink: 1,
    gap: theme.space[1]
  },
  workerName: {
    ...theme.typography.cardTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  workerMeta: {
    ...theme.typography.caption,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  attendanceBadges: {
    maxWidth: "100%",
    flexShrink: 1,
    alignItems: "flex-start",
    gap: theme.space[1]
  },
  rows: {
    width: "100%",
    borderTopWidth: theme.border.default,
    borderTopColor: theme.colors.border,
    paddingTop: theme.space[2]
  }
});
