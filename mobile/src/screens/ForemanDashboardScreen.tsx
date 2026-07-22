import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, typography } from "../utils/theme";

export function ForemanDashboardScreen() {
  const { user, signOut } = useAuth();

  const handleLogout = () => {
    void signOut();
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

        <StateMessage
          message="Managed shift screens are planned for the next mobile milestone."
          title="Mobile foundation ready"
        />

        <View style={styles.actions}>
          <Button disabled label="Create shift" />
          <Button disabled label="Managed shifts" variant="secondary" />
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
