import { Pressable, StyleSheet, Text, View, type PressableProps } from "react-native";
import { theme } from "../utils/theme";
import type { AppIconName, AppIconProps } from "./AppIcon";

type ActionTileProps = {
  accessibilityHint?: string;
  disabled?: boolean;
  icon: AppIconName;
  label: string;
  onPress: NonNullable<PressableProps["onPress"]>;
  supportingText?: string;
  testID?: string;
  tone?: "default" | "primary";
};

function normalizeCopy(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function SemanticIcon(props: AppIconProps) {
  // Keep native icon loading on the rendered tile path, not module import.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppIcon } = require("./AppIcon") as typeof import("./AppIcon");
  return <AppIcon {...props} />;
}

export function ActionTile({
  accessibilityHint,
  disabled = false,
  icon,
  label,
  onPress,
  supportingText,
  testID,
  tone = "default"
}: ActionTileProps) {
  const visibleLabel = normalizeCopy(label);
  const visibleSupportingText = normalizeCopy(supportingText);

  if (!visibleLabel) {
    return null;
  }

  const accessibleName = visibleSupportingText
    ? `${visibleLabel}. ${visibleSupportingText}`
    : visibleLabel;
  const isDisabled = disabled === true;
  const isPrimary = tone === "primary";

  return (
    <Pressable
      accessible
      accessibilityElementsHidden={false}
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibleName}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      aria-disabled={isDisabled}
      aria-hidden={false}
      aria-label={accessibleName}
      disabled={isDisabled}
      importantForAccessibility="yes"
      onPress={isDisabled ? undefined : onPress}
      role="button"
      style={({ pressed }) => [
        styles.target,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled
      ]}
      testID={testID}
    >
      <View
        accessibilityElementsHidden
        accessible={false}
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[
          styles.content,
          isPrimary ? styles.primarySurface : styles.defaultSurface,
          isDisabled && styles.disabledSurface
        ]}
      >
        <View style={[styles.icon, isPrimary ? styles.primaryIcon : styles.defaultIcon]}>
          <SemanticIcon
            name={icon}
            size="tile"
            tone={isPrimary ? "inverse" : "brand"}
          />
        </View>
        <View style={styles.copy}>
          <Text
            accessible={false}
            allowFontScaling
            style={[styles.label, isPrimary && styles.primaryLabel]}
          >
            {visibleLabel}
          </Text>
          {visibleSupportingText ? (
            <Text
              accessible={false}
              allowFontScaling
              style={[styles.supporting, isPrimary && styles.primarySupporting]}
            >
              {visibleSupportingText}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: {
    flex: 1,
    minHeight: 104,
    minWidth: 0
  },
  content: {
    borderRadius: theme.radius.md,
    borderWidth: theme.border.default,
    flexGrow: 1,
    flexShrink: 1,
    gap: theme.space[3],
    justifyContent: "space-between",
    maxWidth: "100%",
    padding: theme.space[3]
  },
  defaultSurface: {
    backgroundColor: theme.colors.surface.subtle,
    borderColor: theme.colors.border
  },
  primarySurface: {
    backgroundColor: theme.colors.brand.primary,
    borderColor: theme.colors.brand.primary
  },
  icon: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: theme.radius.md,
    justifyContent: "center"
  },
  defaultIcon: {
    backgroundColor: theme.colors.brand.tint,
    padding: theme.space[2]
  },
  primaryIcon: {
    padding: 0
  },
  copy: {
    flexShrink: 1,
    gap: theme.space[1],
    minWidth: 0
  },
  label: {
    ...theme.typography.cardTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  primaryLabel: {
    color: theme.colors.surface.default
  },
  supporting: {
    ...theme.typography.supporting,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  primarySupporting: {
    color: theme.colors.surface.default
  },
  pressed: {
    opacity: 0.9,
    transform: [{ translateY: theme.border.default }]
  },
  disabled: {
    opacity: 0.6
  },
  disabledSurface: {
    borderColor: theme.colors.ink.muted,
    borderStyle: "dashed"
  }
});
