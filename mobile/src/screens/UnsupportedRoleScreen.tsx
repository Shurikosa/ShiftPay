import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, typography } from "../utils/theme";

export function UnsupportedRoleScreen() {
  const { user, signOut } = useAuth();

  const handleLogout = () => {
    void signOut();
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Unsupported mobile role</Text>
          <Text style={styles.subtitle}>{user?.email}</Text>
        </View>
        <StateMessage
          message="Mobile MVP supports worker and foreman accounts. Admin work is handled in the backend Vaadin dashboard."
          title="Admin role is not available here"
          tone="error"
        />
        <Button label="Log out" onPress={handleLogout} />
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
  title: {
    ...typography.screenTitle,
    color: colors.text
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary
  }
});
