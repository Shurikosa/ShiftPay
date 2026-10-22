import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Feedback } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { useAuth } from "../context/AuthContext";
import { useLogoutAction } from "../hooks/useLogoutAction";
import { theme } from "../utils/theme";

export function UnsupportedRoleScreen() {
  const { user } = useAuth();
  const { loggingOut, logoutError, requestLogout } = useLogoutAction();
  const accountEmail =
    typeof user?.email === "string" && user.email.trim().length > 0
      ? user.email
      : null;

  return (
    <Screen scroll>
      <View style={styles.page} testID="unsupported-role-content">
        <View style={styles.header} testID="unsupported-role-header">
          <Text allowFontScaling style={styles.brand}>
            ShiftPay
          </Text>
          <Text
            accessibilityRole="header"
            allowFontScaling
            style={styles.title}
          >
            Unsupported mobile role
          </Text>
          {accountEmail ? (
            <Text allowFontScaling style={styles.email}>
              {accountEmail}
            </Text>
          ) : null}
        </View>

        <View style={styles.feedback} testID="unsupported-role-state">
          <Feedback
            message="Mobile MVP supports worker and foreman accounts. Admin work is handled in the backend Vaadin dashboard."
            mode="screen"
            testID="unsupported-role-feedback"
            title="Admin role is not available here"
            tone="warning"
          />
        </View>

        <View style={styles.actions} testID="unsupported-role-actions">
          {logoutError ? (
            <Feedback
              message={logoutError}
              testID="unsupported-role-logout-error"
              title="Could not log out"
              tone="error"
            />
          ) : null}
          <Button
            accessibilityHint="Signs out of this account and returns to the sign-in flow."
            label="Log out"
            leadingIcon="logout"
            loading={loggingOut}
            onPress={requestLogout}
            testID="unsupported-role-logout"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    justifyContent: "center",
    gap: theme.gap.section,
    maxWidth: "100%",
    width: "100%"
  },
  header: {
    alignItems: "center",
    flexShrink: 1,
    gap: theme.space[2],
    maxWidth: "100%"
  },
  brand: {
    ...theme.typography.screenTitle,
    color: theme.colors.brand.primary,
    flexShrink: 1,
    textAlign: "center"
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.ink.primary,
    flexShrink: 1,
    textAlign: "center"
  },
  email: {
    ...theme.typography.body,
    color: theme.colors.ink.secondary,
    flexShrink: 1,
    textAlign: "center"
  },
  feedback: {
    alignSelf: "stretch",
    flexShrink: 1,
    maxWidth: "100%"
  },
  actions: {
    alignSelf: "stretch",
    flexShrink: 1,
    maxWidth: "100%"
  }
});
