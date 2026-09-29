import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../utils/theme";

type HeaderAction = {
  label: string;
  onPress: () => void;
};

type ScreenHeaderProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  backAction?: HeaderAction;
  action?: HeaderAction;
  children?: ReactNode;
};

function HeaderActionButton({ action }: { action: HeaderAction }) {
  return (
    <Pressable
      accessibilityLabel={action.label}
      accessibilityRole="button"
      onPress={action.onPress}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <Text style={styles.actionLabel}>{action.label}</Text>
    </Pressable>
  );
}

export function ScreenHeader({
  title,
  eyebrow,
  subtitle,
  backAction,
  action,
  children
}: ScreenHeaderProps) {
  return (
    <View style={styles.root}>
      {backAction || action ? (
        <View style={styles.actions}>
          {backAction ? <HeaderActionButton action={backAction} /> : null}
          {action ? <HeaderActionButton action={action} /> : null}
        </View>
      ) : null}
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: theme.space[2]
  },
  actions: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.space[2]
  },
  copy: {
    width: "100%",
    gap: theme.space[1]
  },
  eyebrow: {
    ...theme.typography.caption,
    color: theme.colors.ink.muted
  },
  title: {
    ...theme.typography.screenTitle,
    color: theme.colors.ink.primary
  },
  subtitle: {
    ...theme.typography.supporting,
    color: theme.colors.ink.secondary
  },
  action: {
    minWidth: theme.target.min,
    minHeight: theme.target.min,
    maxWidth: "100%",
    flexShrink: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space[2]
  },
  actionPressed: {
    backgroundColor: theme.colors.brand.tint
  },
  actionLabel: {
    ...theme.typography.label,
    color: theme.colors.brand.primary,
    flexShrink: 1,
    textAlign: "center"
  }
});
