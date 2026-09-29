import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from "react-native";
import { theme } from "../utils/theme";

type ButtonVariant = "primary" | "secondary" | "text" | "destructive" | "ghost";

type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  loading?: boolean;
  variant?: ButtonVariant;
  style?: PressableProps["style"];
};

export function Button({
  label,
  loading = false,
  variant = "primary",
  disabled,
  style,
  ...pressableProps
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      {...pressableProps}
      accessibilityLabel={pressableProps.accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ ...pressableProps.accessibilityState, disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        typeof style === "function" ? style({ pressed }) : style,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        pressed && !isDisabled && variant === "primary" && styles.primaryPressed,
        styles.target
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "destructive" ? theme.colors.surface.default : theme.colors.brand.primary} />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space[4]
  },
  target: {
    minHeight: theme.height.control.min,
    minWidth: theme.target.min
  },
  primary: {
    backgroundColor: theme.colors.brand.primary
  },
  secondary: {
    backgroundColor: theme.colors.surface.subtle,
    borderWidth: theme.border.default,
    borderColor: theme.colors.border
  },
  text: {
    borderWidth: 0
  },
  ghost: { borderWidth: 0 },
  destructive: { backgroundColor: theme.colors.danger.fg },
  disabled: {
    opacity: 0.6
  },
  pressed: {
    opacity: 0.86
  },
  primaryPressed: { backgroundColor: theme.colors.brand.pressed },
  label: {
    ...theme.typography.label,
    flexShrink: 1,
    textAlign: "center"
  },
  primaryLabel: {
    color: theme.colors.surface.default
  },
  secondaryLabel: {
    color: theme.colors.ink.primary
  },
  textLabel: { color: theme.colors.brand.primary },
  ghostLabel: { color: theme.colors.brand.primary },
  destructiveLabel: { color: theme.colors.surface.default }
});
