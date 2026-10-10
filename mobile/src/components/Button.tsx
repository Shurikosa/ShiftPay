import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { theme } from "../utils/theme";
import type { AppIconName, AppIconProps, AppIconTone } from "./AppIcon";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "text"
  | "destructive"
  | "ghost";

export type ButtonLayoutStyle = Pick<
  ViewStyle,
  | "alignSelf"
  | "flex"
  | "margin"
  | "marginBottom"
  | "marginEnd"
  | "marginHorizontal"
  | "marginLeft"
  | "marginRight"
  | "marginStart"
  | "marginTop"
  | "marginVertical"
>;

export type ButtonProps = {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  leadingIcon?: AppIconName;
  loading?: boolean;
  nativeID?: string;
  onPress: NonNullable<PressableProps["onPress"]>;
  style?: StyleProp<ButtonLayoutStyle>;
  testID?: string;
  trailingIcon?: AppIconName;
  variant?: ButtonVariant;
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

function filterButtonLayoutStyle(
  style: StyleProp<ButtonLayoutStyle> | undefined
): ButtonLayoutStyle | undefined {
  const flattened = StyleSheet.flatten(style);
  if (!flattened || typeof flattened !== "object") {
    return undefined;
  }

  const safeStyle: ButtonLayoutStyle = {};
  const allowedEntries = {
    alignSelf: flattened.alignSelf,
    flex: flattened.flex,
    margin: flattened.margin,
    marginBottom: flattened.marginBottom,
    marginEnd: flattened.marginEnd,
    marginHorizontal: flattened.marginHorizontal,
    marginLeft: flattened.marginLeft,
    marginRight: flattened.marginRight,
    marginStart: flattened.marginStart,
    marginTop: flattened.marginTop,
    marginVertical: flattened.marginVertical
  } satisfies ButtonLayoutStyle;

  for (const [key, value] of Object.entries(allowedEntries)) {
    if (value !== undefined) {
      Object.assign(safeStyle, { [key]: value });
    }
  }

  return Object.keys(safeStyle).length > 0 ? safeStyle : undefined;
}

function getContentTone(variant: ButtonVariant): AppIconTone {
  return variant === "primary" || variant === "destructive" ? "inverse" : "brand";
}

const horizontalHitSlop = (theme.height.control.min - theme.target.min) / 2;

function isSemanticIconName(value: unknown): value is AppIconName {
  if (value === undefined || value === null) {
    return false;
  }

  // Avoid loading native icon code for the common text-only button path.
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

export function Button({
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  label,
  leadingIcon,
  loading = false,
  nativeID,
  onPress,
  style,
  testID,
  trailingIcon,
  variant = "primary"
}: ButtonProps) {
  if (!isNonBlankString(label)) {
    return null;
  }

  const hasPressHandler = typeof onPress === "function";
  const isLoading = loading === true;
  const isDisabled = disabled === true || isLoading || !hasPressHandler;
  const safeLayoutStyle = filterButtonLayoutStyle(style);
  const contentTone = getContentTone(variant);
  const accessibleName = getAccessibleName(label, accessibilityLabel);
  const safeLeadingIcon = isSemanticIconName(leadingIcon) ? leadingIcon : undefined;
  const safeTrailingIcon = isSemanticIconName(trailingIcon)
    ? trailingIcon
    : undefined;

  return (
    <Pressable
      accessible
      accessibilityElementsHidden={false}
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibleName}
      accessibilityRole="button"
      accessibilityState={{ busy: isLoading, disabled: isDisabled }}
      aria-busy={isLoading}
      aria-disabled={isDisabled}
      aria-hidden={false}
      aria-label={accessibleName}
      disabled={isDisabled}
      hitSlop={{ bottom: 0, left: horizontalHitSlop, right: horizontalHitSlop, top: 0 }}
      importantForAccessibility="yes"
      nativeID={nativeID}
      onPress={isDisabled ? undefined : onPress}
      role="button"
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        safeLayoutStyle,
        isDisabled && styles.disabled,
        isLoading && styles.loading,
        pressed && !isDisabled && styles.pressed,
        pressed && !isDisabled && styles[`${variant}Pressed`]
      ]}
      testID={testID}
    >
      <View
        accessibilityElementsHidden
        accessible={false}
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={styles.content}
      >
        {isLoading ? (
          <ActivityIndicator
            accessibilityElementsHidden
            accessible={false}
            aria-hidden
            color={
              variant === "primary" || variant === "destructive"
                ? theme.colors.surface.default
                : theme.colors.brand.primary
            }
            importantForAccessibility="no-hide-descendants"
          />
        ) : null}
        {safeLeadingIcon ? (
          <SemanticIcon name={safeLeadingIcon} tone={contentTone} />
        ) : null}
        <Text accessible={false} style={[styles.label, styles[`${variant}Label`]]}>
          {label}
        </Text>
        {safeTrailingIcon ? (
          <SemanticIcon name={safeTrailingIcon} tone={contentTone} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.default,
    minHeight: theme.height.control.min,
    minWidth: theme.target.min,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2]
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    flexWrap: "wrap",
    gap: theme.space[2],
    justifyContent: "center",
    maxWidth: "100%"
  },
  primary: {
    backgroundColor: theme.colors.brand.primary,
    borderColor: theme.colors.brand.primary
  },
  secondary: {
    backgroundColor: theme.colors.surface.subtle,
    borderColor: theme.colors.border
  },
  text: {
    borderWidth: 0
  },
  ghost: {
    borderWidth: 0
  },
  destructive: {
    backgroundColor: theme.colors.danger.fg,
    borderColor: theme.colors.danger.fg
  },
  disabled: {
    borderColor: theme.colors.ink.muted,
    borderStyle: "dashed",
    borderWidth: theme.border.default,
    opacity: 0.62
  },
  loading: {
    borderWidth: 2
  },
  pressed: {
    opacity: 0.88,
    transform: [{ translateY: theme.border.default }]
  },
  primaryPressed: {
    backgroundColor: theme.colors.brand.pressed,
    borderColor: theme.colors.brand.pressed
  },
  secondaryPressed: {
    backgroundColor: theme.colors.brand.tint,
    borderColor: theme.colors.brand.primary
  },
  textPressed: {
    backgroundColor: theme.colors.surface.subtle,
    borderColor: theme.colors.border
  },
  ghostPressed: {
    backgroundColor: theme.colors.surface.subtle,
    borderColor: theme.colors.border
  },
  destructivePressed: {
    borderColor: theme.colors.ink.primary
  },
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
  textLabel: {
    color: theme.colors.brand.primary
  },
  ghostLabel: {
    color: theme.colors.brand.primary
  },
  destructiveLabel: {
    color: theme.colors.surface.default
  }
});
