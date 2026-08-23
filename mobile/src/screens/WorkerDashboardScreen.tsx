import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { WorkerShiftCard } from "../components/WorkerShiftCard";
import { useAuth } from "../context/AuthContext";
import { useWorkerShiftHistory } from "../hooks/useWorkerShiftHistory";
import type { WorkerStackParamList } from "../types/navigation";
import { colors, radii, spacing, typography } from "../utils/theme";

type WorkerDashboardScreenProps = NativeStackScreenProps<
  WorkerStackParamList,
  "WorkerDashboard"
>;

const RECENT_SHIFT_LIMIT = 3;

export function WorkerDashboardScreen({ navigation }: WorkerDashboardScreenProps) {
  const { user, signOut } = useAuth();
  const { shifts, loading, error, refresh } = useWorkerShiftHistory();
  const company = user?.company ?? null;
  const recentShifts = shifts.slice(0, RECENT_SHIFT_LIMIT);

  const handleLogout = () => {
    void signOut();
  };

  const handleRetry = () => {
    void refresh().catch(() => undefined);
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Worker dashboard</Text>
          <Text style={styles.title}>
            {user ? `${user.firstName} ${user.lastName}` : "Worker"}
          </Text>
          <Text style={styles.subtitle}>Join shifts and review your attendance history.</Text>
        </View>

        {company ? (
          <View style={styles.companyPanel}>
            <Text style={styles.companyLabel}>Company</Text>
            <Text style={styles.companyName}>{company.name}</Text>
          </View>
        ) : (
          <StateMessage
            title="Company required"
            message="Join your company before joining shifts."
            tone="error"
          />
        )}

        <View style={styles.actions}>
          <Button
            disabled={!company}
            label="Join shift"
            onPress={() => {
              navigation.navigate("JoinShift");
            }}
          />
          <Button
            label="My shift history"
            onPress={() => {
              navigation.navigate("MyShiftHistory");
            }}
            variant="secondary"
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent shifts</Text>
            {shifts.length > RECENT_SHIFT_LIMIT ? (
              <Button
                label="View all"
                onPress={() => {
                  navigation.navigate("MyShiftHistory");
                }}
                variant="ghost"
              />
            ) : null}
          </View>

          {loading ? (
            <StateMessage loading title="Loading shifts" message="Fetching your worker history." />
          ) : error ? (
            <View style={styles.stateBlock}>
              <StateMessage title="Could not load shifts" message={error} tone="error" />
              <Button label="Retry" onPress={handleRetry} variant="secondary" />
            </View>
          ) : recentShifts.length === 0 ? (
            <View style={styles.stateBlock}>
              <StateMessage
                title="No shifts joined"
                message="Join a shift with the code from your foreman."
              />
              <Button
                disabled={!company}
                label="Join shift"
                onPress={() => {
                  navigation.navigate("JoinShift");
                }}
                variant="secondary"
              />
            </View>
          ) : (
            <View style={styles.list}>
              {recentShifts.map((shift) => (
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
        </View>

        <Button label="Log out" onPress={handleLogout} variant="ghost" />
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
  actions: {
    gap: spacing.md
  },
  companyPanel: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: radii.card
  },
  companyLabel: {
    ...typography.caption,
    color: colors.textMuted
  },
  companyName: {
    ...typography.label,
    color: colors.text
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
  stateBlock: {
    gap: spacing.md
  },
  list: {
    gap: spacing.md
  }
});
