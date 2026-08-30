import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import {
  approveAttendance,
  cancelShift,
  closeShift,
  endAllPause,
  endMyPause,
  getShiftAttendance,
  getShiftById,
  startAllPause,
  startMyPause,
  startShift
} from "../api/shifts";
import { ApiError, getErrorMessage } from "../api/errors";
import { Button } from "../components/Button";
import { DetailRow } from "../components/DetailRow";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useForemanManagedShifts } from "../hooks/useForemanManagedShifts";
import type { ForemanStackParamList } from "../types/navigation";
import type { ManagedShift, ShiftAttendance } from "../types/shifts";
import {
  formatDateTime,
  formatMoney,
  formatMinutes,
  formatOptionalLocation,
  formatRate
} from "../utils/format";
import {
  formatPauseMinutes,
  getPauseActionErrorMessage,
  isPaused,
  missingPauseStateMessage
} from "../utils/pauseDisplay";
import {
  formatStatusLabel,
  getAttendanceStatusTone,
  getPaymentStatusTone,
  getShiftStatusTone
} from "../utils/status";
import { colors, radii, spacing, typography } from "../utils/theme";

type ForemanShiftDetailsScreenProps = NativeStackScreenProps<
  ForemanStackParamList,
  "ForemanShiftDetails"
>;

type MutationName =
  | "approve"
  | "start"
  | "cancel"
  | "close"
  | "pause-self"
  | "pause-all";

function getShiftActionErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return "Shift can only be cancelled before it starts.";
    }

    if (error.status === 403) {
      return "You are not authorized to cancel this shift.";
    }
  }

  return getErrorMessage(error);
}

export function ForemanShiftDetailsScreen({
  navigation,
  route
}: ForemanShiftDetailsScreenProps) {
  const { shiftId, initialShift } = route.params;
  const { authenticatedRequest, user } = useAuth();
  const { refresh: refreshManagedShifts } = useForemanManagedShifts({ loadOnFocus: false });
  const [shift, setShift] = useState<ManagedShift | null>(initialShift ?? null);
  const [attendance, setAttendance] = useState<ShiftAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mutation, setMutation] = useState<{
    type: MutationName;
    attendanceId?: number;
  } | null>(null);
  const mutationInFlightRef = useRef(false);

  const beginMutation = (nextMutation: {
    type: MutationName;
    attendanceId?: number;
  }): boolean => {
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

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextShift, nextAttendance] = await authenticatedRequest(async (token) =>
        Promise.all([
          getShiftById(token, shiftId),
          getShiftAttendance(token, shiftId)
        ])
      );
      setShift(nextShift);
      setAttendance(nextAttendance);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest, shiftId]);

  useFocusEffect(
    useCallback(() => {
      void loadDetails();
      return undefined;
    }, [loadDetails])
  );

  const refreshAfterMutation = async () => {
    await loadDetails();
    void refreshManagedShifts().catch(() => undefined);
  };

  const handleApprove = (attendanceId: number) => {
    if (!beginMutation({ type: "approve", attendanceId })) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    void authenticatedRequest((token) =>
      approveAttendance(token, shiftId, attendanceId)
    )
      .then(() => {
        setSuccessMessage("Worker attendance approved.");
        return refreshAfterMutation();
      })
      .catch((caughtError) => {
        setError(getErrorMessage(caughtError));
      })
      .finally(() => {
        finishMutation();
      });
  };

  const handleStart = () => {
    if (!beginMutation({ type: "start" })) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    void authenticatedRequest((token) => startShift(token, shiftId))
      .then(() => {
        setSuccessMessage("Shift started.");
        return refreshAfterMutation();
      })
      .catch((caughtError) => {
        setError(getErrorMessage(caughtError));
      })
      .finally(() => {
        finishMutation();
      });
  };

  const handleClose = () => {
    if (!beginMutation({ type: "close" })) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    void authenticatedRequest((token) => closeShift(token, shiftId))
      .then(() => {
        setSuccessMessage("Shift closed. Summary is available.");
        return refreshAfterMutation();
      })
      .catch((caughtError) => {
        setError(getErrorMessage(caughtError));
      })
      .finally(() => {
        finishMutation();
      });
  };

  const handleCancel = () => {
    if (!beginMutation({ type: "cancel" })) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    void authenticatedRequest((token) => cancelShift(token, shiftId))
      .then((cancelledShift) => {
        setShift(cancelledShift);
        setSuccessMessage("Shift cancelled.");
        return refreshAfterMutation();
      })
      .catch((caughtError) => {
        setError(getShiftActionErrorMessage(caughtError));
      })
      .finally(() => {
        finishMutation();
      });
  };

  const handleToggleSelfPause = () => {
    if (!shift) {
      return;
    }

    if (!shift.pauseState) {
      setSuccessMessage(null);
      setError(missingPauseStateMessage);
      return;
    }

    if (!beginMutation({ type: "pause-self" })) {
      return;
    }

    const wasPaused = shift.pauseState.personallyPaused;
    const nextAction = wasPaused ? endMyPause : startMyPause;

    setError(null);
    setSuccessMessage(null);

    void authenticatedRequest((token) => nextAction(token, shiftId))
      .then(() => {
        setSuccessMessage(wasPaused ? "Your pause ended." : "Your pause started.");
        return refreshAfterMutation();
      })
      .catch((caughtError) => {
        setError(getPauseActionErrorMessage(caughtError));
      })
      .finally(() => {
        finishMutation();
      });
  };

  const handleToggleAllPause = () => {
    if (!shift) {
      return;
    }

    if (!shift.pauseState) {
      setSuccessMessage(null);
      setError(missingPauseStateMessage);
      return;
    }

    if (!beginMutation({ type: "pause-all" })) {
      return;
    }

    const wasPaused = shift.pauseState.allPaused;
    const nextAction = wasPaused ? endAllPause : startAllPause;

    setError(null);
    setSuccessMessage(null);

    void authenticatedRequest((token) => nextAction(token, shiftId))
      .then(() => {
        setSuccessMessage(
          wasPaused ? "Pause for everyone ended." : "Pause for everyone started."
        );
        return refreshAfterMutation();
      })
      .catch((caughtError) => {
        setError(getPauseActionErrorMessage(caughtError));
      })
      .finally(() => {
        finishMutation();
      });
  };

  const handleConfirmCancel = () => {
    if (mutationInFlightRef.current) {
      return;
    }

    Alert.alert(
      "Cancel shift?",
      "This can only be done before the shift starts. Workers will no longer be able to join.",
      [
        {
          text: "Keep shift",
          style: "cancel"
        },
        {
          text: "Cancel shift",
          style: "destructive",
          onPress: handleCancel
        }
      ]
    );
  };

  const handleOpenSummary = () => {
    if (mutationInFlightRef.current || !shift) {
      return;
    }

    navigation.navigate("ShiftSummary", {
      shiftId,
      shiftTitle: shift.title
    });
  };

  const isMutating = mutation !== null;
  const canCancel = user?.role === "FOREMAN" && shift?.status === "OPEN";
  const canStart = shift?.status === "OPEN";
  const canClose = shift?.status === "ACTIVE";
  const isActiveForemanShift = user?.role === "FOREMAN" && shift?.status === "ACTIVE";
  const canPause = isActiveForemanShift && Boolean(shift?.pauseState);
  const needsPauseStateRefresh = isActiveForemanShift && !shift?.pauseState;
  const canShowSummary = shift?.status === "CLOSED";
  const canApproveAttendance = shift?.status === "OPEN" || shift?.status === "ACTIVE";
  const hasJoinedAttendance = attendance.some((item) => item.status === "JOINED");

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Foreman shift</Text>
          <Text style={styles.title}>{shift?.title ?? "Shift details"}</Text>
          {shift ? (
            <Text style={styles.subtitle}>{formatOptionalLocation(shift.location)}</Text>
          ) : null}
        </View>

        {successMessage ? (
          <StateMessage title="Updated" message={successMessage} tone="success" />
        ) : null}
        {error ? <StateMessage title="Shift action failed" message={error} tone="error" /> : null}

        {loading && !shift ? (
          <StateMessage loading title="Loading shift" message="Fetching shift details." />
        ) : shift ? (
          <>
            <View style={styles.badges}>
              <StatusBadge label={shift.status} tone={getShiftStatusTone(shift.status)} />
              {isPaused(shift.pauseState) ? (
                <StatusBadge label="PAUSED" tone="warning" />
              ) : null}
            </View>

            <View style={styles.panel}>
              <DetailRow label="Company" value={shift.companyName} />
              <DetailRow label="Join code" value={shift.joinCode} />
              <DetailRow label="Actual start" value={formatDateTime(shift.actualStartTime)} />
              <DetailRow label="Actual end" value={formatDateTime(shift.actualEndTime)} />
              <DetailRow label="Default break" value={`${shift.defaultBreakMinutes} min`} />
              <DetailRow label="Worker hourly rate" value={formatRate(shift.defaultHourlyRate)} />
              {shift.foremanHourlyRate !== undefined ? (
                <DetailRow
                  label="Foreman hourly rate"
                  value={formatRate(shift.foremanHourlyRate)}
                />
              ) : null}
            </View>

            <View style={styles.actions}>
              {canStart ? (
                <Button
                  disabled={isMutating}
                  label="Start shift"
                  loading={mutation?.type === "start"}
                  onPress={handleStart}
                />
              ) : null}
              {canCancel ? (
                <Button
                  disabled={isMutating}
                  label="Cancel shift"
                  loading={mutation?.type === "cancel"}
                  onPress={handleConfirmCancel}
                  variant="secondary"
                />
              ) : null}
              {canPause ? (
                <>
                  <Button
                    disabled={isMutating}
                    label={
                      shift.pauseState?.personallyPaused
                        ? "Resume myself"
                        : "Pause myself"
                    }
                    loading={mutation?.type === "pause-self"}
                    onPress={handleToggleSelfPause}
                    variant="secondary"
                  />
                  <Button
                    disabled={isMutating}
                    label={
                      shift.pauseState?.allPaused
                        ? "Resume everyone"
                        : "Pause everyone"
                    }
                    loading={mutation?.type === "pause-all"}
                    onPress={handleToggleAllPause}
                    variant="secondary"
                  />
                </>
              ) : null}
              {needsPauseStateRefresh ? (
                <StateMessage
                  title="Pause state unavailable"
                  message={missingPauseStateMessage}
                />
              ) : null}
              {canClose ? (
                <Button
                  disabled={isMutating}
                  label="Close shift"
                  loading={mutation?.type === "close"}
                  onPress={handleClose}
                />
              ) : null}
              {canShowSummary ? (
                <Button
                  disabled={isMutating}
                  label="Open summary"
                  onPress={handleOpenSummary}
                  variant="secondary"
                />
              ) : null}
              <Button
                label="Refresh"
                onPress={() => {
                  void loadDetails();
                }}
                variant="secondary"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Attendance</Text>

              {loading ? (
                <StateMessage loading title="Loading attendance" message="Refreshing workers." />
              ) : attendance.length === 0 ? (
                <StateMessage
                  title="No workers joined"
                  message={
                    canApproveAttendance
                      ? "Share the join code with workers while the shift is open or active."
                      : "No attendance records were created for this shift."
                  }
                />
              ) : (
                <View style={styles.list}>
                  {attendance.map((item) => {
                    const canApprove =
                      canApproveAttendance && item.status === "JOINED";

                    return (
                      <View key={item.attendanceId} style={styles.attendanceCard}>
                        <View style={styles.attendanceHeader}>
                          <View style={styles.workerNameBlock}>
                            <Text style={styles.workerName}>
                              {item.firstName} {item.lastName}
                            </Text>
                            <Text style={styles.workerMeta}>Worker #{item.workerId}</Text>
                          </View>
                          <View style={styles.attendanceBadges}>
                            <StatusBadge
                              label={item.status}
                              tone={getAttendanceStatusTone(item.status)}
                            />
                            {item.paymentStatus ? (
                              <StatusBadge
                                label={formatStatusLabel(item.paymentStatus)}
                                tone={getPaymentStatusTone(item.paymentStatus)}
                              />
                            ) : null}
                            {isPaused(item.pauseState) ? (
                              <StatusBadge label="PAUSED" tone="warning" />
                            ) : null}
                          </View>
                        </View>

                        <View style={styles.compactRows}>
                          <DetailRow label="Joined" value={formatDateTime(item.joinedAt)} />
                          <DetailRow label="Approved" value={formatDateTime(item.approvedAt)} />
                          {item.payableStartTime !== undefined ? (
                            <DetailRow
                              label="Payable start"
                              value={formatDateTime(item.payableStartTime)}
                            />
                          ) : null}
                          <DetailRow label="Hourly rate" value={formatRate(item.hourlyRate)} />
                          <DetailRow label="Break" value={`${item.breakMinutes} min`} />
                          <DetailRow
                            label="Pause time"
                            value={formatPauseMinutes(item.pauseMinutes)}
                          />
                          <DetailRow label="Worked time" value={formatMinutes(item.workedMinutes)} />
                          <DetailRow
                            label="Calculated salary"
                            value={formatMoney(item.calculatedSalary)}
                          />
                          {item.paymentStatus ? (
                            <DetailRow
                              label="Payment status"
                              value={formatStatusLabel(item.paymentStatus)}
                            />
                          ) : null}
                          {item.paidAt ? (
                            <DetailRow label="Paid" value={formatDateTime(item.paidAt)} />
                          ) : null}
                        </View>

                        {canApprove ? (
                          <Button
                            disabled={isMutating}
                            label="Approve"
                            loading={
                              mutation?.type === "approve" &&
                              mutation.attendanceId === item.attendanceId
                            }
                            onPress={() => {
                              handleApprove(item.attendanceId);
                            }}
                            variant="secondary"
                          />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}

              {!loading && canApproveAttendance && attendance.length > 0 && !hasJoinedAttendance ? (
                <StateMessage
                  title="No pending approvals"
                  message="All joined workers have already been processed."
                />
              ) : null}
            </View>
          </>
        ) : (
          <StateMessage title="No shift details" message="Could not load this shift." />
        )}

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
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
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
  section: {
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
  attendanceHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  attendanceBadges: {
    alignItems: "flex-end",
    gap: spacing.xs
  },
  workerNameBlock: {
    flex: 1,
    gap: spacing.xs
  },
  workerName: {
    ...typography.label,
    color: colors.text
  },
  workerMeta: {
    ...typography.caption,
    color: colors.textSecondary
  },
  compactRows: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm
  }
});
