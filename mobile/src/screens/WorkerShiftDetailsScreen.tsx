import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { endMyPause, startMyPause } from "../api/shifts";
import { Button } from "../components/Button";
import { DetailRow } from "../components/DetailRow";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useWorkerShiftHistory } from "../hooks/useWorkerShiftHistory";
import type { WorkerStackParamList } from "../types/navigation";
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
import { getAttendanceStatusTone, getShiftStatusTone } from "../utils/status";
import { colors, radii, spacing, typography } from "../utils/theme";

type WorkerShiftDetailsScreenProps = NativeStackScreenProps<
  WorkerStackParamList,
  "WorkerShiftDetails"
>;

type MutationName = "pause-self" | "refresh";

export function WorkerShiftDetailsScreen({
  navigation,
  route
}: WorkerShiftDetailsScreenProps) {
  const { authenticatedRequest } = useAuth();
  const { refresh } = useWorkerShiftHistory({ loadOnFocus: false });
  const [shift, setShift] = useState(route.params.shift);
  const [mutation, setMutation] = useState<MutationName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const mutationInFlightRef = useRef(false);

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

  const refreshShift = async () => {
    const nextShifts = await refresh();
    const nextShift = nextShifts.find(
      (item) => item.attendanceId === shift.attendanceId
    );

    if (!nextShift) {
      throw new Error("This shift is no longer available in your history.");
    }

    setShift(nextShift);
  };

  const handleRefresh = () => {
    if (!beginMutation("refresh")) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    void refreshShift()
      .catch((caughtError) => {
        setError(getPauseActionErrorMessage(caughtError));
      })
      .finally(() => {
        finishMutation();
      });
  };

  const handleTogglePause = () => {
    if (!shift.pauseState) {
      setSuccessMessage(null);
      setError(missingPauseStateMessage);
      return;
    }

    if (!beginMutation("pause-self")) {
      return;
    }

    const wasPaused = shift.pauseState.personallyPaused;
    const nextAction = wasPaused ? endMyPause : startMyPause;

    setError(null);
    setSuccessMessage(null);

    void authenticatedRequest((token) => nextAction(token, shift.shiftId))
      .then(() =>
        refreshShift().then(() => {
          setSuccessMessage(wasPaused ? "Your pause ended." : "Your pause started.");
        })
      )
      .catch((caughtError) => {
        setError(getPauseActionErrorMessage(caughtError));
      })
      .finally(() => {
        finishMutation();
      });
  };

  const isMutating = mutation !== null;
  const isActiveJoinedShift =
    shift.status === "ACTIVE" &&
    shift.attendanceStatus !== "REJECTED" &&
    shift.attendanceStatus !== "CANCELLED";
  const canPause = isActiveJoinedShift && Boolean(shift.pauseState);
  const needsPauseStateRefresh = isActiveJoinedShift && !shift.pauseState;

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Shift details</Text>
          <Text style={styles.title}>{shift.title}</Text>
          <Text style={styles.subtitle}>{formatOptionalLocation(shift.location)}</Text>
        </View>

        <View style={styles.badges}>
          <StatusBadge label={shift.status} tone={getShiftStatusTone(shift.status)} />
          <StatusBadge
            label={shift.attendanceStatus}
            tone={getAttendanceStatusTone(shift.attendanceStatus)}
          />
          {isPaused(shift.pauseState) ? (
            <StatusBadge label="PAUSED" tone="warning" />
          ) : null}
        </View>

        {successMessage ? (
          <StateMessage title="Updated" message={successMessage} tone="success" />
        ) : null}
        {error ? <StateMessage title="Pause action failed" message={error} tone="error" /> : null}

        <View style={styles.panel}>
          <DetailRow label="Company" value={shift.companyName} />
          <DetailRow label="Actual start" value={formatDateTime(shift.actualStartTime)} />
          <DetailRow label="Actual end" value={formatDateTime(shift.actualEndTime)} />
          <DetailRow label="Hourly rate" value={formatRate(shift.hourlyRate)} />
          <DetailRow label="Break" value={`${shift.breakMinutes} min`} />
          <DetailRow label="Pause time" value={formatPauseMinutes(shift.pauseMinutes)} />
          <DetailRow label="Worked time" value={formatMinutes(shift.workedMinutes)} />
          <DetailRow label="Calculated salary" value={formatMoney(shift.calculatedSalary)} />
        </View>

        {canPause ? (
          <Button
            disabled={isMutating}
            label={shift.pauseState?.personallyPaused ? "Resume" : "Pause"}
            loading={mutation === "pause-self"}
            onPress={handleTogglePause}
            variant="secondary"
          />
        ) : null}
        {needsPauseStateRefresh ? (
          <StateMessage
            title="Pause state unavailable"
            message={missingPauseStateMessage}
          />
        ) : null}
        {isActiveJoinedShift ? (
          <Button
            disabled={isMutating}
            label="Refresh"
            loading={mutation === "refresh"}
            onPress={handleRefresh}
            variant="secondary"
          />
        ) : null}

        <Button
          label="Back"
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
  }
});
