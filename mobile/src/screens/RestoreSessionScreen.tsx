import { StyleSheet, View } from "react-native";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";

export function RestoreSessionScreen() {
  return (
    <Screen scroll={false}>
      <View style={styles.container}>
        <StateMessage loading title="Restoring session" message="Checking saved sign-in state." />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center"
  }
});
