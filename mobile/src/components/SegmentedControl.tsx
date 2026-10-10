import { Pressable, StyleSheet, Text, View, type ViewProps } from "react-native";
import { theme } from "../utils/theme";

type SegmentValue = string | number;

export interface SegmentedControlOption<TValue extends SegmentValue> {
  label: string;
  value: TValue;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export type SegmentedControlProps<TValue extends SegmentValue> = Pick<
  ViewProps,
  "accessibilityHint" | "nativeID" | "testID"
> & {
  accessibilityLabel: string;
  disabled?: boolean;
  onChange: (value: TValue) => void;
  options: readonly SegmentedControlOption<TValue>[];
  value: TValue;
  wrap?: boolean;
};

type SafeSegmentedControlOption<TValue extends SegmentValue> =
  SegmentedControlOption<TValue> & {
    accessibleName: string;
  };

function normalizeAccessiblePart(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function containsEquivalentPart(context: string, label: string): boolean {
  const normalizedLabel = normalizeAccessiblePart(label);
  if (!normalizedLabel) {
    return false;
  }

  return [context, ...context.split(/[.!?…;:]+/u)].some(
    (part) => {
      const normalizedPart = normalizeAccessiblePart(part);
      return normalizedPart.length > 0 && normalizedPart === normalizedLabel;
    }
  );
}

function getAccessibleName(label: string, context?: unknown): string {
  const normalizedContext =
    typeof context === "string" ? context.trim() : undefined;

  if (!normalizedContext || containsEquivalentPart(normalizedContext, label)) {
    return normalizedContext || label;
  }

  const separator = /\p{P}$/u.test(normalizedContext) ? " " : ": ";
  return `${normalizedContext}${separator}${label}`;
}

function isSegmentValue(value: unknown): value is SegmentValue {
  return (
    (typeof value === "string" && value.trim().length > 0) ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function getSafeOptions<TValue extends SegmentValue>(
  options: unknown
): readonly SafeSegmentedControlOption<TValue>[] {
  if (!Array.isArray(options)) {
    return [];
  }

  const seenValues = new Set<SegmentValue>();
  const seenLabels = new Set<string>();
  const seenAccessibleNames = new Set<string>();
  const safeOptions: SafeSegmentedControlOption<TValue>[] = [];

  for (const option of options) {
    if (typeof option !== "object" || option === null) {
      continue;
    }

    const candidate = option as Record<string, unknown>;
    if (
      typeof candidate.label !== "string" ||
      candidate.label.trim().length === 0 ||
      !isSegmentValue(candidate.value)
    ) {
      continue;
    }

    const label = candidate.label.trim();
    const normalizedLabel = normalizeAccessiblePart(label);
    const accessibleName = getAccessibleName(label, candidate.accessibilityLabel);
    const normalizedAccessibleName = normalizeAccessiblePart(accessibleName);
    if (
      seenValues.has(candidate.value) ||
      seenLabels.has(normalizedLabel) ||
      seenAccessibleNames.has(normalizedAccessibleName)
    ) {
      continue;
    }

    seenValues.add(candidate.value);
    seenLabels.add(normalizedLabel);
    seenAccessibleNames.add(normalizedAccessibleName);
    safeOptions.push({
      accessibilityHint:
        typeof candidate.accessibilityHint === "string"
          ? candidate.accessibilityHint
          : undefined,
      accessibilityLabel:
        typeof candidate.accessibilityLabel === "string"
          ? candidate.accessibilityLabel
          : undefined,
      accessibleName,
      disabled: candidate.disabled === true,
      label,
      testID: typeof candidate.testID === "string" ? candidate.testID : undefined,
      value: candidate.value as TValue
    });
  }

  return safeOptions;
}

export function SegmentedControl<TValue extends SegmentValue>({
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  nativeID,
  onChange,
  options,
  testID,
  value,
  wrap = false
}: SegmentedControlProps<TValue>) {
  if (
    typeof accessibilityLabel !== "string" ||
    accessibilityLabel.trim().length === 0
  ) {
    return null;
  }

  const hasChangeHandler = typeof onChange === "function";
  const isGroupDisabled = disabled === true || !hasChangeHandler;
  const safeOptions = getSafeOptions<TValue>(options);
  if (safeOptions.length === 0) {
    return null;
  }

  return (
    <View
      accessibilityElementsHidden={false}
      accessibilityLabel={accessibilityLabel.trim()}
      accessibilityHint={
        typeof accessibilityHint === "string" ? accessibilityHint : undefined
      }
      accessibilityRole="radiogroup"
      accessibilityState={{ disabled: isGroupDisabled }}
      aria-disabled={isGroupDisabled}
      aria-hidden={false}
      importantForAccessibility="yes"
      nativeID={typeof nativeID === "string" ? nativeID : undefined}
      role="radiogroup"
      testID={typeof testID === "string" ? testID : undefined}
      style={[styles.container, wrap === true && styles.wrappedContainer]}
    >
      {safeOptions.map((option) => {
        const selected = option.value === value;
        const isDisabled = isGroupDisabled || option.disabled === true;

        return (
          <Pressable
            accessible
            accessibilityElementsHidden={false}
            accessibilityHint={option.accessibilityHint}
            accessibilityLabel={option.accessibleName}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled: isDisabled }}
            aria-checked={selected}
            aria-disabled={isDisabled}
            aria-hidden={false}
            disabled={isDisabled}
            importantForAccessibility="yes"
            key={`${typeof option.value}:${String(option.value)}`}
            onPress={
              isDisabled
                ? undefined
                : () => {
                    onChange(option.value);
                  }
            }
            role="radio"
            testID={option.testID}
            style={({ pressed }) => [
              styles.option,
              wrap === true ? styles.wrappedOption : styles.unwrappedOption,
              selected ? styles.selectedOption : styles.unselectedOption,
              pressed && !isDisabled &&
                (selected ? styles.selectedPressed : styles.unselectedPressed),
              isDisabled && styles.disabled
            ]}
          >
            <Text
              allowFontScaling
              accessible={false}
              style={[
                styles.label,
                selected && styles.selectedLabel,
                isDisabled && styles.disabledLabel
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface.default,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: theme.border.default,
    flexDirection: "row",
    flexShrink: 1,
    flexWrap: "nowrap",
    gap: theme.space[1],
    maxWidth: "100%",
    padding: theme.space[1]
  },
  wrappedContainer: {
    flexWrap: "wrap"
  },
  option: {
    alignItems: "center",
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.default,
    flexShrink: 1,
    justifyContent: "center",
    maxWidth: "100%",
    minHeight: theme.target.min,
    minWidth: theme.target.min,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[2]
  },
  unwrappedOption: {
    flexBasis: 0,
    flexGrow: 1
  },
  wrappedOption: {
    flexGrow: 1,
    flexBasis: "30%"
  },
  unselectedOption: {
    backgroundColor: theme.colors.surface.default,
    borderColor: theme.colors.border
  },
  selectedOption: {
    backgroundColor: theme.colors.brand.primary,
    borderColor: theme.colors.brand.primary,
    borderWidth: 2
  },
  unselectedPressed: {
    backgroundColor: theme.colors.brand.tint,
    borderColor: theme.colors.brand.primary,
    borderWidth: 2,
    transform: [{ translateY: theme.border.default }]
  },
  selectedPressed: {
    backgroundColor: theme.colors.brand.pressed,
    borderColor: theme.colors.brand.pressed,
    transform: [{ translateY: theme.border.default }]
  },
  disabled: {
    backgroundColor: theme.colors.surface.subtle,
    borderColor: theme.colors.ink.muted,
    borderStyle: "dashed",
    opacity: 0.62
  },
  label: {
    ...theme.typography.label,
    maxWidth: "100%",
    flexShrink: 1,
    color: theme.colors.ink.primary,
    textAlign: "center"
  },
  selectedLabel: {
    color: theme.colors.surface.default
  },
  disabledLabel: {
    color: theme.colors.ink.muted
  }
});
