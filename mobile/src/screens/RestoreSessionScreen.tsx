import { StyleSheet, Text, View } from "react-native";
import { Feedback } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { theme } from "../utils/theme";

export function RestoreSessionScreen() {
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
            loading
            message="Checking saved sign-in state."
            mode="screen"
            testID="restore-session-feedback"
            title="Restoring session"
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
