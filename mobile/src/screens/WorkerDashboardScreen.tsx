import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, typography } from "../utils/theme";

export function WorkerDashboardScreen() {
  const { user, signOut } = useAuth();

  const handleLogout = () => {
    void signOut();
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

        <StateMessage
          message="Shift join and history screens are planned for the next mobile milestone."
          title="Mobile foundation ready"
        />

        <View style={styles.actions}>
          <Button disabled label="Join shift" />
          <Button disabled label="My shift history" variant="secondary" />
          <Button label="Log out" onPress={handleLogout} variant="ghost" />
        </View>
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
  }
});
