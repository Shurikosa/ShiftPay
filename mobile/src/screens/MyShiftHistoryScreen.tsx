import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { WorkerShiftCard } from "../components/WorkerShiftCard";
import { useWorkerShiftHistory } from "../hooks/useWorkerShiftHistory";
import type { WorkerStackParamList } from "../types/navigation";
import { colors, spacing, typography } from "../utils/theme";

type MyShiftHistoryScreenProps = NativeStackScreenProps<
  WorkerStackParamList,
  "MyShiftHistory"
>;

export function MyShiftHistoryScreen({ navigation }: MyShiftHistoryScreenProps) {
  const { shifts, loading, error, refresh } = useWorkerShiftHistory();

  const handleRetry = () => {
    void refresh().catch(() => undefined);
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Worker</Text>
          <Text style={styles.title}>My shift history</Text>
          <Text style={styles.subtitle}>Your joined shifts, attendance status, and stored salary results.</Text>
        </View>

        {loading ? (
          <StateMessage loading title="Loading history" message="Fetching your joined shifts." />
        ) : error ? (
          <View style={styles.stateBlock}>
            <StateMessage title="Could not load history" message={error} tone="error" />
            <Button label="Retry" onPress={handleRetry} variant="secondary" />
          </View>
        ) : shifts.length === 0 ? (
          <View style={styles.stateBlock}>
            <StateMessage
              title="No shifts joined"
              message="Join your first shift with the code from your foreman."
            />
            <Button
              label="Join shift"
              onPress={() => {
                navigation.navigate("JoinShift");
              }}
              variant="secondary"
            />
          </View>
        ) : (
          <View style={styles.list}>
            {shifts.map((shift) => (
              <WorkerShiftCard
                key={shift.attendanceId}
                shift={shift}
                onPress={() => {
                  navigation.navigate("WorkerShiftDetails", { shift });
                }}
              />
            ))}
          </View>
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
  stateBlock: {
    gap: spacing.md
  },
  list: {
    gap: spacing.md
  }
});
