import { StyleSheet, Text, View, type PressableProps } from "react-native";
import { theme } from "../utils/theme";
import type { AppIconName, AppIconProps } from "./AppIcon";
import { Card } from "./Card";

type ActionTileProps = {
  accessibilityHint?: string;
  disabled?: boolean;
  icon: AppIconName;
  label: string;
  onPress: NonNullable<PressableProps["onPress"]>;
  supportingText: string;
  testID?: string;
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
  testID
}: ActionTileProps) {
  const visibleLabel = normalizeCopy(label);
  const visibleSupportingText = normalizeCopy(supportingText);

  if (!visibleLabel || !visibleSupportingText) {
    return null;
  }

  const accessibleName = `${visibleLabel}. ${visibleSupportingText}`;

  return (
    <Card
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibleName}
      disabled={disabled}
      onPress={onPress}
      subtle
      testID={testID}
    >
      <View
        accessibilityElementsHidden
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={styles.content}
      >
        <View style={styles.icon}>
          <SemanticIcon name={icon} size="tile" tone="brand" />
        </View>
        <View style={styles.copy}>
          <Text accessible={false} allowFontScaling style={styles.label}>
            {visibleLabel}
          </Text>
          <Text accessible={false} allowFontScaling style={styles.supporting}>
            {visibleSupportingText}
          </Text>
        </View>
        <SemanticIcon name="forward" tone="muted" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: theme.space[3],
    maxWidth: "100%"
  },
  icon: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.colors.brand.tint,
    borderRadius: theme.radius.md,
    justifyContent: "center",
    padding: theme.space[2]
  },
  copy: {
    flex: 1,
    flexShrink: 1,
    gap: theme.space[1],
    minWidth: 0
  },
  label: {
    ...theme.typography.cardTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  supporting: {
    ...theme.typography.supporting,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  }
});
