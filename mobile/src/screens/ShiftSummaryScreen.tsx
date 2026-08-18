import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getErrorMessage } from "../api/errors";
import { getShiftSummary } from "../api/shifts";
import { Button } from "../components/Button";
import { DetailRow } from "../components/DetailRow";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import type { ForemanStackParamList } from "../types/navigation";
import type { ShiftSummary } from "../types/shifts";
import { formatMoney, formatMinutes, formatRate } from "../utils/format";
import { getShiftStatusTone } from "../utils/status";
import { colors, radii, spacing, typography } from "../utils/theme";

type ShiftSummaryScreenProps = NativeStackScreenProps<
  ForemanStackParamList,
  "ShiftSummary"
>;

export function ShiftSummaryScreen({ navigation, route }: ShiftSummaryScreenProps) {
  const { shiftId, shiftTitle } = route.params;
  const { authenticatedRequest } = useAuth();
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextSummary = await authenticatedRequest((token) =>
        getShiftSummary(token, shiftId)
      );
      setSummary(nextSummary);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest, shiftId]);

  useFocusEffect(
    useCallback(() => {
      void loadSummary();
      return undefined;
    }, [loadSummary])
  );

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Shift summary</Text>
          <Text style={styles.title}>{shiftTitle ?? `Shift #${shiftId}`}</Text>
          <Text style={styles.subtitle}>Stored backend salary results for approved workers.</Text>
        </View>

        {loading ? (
          <StateMessage loading title="Loading summary" message="Fetching final shift totals." />
        ) : error ? (
          <View style={styles.stateBlock}>
            <StateMessage
              title="Summary not available"
              message={error}
              tone="error"
            />
            <Button
              label="Retry"
              onPress={() => {
                void loadSummary();
              }}
              variant="secondary"
            />
          </View>
        ) : summary ? (
          <>
            <View style={styles.badges}>
              <StatusBadge label={summary.status} tone={getShiftStatusTone(summary.status)} />
            </View>

            <View style={styles.panel}>
              <DetailRow label="Total workers" value={String(summary.totalWorkers)} />
              <DetailRow label="Total salary" value={formatMoney(summary.totalSalary)} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Workers</Text>
              {summary.workers.length === 0 ? (
                <StateMessage
                  title="No approved workers"
                  message="Closed shifts with no approved attendance have zero summary rows."
                />
              ) : (
                <View style={styles.list}>
                  {summary.workers.map((worker) => (
                    <View key={worker.attendanceId} style={styles.workerCard}>
                      <Text style={styles.workerName}>
                        {worker.firstName} {worker.lastName}
                      </Text>
                      <View style={styles.compactRows}>
                        <DetailRow label="Worked time" value={formatMinutes(worker.workedMinutes)} />
                        <DetailRow label="Hourly rate" value={formatRate(worker.hourlyRate)} />
                        <DetailRow label="Salary" value={formatMoney(worker.salary)} />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : (
          <StateMessage title="No summary" message="Could not load summary details." />
        )}

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
  stateBlock: {
    gap: spacing.md
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
  workerCard: {
    gap: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: spacing.md
  },
  workerName: {
    ...typography.label,
    color: colors.text
  },
  compactRows: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm
  }
});
