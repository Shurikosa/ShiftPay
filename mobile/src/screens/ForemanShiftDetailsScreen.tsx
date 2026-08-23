import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  approveAttendance,
  closeShift,
  getShiftAttendance,
  getShiftById,
  startShift
} from "../api/shifts";
import { getErrorMessage } from "../api/errors";
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
import { getAttendanceStatusTone, getShiftStatusTone } from "../utils/status";
import { colors, radii, spacing, typography } from "../utils/theme";

type ForemanShiftDetailsScreenProps = NativeStackScreenProps<
  ForemanStackParamList,
  "ForemanShiftDetails"
>;

type MutationName = "approve" | "start" | "close";

export function ForemanShiftDetailsScreen({
  navigation,
  route
}: ForemanShiftDetailsScreenProps) {
  const { shiftId, initialShift } = route.params;
  const { authenticatedRequest } = useAuth();
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
    setMutation({ type: "approve", attendanceId });
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
        setMutation(null);
      });
  };

  const handleStart = () => {
    setMutation({ type: "start" });
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
        setMutation(null);
      });
  };

  const handleClose = () => {
    setMutation({ type: "close" });
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
        setMutation(null);
      });
  };

  const canStart = shift?.status === "OPEN";
  const canClose = shift?.status === "ACTIVE";
  const canShowSummary = shift?.status === "CLOSED";
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
                  label="Start shift"
                  loading={mutation?.type === "start"}
                  onPress={handleStart}
                />
              ) : null}
              {canClose ? (
                <Button
                  label="Close shift"
                  loading={mutation?.type === "close"}
                  onPress={handleClose}
                />
              ) : null}
              {canShowSummary ? (
                <Button
                  label="Open summary"
                  onPress={() => {
                    navigation.navigate("ShiftSummary", {
                      shiftId,
                      shiftTitle: shift.title
                    });
                  }}
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
                  message="Share the join code with workers while the shift is open."
                />
              ) : (
                <View style={styles.list}>
                  {attendance.map((item) => {
                    const canApprove =
                      shift.status === "OPEN" && item.status === "JOINED";

                    return (
                      <View key={item.attendanceId} style={styles.attendanceCard}>
                        <View style={styles.attendanceHeader}>
                          <View style={styles.workerNameBlock}>
                            <Text style={styles.workerName}>
                              {item.firstName} {item.lastName}
                            </Text>
                            <Text style={styles.workerMeta}>Worker #{item.workerId}</Text>
                          </View>
                          <StatusBadge
                            label={item.status}
                            tone={getAttendanceStatusTone(item.status)}
                          />
                        </View>

                        <View style={styles.compactRows}>
                          <DetailRow label="Joined" value={formatDateTime(item.joinedAt)} />
                          <DetailRow label="Approved" value={formatDateTime(item.approvedAt)} />
                          <DetailRow label="Hourly rate" value={formatRate(item.hourlyRate)} />
                          <DetailRow label="Break" value={`${item.breakMinutes} min`} />
                          <DetailRow label="Worked time" value={formatMinutes(item.workedMinutes)} />
                          <DetailRow
                            label="Calculated salary"
                            value={formatMoney(item.calculatedSalary)}
                          />
                        </View>

                        {canApprove ? (
                          <Button
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

              {!loading && shift.status === "OPEN" && attendance.length > 0 && !hasJoinedAttendance ? (
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
