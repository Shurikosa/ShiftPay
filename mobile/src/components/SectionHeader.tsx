import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../utils/theme";
import { AppIcon, type AppIconName } from "./AppIcon";

export type SectionHeaderAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: AppIconName;
};

export type SectionHeaderProps = {
  title: string;
  supportingText?: string;
  action?: SectionHeaderAction;
};

export function SectionHeader({ title, supportingText, action }: SectionHeaderProps) {
  const isActionDisabled = action?.disabled === true;

  return (
    <View style={styles.root}>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {supportingText ? <Text style={styles.supporting}>{supportingText}</Text> : null}
      </View>
      {action ? (
        <Pressable
          accessible
          accessibilityLabel={action.label}
          accessibilityRole="button"
          accessibilityState={{ disabled: isActionDisabled }}
          aria-disabled={isActionDisabled}
          disabled={isActionDisabled}
          onPress={isActionDisabled ? undefined : action.onPress}
          style={({ pressed }) => [
            styles.action,
            pressed && !isActionDisabled && styles.actionPressed,
            isActionDisabled && styles.actionDisabled
          ]}
        >
          {action.icon ? (
            <AppIcon name={action.icon} size="metadata" tone="brand" />
          ) : null}
          <Text style={styles.actionLabel}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: theme.space[2]
  },
  copy: {
    minWidth: theme.target.min,
    flexGrow: 1,
    flexShrink: 1,
    gap: theme.space[1]
  },
  title: {
    ...theme.typography.sectionTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  supporting: {
    ...theme.typography.supporting,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  action: {
    minWidth: theme.target.min,
    minHeight: theme.target.min,
    maxWidth: "100%",
    flexShrink: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.space[1],
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space[2],
    marginLeft: "auto"
  },
  actionPressed: {
    backgroundColor: theme.colors.brand.tint,
    transform: [{ translateY: theme.border.default }]
  },
  actionDisabled: {
    borderWidth: theme.border.default,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
    opacity: 0.6
  },
  actionLabel: {
    ...theme.typography.label,
    color: theme.colors.brand.primary,
    flexShrink: 1,
    textAlign: "center"
  }
});
