import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../utils/theme";

export interface SegmentedControlOption<TValue extends string> {
  label: string;
  value: TValue;
}

interface SegmentedControlProps<TValue extends string> {
  accessibilityLabel: string;
  disabled?: boolean;
  onChange: (value: TValue) => void;
  options: readonly SegmentedControlOption<TValue>[];
  value: TValue;
  wrap?: boolean;
}

export function SegmentedControl<TValue extends string>({
  accessibilityLabel,
  disabled = false,
  onChange,
  options,
  value,
  wrap = false
}: SegmentedControlProps<TValue>) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
      style={[styles.container, wrap && styles.wrappedContainer]}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            key={option.value}
            onPress={() => {
              onChange(option.value);
            }}
            style={({ pressed }) => [
              styles.option,
              wrap && styles.wrappedOption,
              selected && styles.selectedOption,
              pressed && !disabled && styles.pressed,
              disabled && styles.disabled
            ]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    padding: spacing.xs,
    gap: spacing.xs,
    backgroundColor: colors.surface
  },
  wrappedContainer: {
    flexWrap: "wrap"
  },
  option: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.control,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  wrappedOption: {
    flexGrow: 1,
    flexBasis: "30%"
  },
  selectedOption: {
    backgroundColor: colors.primary
  },
  pressed: {
    opacity: 0.8
  },
  disabled: {
    opacity: 0.6
  },
  label: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
    textAlign: "center"
  },
  selectedLabel: {
    color: colors.white
  }
});
