import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View
} from "react-native";
import { useState } from "react";
import { theme } from "../utils/theme";

type TrailingAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

type FormFieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  trailingAction?: TrailingAction;
};

export function FormField({ label, error, hint, trailingAction, accessibilityHint, style, onFocus, onBlur, ...inputProps }: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  const composedAccessibilityHint = [accessibilityHint, hint, error]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(". ");
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputShell, focused && styles.focused, Boolean(error) && styles.inputError]}>
        <TextInput autoCapitalize="none" placeholderTextColor={theme.colors.ink.muted} style={[styles.input, style, styles.inputTarget]} onFocus={(event) => { setFocused(true); onFocus?.(event); }} onBlur={(event) => { setFocused(false); onBlur?.(event); }} {...inputProps} accessibilityLabel={inputProps.accessibilityLabel ?? label} accessibilityHint={composedAccessibilityHint || undefined} />
        {trailingAction ? (
          <Pressable
            accessibilityLabel={trailingAction.label}
            accessibilityRole="button"
            accessibilityState={{ disabled: Boolean(trailingAction.disabled) }}
            disabled={Boolean(trailingAction.disabled)}
            onPress={trailingAction.onPress}
            style={({ pressed }) => [
              styles.trailingAction,
              pressed && !trailingAction.disabled && styles.trailingActionPressed,
              trailingAction.disabled && styles.trailingActionDisabled
            ]}
          >
            <Text style={styles.trailingActionLabel}>{trailingAction.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.space[1]
  },
  label: {
    ...theme.typography.label, color: theme.colors.ink.primary
  },
  inputShell: {
    minHeight: theme.height.control.min,
    borderWidth: theme.border.default,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingLeft: theme.space[3],
    backgroundColor: theme.colors.surface.default,
    flexDirection: "row", alignItems: "center"
  },
  input: { flex: 1, color: theme.colors.ink.primary, ...theme.typography.body, paddingVertical: theme.space[2] },
  inputTarget: { minWidth: theme.target.min, minHeight: theme.height.control.min },
  trailingAction: { minWidth: theme.target.min, minHeight: theme.target.min, maxWidth: "45%", flexShrink: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: theme.space[2] },
  trailingActionPressed: { backgroundColor: theme.colors.brand.tint },
  trailingActionDisabled: { opacity: 0.6 },
  trailingActionLabel: { ...theme.typography.label, color: theme.colors.brand.primary, flexShrink: 1 },
  focused: { borderColor: theme.colors.focus, borderWidth: 2 },
  inputError: { borderColor: theme.colors.danger.fg },
  hint: { ...theme.typography.supporting, color: theme.colors.ink.muted },
  error: {
    ...theme.typography.supporting, color: theme.colors.danger.fg
  }
});
