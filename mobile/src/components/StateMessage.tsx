import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../utils/theme";

type StateMessageProps = {
  title: string;
  message?: string;
  loading?: boolean;
  tone?: "neutral" | "error" | "success";
};

export function StateMessage({
  title,
  message,
  loading = false,
  tone = "neutral"
}: StateMessageProps) {
  return (
    <View style={[styles.container, tone === "error" && styles.error, tone === "success" && styles.success]}>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md
  },
  error: {
    borderColor: colors.error,
    backgroundColor: colors.errorSoft
  },
  success: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft
  },
  textBlock: {
    flex: 1,
    gap: spacing.xs
  },
  title: {
    ...typography.label,
    color: colors.text
  },
  message: {
    ...typography.caption,
    color: colors.textSecondary
  }
});
