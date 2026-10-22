import { StyleSheet, Text, View } from "react-native";
import { Feedback } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { useAuth } from "../context/AuthContext";
import { theme } from "../utils/theme";

export function RestoreSessionScreen() {
  const { error, retrySessionRecovery, status } = useAuth();
  const recovering = status === "recovering";

  return (
    <Screen scroll={false}>
      <View style={styles.page} testID="restore-session-content">
        <View style={styles.identity} testID="restore-session-identity">
          <Text allowFontScaling style={styles.brand}>
            ShiftPay
          </Text>
        </View>

        <View style={styles.feedback} testID="restore-session-state">
          <Feedback
            action={recovering ? {
              label: "Try again",
              onPress: () => void retrySessionRecovery(),
              testID: "restore-session-retry"
            } : undefined}
            loading={!recovering}
            message={recovering
              ? error ?? "The saved session could not be verified."
              : "Checking saved sign-in state."}
            mode="screen"
            testID="restore-session-feedback"
            title={recovering ? "Session check needs attention" : "Restoring session"}
            tone={recovering ? "error" : "neutral"}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: "center",
    gap: theme.space[6],
    maxWidth: "100%",
    width: "100%"
  },
  identity: {
    alignItems: "center",
    flexShrink: 1,
    maxWidth: "100%"
  },
  brand: {
    ...theme.typography.screenTitle,
    color: theme.colors.brand.primary,
    flexShrink: 1,
    textAlign: "center"
  },
  feedback: {
    alignSelf: "stretch",
    flexShrink: 1,
    maxWidth: "100%"
  }
});
