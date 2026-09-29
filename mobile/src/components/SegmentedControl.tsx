import { Pressable, StyleSheet, Text, View, type ViewProps } from "react-native";
import { theme } from "../utils/theme";

export interface SegmentedControlOption<TValue extends string> {
  label: string;
  value: TValue;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export type SegmentedControlProps<TValue extends string> = Pick<
  ViewProps,
  "accessibilityHint" | "nativeID" | "testID"
> & {
  accessibilityLabel: string;
  disabled?: boolean;
  onChange: (value: TValue) => void;
  options: readonly SegmentedControlOption<TValue>[];
  value: TValue;
  wrap?: boolean;
}

function getAccessibleName(label: string, context?: string): string {
  const normalizedContext = context?.trim();

  if (!normalizedContext || normalizedContext.includes(label)) {
    return normalizedContext || label;
  }

  return `${normalizedContext}: ${label}`;
}

export function SegmentedControl<TValue extends string>({
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
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole="radiogroup"
      accessibilityState={{ disabled }}
      nativeID={nativeID}
      testID={testID}
      style={[styles.container, wrap && styles.wrappedContainer]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const isDisabled = disabled || option.disabled === true;

        return (
          <Pressable
            accessibilityHint={option.accessibilityHint}
            accessibilityLabel={getAccessibleName(option.label, option.accessibilityLabel)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled: isDisabled }}
            disabled={isDisabled}
            key={option.value}
            onPress={() => {
              if (!isDisabled) {
                onChange(option.value);
              }
            }}
            testID={option.testID}
            style={({ pressed }) => [
              styles.option,
              wrap ? styles.wrappedOption : styles.unwrappedOption,
              selected ? styles.selectedOption : styles.unselectedOption,
              pressed && !isDisabled &&
                (selected ? styles.selectedPressed : styles.unselectedPressed),
              isDisabled && styles.disabled
            ]}
          >
            <Text
              allowFontScaling
              style={[styles.label, selected && styles.selectedLabel]}
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
    flexDirection: "row",
    flexWrap: "nowrap",
    borderWidth: theme.border.default,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.space[1],
    gap: theme.space[1],
    backgroundColor: theme.colors.surface.default
  },
  wrappedContainer: {
    flexWrap: "wrap"
  },
  option: {
    minWidth: theme.target.min,
    minHeight: theme.target.min,
    maxWidth: "100%",
    flexShrink: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
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
    backgroundColor: theme.colors.surface.default
  },
  selectedOption: {
    backgroundColor: theme.colors.brand.primary
  },
  unselectedPressed: {
    backgroundColor: theme.colors.brand.tint
  },
  selectedPressed: {
    backgroundColor: theme.colors.brand.pressed
  },
  disabled: {
    opacity: 0.6
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
  }
});
