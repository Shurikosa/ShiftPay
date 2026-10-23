import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../utils/theme";

export function MoreScreen() {
  return (
    <SafeAreaView
      accessible={false}
      style={styles.container}
      testID="more-empty-destination"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.canvas,
    flex: 1
  }
});
