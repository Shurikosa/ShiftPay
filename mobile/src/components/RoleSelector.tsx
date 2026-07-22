import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileRegistrationRole } from "../types/auth";
import { colors, radii, spacing, typography } from "../utils/theme";

type RoleSelectorProps = {
  value: MobileRegistrationRole;
  onChange: (role: MobileRegistrationRole) => void;
};

const roles: { value: MobileRegistrationRole; label: string }[] = [
  { value: "WORKER", label: "Worker" },
  { value: "FOREMAN", label: "Foreman" }
];

export function RoleSelector({ value, onChange }: RoleSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Role</Text>
      <View style={styles.options}>
        {roles.map((role) => {
          const selected = value === role.value;

          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={role.value}
              onPress={() => {
                onChange(role.value);
              }}
              style={[styles.option, selected && styles.selectedOption]}
            >
              <Text style={[styles.optionLabel, selected && styles.selectedOptionLabel]}>
                {role.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs
  },
  label: {
    ...typography.label,
    color: colors.text
  },
  options: {
    flexDirection: "row",
    gap: spacing.sm
  },
  option: {
    flex: 1,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    backgroundColor: colors.white
  },
  selectedOption: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  optionLabel: {
    ...typography.button,
    color: colors.text
  },
  selectedOptionLabel: {
    color: colors.primary
  }
});
