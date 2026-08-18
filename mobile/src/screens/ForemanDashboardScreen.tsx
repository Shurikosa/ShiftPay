import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { ManagedShiftCard } from "../components/ManagedShiftCard";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { useAuth } from "../context/AuthContext";
import { useForemanManagedShifts } from "../hooks/useForemanManagedShifts";
import type { ForemanStackParamList } from "../types/navigation";
import { colors, spacing, typography } from "../utils/theme";

type ForemanDashboardScreenProps = NativeStackScreenProps<
  ForemanStackParamList,
  "ForemanDashboard"
>;

export function ForemanDashboardScreen({ navigation }: ForemanDashboardScreenProps) {
  const { user, signOut } = useAuth();
  const { shifts, loading, error, refresh } = useForemanManagedShifts();

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
          <Text style={styles.kicker}>Foreman dashboard</Text>
          <Text style={styles.title}>
            {user ? `${user.firstName} ${user.lastName}` : "Foreman"}
          </Text>
          <Text style={styles.subtitle}>Create shifts and manage crew attendance.</Text>
        </View>

        <Button
          label="Create shift"
          onPress={() => {
            navigation.navigate("CreateShift");
          }}
        />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Managed shifts</Text>
            {shifts.length > 0 ? (
              <Button label="Refresh" onPress={handleRetry} variant="ghost" />
            ) : null}
          </View>

          {loading ? (
            <StateMessage loading title="Loading shifts" message="Fetching managed shifts." />
          ) : error ? (
            <View style={styles.stateBlock}>
              <StateMessage title="Could not load shifts" message={error} tone="error" />
              <Button label="Retry" onPress={handleRetry} variant="secondary" />
            </View>
          ) : shifts.length === 0 ? (
            <View style={styles.stateBlock}>
              <StateMessage
                title="No managed shifts"
                message="Create a shift to get a join code for workers."
              />
              <Button
                label="Create shift"
                onPress={() => {
                  navigation.navigate("CreateShift");
                }}
                variant="secondary"
              />
            </View>
          ) : (
            <View style={styles.list}>
              {shifts.map((shift) => (
                <ManagedShiftCard
                  key={shift.id}
                  shift={shift}
                  onPress={() => {
                    navigation.navigate("ForemanShiftDetails", {
                      shiftId: shift.id,
                      initialShift: shift
                    });
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
