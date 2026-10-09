import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../utils/theme";
import { AppIcon } from "./AppIcon";

export type ScreenHeaderAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
};

export type ScreenHeaderProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  backAction?: ScreenHeaderAction;
  action?: ScreenHeaderAction;
  children?: ReactNode;
};

function HeaderActionButton({
  action,
  back = false,
  trailing = false
}: {
  action: ScreenHeaderAction;
  back?: boolean;
  trailing?: boolean;
}) {
  const isBusy = action.busy === true;
  const isDisabled = action.disabled === true || isBusy;

  return (
    <Pressable
      accessible
      accessibilityLabel={action.label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: isBusy }}
      aria-busy={isBusy}
      aria-disabled={isDisabled}
      disabled={isDisabled}
      onPress={isDisabled ? undefined : action.onPress}
      style={({ pressed }) => [
        styles.action,
        trailing && styles.trailingAction,
        pressed && !isDisabled && styles.actionPressed,
        isDisabled && styles.actionDisabled
      ]}
    >
      {back ? <AppIcon name="back" size="control" tone="brand" /> : null}
      {isBusy ? (
        <ActivityIndicator
          accessibilityElementsHidden
          accessible={false}
          aria-hidden
          color={theme.colors.brand.primary}
          importantForAccessibility="no-hide-descendants"
          size="small"
        />
      ) : null}
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
          {backAction ? <HeaderActionButton action={backAction} back /> : null}
          {action ? <HeaderActionButton action={action} trailing /> : null}
        </View>
      ) : null}
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
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
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: theme.space[1],
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space[2]
  },
  actionPressed: {
    backgroundColor: theme.colors.brand.tint,
    transform: [{ translateY: theme.border.default }]
  },
  trailingAction: {
    marginLeft: "auto"
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
