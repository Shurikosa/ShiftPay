import { forwardRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps
} from "react-native";
import { theme } from "../utils/theme";
import type {
  AppIconName,
  AppIconProps,
  AppIconTone
} from "./AppIcon";

export type FormFieldTrailingAction = {
  accessibilityHint?: string;
  disabled?: boolean;
  icon?: AppIconName;
  label: string;
  onPress: NonNullable<PressableProps["onPress"]>;
  testID?: string;
};

type ForwardedTextInputProps = Pick<
  TextInputProps,
  | "allowFontScaling"
  | "autoCapitalize"
  | "autoComplete"
  | "autoCorrect"
  | "autoFocus"
  | "caretHidden"
  | "contextMenuHidden"
  | "defaultValue"
  | "editable"
  | "enterKeyHint"
  | "importantForAutofill"
  | "inputMode"
  | "keyboardType"
  | "maxLength"
  | "multiline"
  | "nativeID"
  | "onBlur"
  | "onChange"
  | "onChangeText"
  | "onContentSizeChange"
  | "onEndEditing"
  | "onFocus"
  | "onKeyPress"
  | "onSelectionChange"
  | "onSubmitEditing"
  | "passwordRules"
  | "placeholder"
  | "readOnly"
  | "returnKeyType"
  | "secureTextEntry"
  | "selection"
  | "selectTextOnFocus"
  | "showSoftInputOnFocus"
  | "spellCheck"
  | "submitBehavior"
  | "testID"
  | "textContentType"
  | "value"
>;

export type FormFieldProps = ForwardedTextInputProps & {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  error?: string;
  hint?: string;
  label: string;
  leadingIcon?: AppIconName;
  trailingAction?: FormFieldTrailingAction;
};

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeAccessiblePart(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function containsEquivalentAccessiblePart(context: string, label: string): boolean {
  const normalizedLabel = normalizeAccessiblePart(label);
  if (!normalizedLabel) {
    return false;
  }

  return [context, ...context.split(/[.!?…;:]+/u)].some(
    (part) => normalizeAccessiblePart(part) === normalizedLabel
  );
}

function getAccessibleName(label: string, context?: unknown): string {
  const visibleLabel = label.trim();
  const normalizedContext =
    typeof context === "string" ? context.trim() : undefined;

  if (!normalizedContext) {
    return visibleLabel;
  }

  if (containsEquivalentAccessiblePart(normalizedContext, visibleLabel)) {
    return normalizedContext;
  }

  return `${normalizedContext}. ${visibleLabel}`;
}

function appendAccessibilityDescription(
  initial: unknown,
  parts: readonly unknown[]
): string | undefined {
  const result: string[] = [];
  const normalizedInitial =
    typeof initial === "string" ? initial.trim() : undefined;
  if (normalizedInitial) {
    result.push(normalizedInitial);
  }

  for (const part of parts) {
    const normalizedPart = typeof part === "string" ? part.trim() : undefined;
    if (!normalizedPart) {
      continue;
    }

    const normalized = normalizeAccessiblePart(normalizedPart);
    if (!result.some((item) => normalizeAccessiblePart(item) === normalized)) {
      result.push(normalizedPart);
    }
  }

  return result.length > 0 ? result.join(". ") : undefined;
}

function getLeadingIconTone(
  disabled: boolean,
  hasError: boolean,
  focused: boolean
): AppIconTone {
  if (disabled) {
    return "muted";
  }

  if (hasError) {
    return "error";
  }

  return focused ? "brand" : "secondary";
}

function isSemanticIconName(value: unknown): value is AppIconName {
  if (value === undefined || value === null) {
    return false;
  }

  // Avoid loading native icon code for fields that have no icon slots.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { isAppIconName } = require("./AppIcon") as typeof import("./AppIcon");
  return isAppIconName(value);
}

function SemanticIcon(props: AppIconProps) {
  // Delay native icon work until a semantic icon slot is actually used.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppIcon } = require("./AppIcon") as typeof import("./AppIcon");
  return <AppIcon {...props} />;
}

export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  {
    accessibilityHint,
    accessibilityLabel,
    allowFontScaling,
    autoCapitalize,
    autoComplete,
    autoCorrect,
    autoFocus,
    caretHidden,
    contextMenuHidden,
    defaultValue,
    editable,
    enterKeyHint,
    error,
    hint,
    importantForAutofill,
    inputMode,
    keyboardType,
    label,
    leadingIcon,
    maxLength,
    multiline,
    nativeID,
    onBlur,
    onChange,
    onChangeText,
    onContentSizeChange,
    onEndEditing,
    onFocus,
    onKeyPress,
    onSelectionChange,
    onSubmitEditing,
    passwordRules,
    placeholder,
    readOnly,
    returnKeyType,
    secureTextEntry,
    selection,
    selectTextOnFocus,
    showSoftInputOnFocus,
    spellCheck,
    submitBehavior,
    testID,
    textContentType,
    trailingAction,
    value
  },
  ref
) {
  const [focused, setFocused] = useState(false);

  if (!isNonBlankString(label)) {
    return null;
  }

  const isInputDisabled = editable === false || readOnly === true;
  const safeError = typeof error === "string" && error.trim() ? error : undefined;
  const safeHint = typeof hint === "string" && hint.trim() ? hint : undefined;
  const hasError = safeError !== undefined;
  const inputName = getAccessibleName(label, accessibilityLabel);
  const composedAccessibilityHint = appendAccessibilityDescription(
    accessibilityHint,
    [safeHint, safeError]
  );
  const validTrailingAction =
    typeof trailingAction === "object" &&
    trailingAction !== null &&
    isNonBlankString(trailingAction.label)
      ? trailingAction
      : undefined;
  const trailingDisabled = validTrailingAction
    ? validTrailingAction.disabled === true ||
      typeof validTrailingAction.onPress !== "function"
    : false;
  const safeLeadingIcon = isSemanticIconName(leadingIcon) ? leadingIcon : undefined;
  const safeTrailingIcon = isSemanticIconName(validTrailingAction?.icon)
    ? validTrailingAction.icon
    : undefined;
  const leadingIconTone = getLeadingIconTone(isInputDisabled, hasError, focused);
  const safeOnBlur = typeof onBlur === "function" ? onBlur : undefined;
  const safeOnChange = typeof onChange === "function" ? onChange : undefined;
  const safeOnChangeText =
    typeof onChangeText === "function" ? onChangeText : undefined;
  const safeOnContentSizeChange =
    typeof onContentSizeChange === "function" ? onContentSizeChange : undefined;
  const safeOnEndEditing =
    typeof onEndEditing === "function" ? onEndEditing : undefined;
  const safeOnFocus = typeof onFocus === "function" ? onFocus : undefined;
  const safeOnKeyPress =
    typeof onKeyPress === "function" ? onKeyPress : undefined;
  const safeOnSelectionChange =
    typeof onSelectionChange === "function" ? onSelectionChange : undefined;
  const safeOnSubmitEditing =
    typeof onSubmitEditing === "function" ? onSubmitEditing : undefined;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputShell,
          isInputDisabled && styles.inputDisabled,
          focused && !isInputDisabled && styles.focused,
          hasError && styles.inputError
        ]}
      >
        {safeLeadingIcon ? (
          <View pointerEvents="none" style={styles.leadingIcon}>
            <SemanticIcon
              name={safeLeadingIcon}
              tone={leadingIconTone}
            />
          </View>
        ) : null}
        <TextInput
          accessibilityHint={composedAccessibilityHint}
          accessibilityLabel={inputName}
          accessibilityState={{ disabled: isInputDisabled }}
          allowFontScaling={allowFontScaling}
          aria-disabled={isInputDisabled}
          aria-invalid={hasError}
          autoCapitalize={autoCapitalize ?? "none"}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect}
          autoFocus={autoFocus}
          caretHidden={caretHidden}
          contextMenuHidden={contextMenuHidden}
          defaultValue={defaultValue}
          editable={editable}
          enterKeyHint={enterKeyHint}
          importantForAutofill={importantForAutofill}
          inputMode={inputMode}
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          nativeID={nativeID}
          onBlur={(event) => {
            setFocused(false);
            safeOnBlur?.(event);
          }}
          onChange={safeOnChange}
          onChangeText={safeOnChangeText}
          onContentSizeChange={safeOnContentSizeChange}
          onEndEditing={safeOnEndEditing}
          onFocus={(event) => {
            setFocused(true);
            safeOnFocus?.(event);
          }}
          onKeyPress={safeOnKeyPress}
          onSelectionChange={safeOnSelectionChange}
          onSubmitEditing={safeOnSubmitEditing}
          passwordRules={passwordRules}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.ink.muted}
          readOnly={readOnly}
          ref={ref}
          returnKeyType={returnKeyType}
          secureTextEntry={secureTextEntry}
          selection={selection}
          selectTextOnFocus={selectTextOnFocus}
          showSoftInputOnFocus={showSoftInputOnFocus}
          spellCheck={spellCheck}
          style={[styles.input, multiline && styles.multilineInput]}
          submitBehavior={submitBehavior}
          testID={testID}
          textContentType={textContentType}
          value={value}
        />
        {validTrailingAction ? (
          <Pressable
            accessible
            accessibilityElementsHidden={false}
            accessibilityHint={
              typeof validTrailingAction.accessibilityHint === "string"
                ? validTrailingAction.accessibilityHint
                : undefined
            }
            accessibilityLabel={validTrailingAction.label.trim()}
            accessibilityRole="button"
            accessibilityState={{ disabled: trailingDisabled }}
            aria-disabled={trailingDisabled}
            aria-hidden={false}
            disabled={trailingDisabled}
            importantForAccessibility="yes"
            onPress={trailingDisabled ? undefined : validTrailingAction.onPress}
            role="button"
            style={({ pressed }) => [
              styles.trailingAction,
              pressed && !trailingDisabled && styles.trailingActionPressed,
              trailingDisabled && styles.trailingActionDisabled
            ]}
            testID={
              typeof validTrailingAction.testID === "string"
                ? validTrailingAction.testID
                : undefined
            }
          >
            <View
              accessibilityElementsHidden
              accessible={false}
              aria-hidden
              importantForAccessibility="no-hide-descendants"
              pointerEvents="none"
              style={styles.trailingActionContent}
            >
              {safeTrailingIcon ? (
                <SemanticIcon
                  name={safeTrailingIcon}
                  tone={trailingDisabled ? "muted" : "brand"}
                />
              ) : null}
              <Text accessible={false} style={styles.trailingActionLabel}>
                {validTrailingAction.label}
              </Text>
            </View>
          </Pressable>
        ) : null}
      </View>
      {safeHint ? <Text style={styles.hint}>{safeHint}</Text> : null}
      {safeError ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
          {safeError}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexShrink: 1,
    gap: theme.space[1],
    maxWidth: "100%"
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  inputShell: {
    alignItems: "center",
    backgroundColor: theme.colors.surface.default,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: theme.border.default,
    flexDirection: "row",
    flexShrink: 1,
    flexWrap: "wrap",
    gap: theme.space[1],
    minHeight: theme.height.control.min,
    paddingLeft: theme.space[3],
    paddingRight: theme.space[1]
  },
  leadingIcon: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: theme.target.min
  },
  input: {
    ...theme.typography.body,
    color: theme.colors.ink.primary,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: theme.height.control.min,
    minWidth: theme.target.min,
    paddingVertical: theme.space[2]
  },
  multilineInput: {
    textAlignVertical: "top"
  },
  trailingAction: {
    alignItems: "center",
    borderRadius: theme.radius.sm,
    borderWidth: 0,
    flexShrink: 1,
    justifyContent: "center",
    maxWidth: "45%",
    minHeight: theme.target.min,
    minWidth: theme.target.min,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1]
  },
  trailingActionContent: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    flexWrap: "wrap",
    gap: theme.space[1],
    justifyContent: "center"
  },
  trailingActionPressed: {
    backgroundColor: theme.colors.brand.tint,
    borderColor: theme.colors.brand.primary,
    borderWidth: theme.border.default,
    transform: [{ translateY: theme.border.default }]
  },
  trailingActionDisabled: {
    borderColor: theme.colors.ink.muted,
    borderStyle: "dashed",
    borderWidth: theme.border.default,
    opacity: 0.62
  },
  trailingActionLabel: {
    ...theme.typography.label,
    color: theme.colors.brand.primary,
    flexShrink: 1,
    textAlign: "center"
  },
  focused: {
    borderColor: theme.colors.focus,
    borderWidth: 2
  },
  inputError: {
    borderColor: theme.colors.danger.fg,
    borderWidth: 2
  },
  inputDisabled: {
    backgroundColor: theme.colors.surface.subtle,
    borderStyle: "dashed"
  },
  hint: {
    ...theme.typography.supporting,
    color: theme.colors.ink.muted,
    flexShrink: 1
  },
  error: {
    ...theme.typography.supporting,
    color: theme.colors.danger.fg,
    flexShrink: 1
  }
});
