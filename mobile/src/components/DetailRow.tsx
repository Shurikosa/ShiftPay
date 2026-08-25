import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../utils/theme";

type DetailRowProps = {
  label: string;
  value: string;
};

export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.xs,
    paddingVertical: spacing.sm
  },
  label: {
    ...typography.caption,
    color: colors.textMuted
  },
  value: {
    ...typography.body,
    color: colors.text
  }
});
