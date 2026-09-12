import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import type { PayPolicyRuleType, PayPolicyWeekday } from "../types/payPolicy";
import { PAY_POLICY_WEEKDAYS } from "../types/payPolicy";
import {
  changePayPolicyRuleType,
  createEmptyHolidayDate,
  isZeroPremiumPercent,
  type HolidayRuleForm,
  type PayPolicyFormErrors,
  type PayPolicyRuleForm
} from "../utils/payPolicyForm";
import { colors, radii, spacing, typography } from "../utils/theme";
import { Button } from "./Button";
import { FormField } from "./FormField";
import { SegmentedControl, type SegmentedControlOption } from "./SegmentedControl";

const RULE_TYPE_OPTIONS: readonly SegmentedControlOption<PayPolicyRuleType>[] = [
  { value: "TIME_OF_DAY", label: "Time of day" },
  { value: "DAILY_OVERTIME", label: "Daily overtime" },
  { value: "WEEKLY_OVERTIME", label: "Weekly overtime" },
  { value: "DAY_OF_WEEK", label: "Day of week" },
  { value: "HOLIDAY", label: "Holiday" }
];

const WEEKDAY_LABELS: Record<PayPolicyWeekday, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun"
};

interface PayPolicyRuleEditorProps {
  disabled?: boolean;
  errors: PayPolicyFormErrors;
  index: number;
  onChange: (rule: PayPolicyRuleForm) => void;
  onRemove: () => void;
  rule: PayPolicyRuleForm;
}

function FieldError({ message }: { message?: string }) {
  return message ? <Text style={styles.error}>{message}</Text> : null;
}

function updateHolidayDate(
  rule: HolidayRuleForm,
  holidayIndex: number,
  values: Partial<{ date: string; label: string }>
): HolidayRuleForm {
  return {
    ...rule,
    condition: {
      dates: rule.condition.dates.map((holiday, index) =>
        index === holidayIndex ? { ...holiday, ...values } : holiday
      )
    }
  };
}

export function PayPolicyRuleEditor({
  disabled = false,
  errors,
  index,
  onChange,
  onRemove,
  rule
}: PayPolicyRuleEditorProps) {
  const path = `rules[${index}]`;

  const renderCondition = () => {
    switch (rule.type) {
      case "TIME_OF_DAY":
        return (
          <View style={styles.conditionFields}>
            <FormField
              autoCorrect={false}
              editable={!disabled}
              error={errors[`${path}.condition.startTime`]}
              label="Start local time"
              onChangeText={(startTime) => {
                onChange({
                  ...rule,
                  condition: { ...rule.condition, startTime }
                });
              }}
              placeholder="22:00"
              value={rule.condition.startTime}
            />
            <FormField
              autoCorrect={false}
              editable={!disabled}
              error={errors[`${path}.condition.endTime`]}
              label="End local time"
              onChangeText={(endTime) => {
                onChange({
                  ...rule,
                  condition: { ...rule.condition, endTime }
                });
              }}
              placeholder="06:00"
              value={rule.condition.endTime}
            />
            <Text style={styles.helpText}>
              Use 24-hour time such as 22:00. The range may cross midnight.
            </Text>
          </View>
        );
      case "DAILY_OVERTIME":
      case "WEEKLY_OVERTIME":
        return (
          <FormField
            editable={!disabled}
            error={errors[`${path}.condition.thresholdMinutes`]}
            inputMode="numeric"
            keyboardType="number-pad"
            label="Threshold minutes"
            onChangeText={(thresholdMinutes) => {
              onChange({
                ...rule,
                condition: { thresholdMinutes }
              });
            }}
            placeholder={rule.type === "DAILY_OVERTIME" ? "480" : "2400"}
            value={rule.condition.thresholdMinutes}
          />
        );
      case "DAY_OF_WEEK":
        return (
          <View style={styles.conditionFields}>
            <Text style={styles.fieldLabel}>Weekdays</Text>
            <View style={styles.weekdayGrid}>
              {PAY_POLICY_WEEKDAYS.map((weekday) => {
                const selected = rule.condition.weekdays.includes(weekday);

                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected, disabled }}
                    disabled={disabled}
                    key={weekday}
                    onPress={() => {
                      const weekdays = new Set(rule.condition.weekdays);

                      if (selected) {
                        weekdays.delete(weekday);
                      } else {
                        weekdays.add(weekday);
                      }

                      onChange({
                        ...rule,
                        condition: {
                          weekdays: PAY_POLICY_WEEKDAYS.filter((day) => weekdays.has(day))
                        }
                      });
                    }}
                    style={({ pressed }) => [
                      styles.weekday,
                      selected && styles.selectedWeekday,
                      pressed && !disabled && styles.pressed,
                      disabled && styles.disabled
                    ]}
                  >
                    <Text
                      style={[styles.weekdayLabel, selected && styles.selectedWeekdayLabel]}
                    >
                      {WEEKDAY_LABELS[weekday]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <FieldError message={errors[`${path}.condition.weekdays`]} />
          </View>
        );
      case "HOLIDAY":
        return (
          <View style={styles.conditionFields}>
            <Text style={styles.fieldLabel}>Manual local dates</Text>
            <Text style={styles.helpText}>
              Dates are interpreted in the company timezone shown above.
            </Text>
            {rule.condition.dates.map((holiday, holidayIndex) => (
              <View key={holiday.clientId} style={styles.holidayRow}>
                <FieldError
                  message={errors[`${path}.condition.dates[${holidayIndex}]`]}
                />
                <FormField
                  autoCorrect={false}
                  editable={!disabled}
                  error={errors[`${path}.condition.dates[${holidayIndex}].date`]}
                  label="Date (YYYY-MM-DD)"
                  onChangeText={(date) => {
                    onChange(updateHolidayDate(rule, holidayIndex, { date }));
                  }}
                  placeholder="2026-12-25"
                  value={holiday.date}
                />
                <FormField
                  autoCapitalize="words"
                  editable={!disabled}
                  error={errors[`${path}.condition.dates[${holidayIndex}].label`]}
                  label="Label (optional)"
                  onChangeText={(label) => {
                    onChange(updateHolidayDate(rule, holidayIndex, { label }));
                  }}
                  placeholder="Company holiday"
                  value={holiday.label}
                />
                <Button
                  disabled={disabled}
                  label="Remove date"
                  onPress={() => {
                    onChange({
                      ...rule,
                      condition: {
                        dates: rule.condition.dates.filter(
                          (_, dateIndex) => dateIndex !== holidayIndex
                        )
                      }
                    });
                  }}
                  variant="ghost"
                />
              </View>
            ))}
            <FieldError message={errors[`${path}.condition.dates`]} />
            <Button
              disabled={disabled}
              label="Add holiday date"
              onPress={() => {
                onChange({
                  ...rule,
                  condition: {
                    dates: [...rule.condition.dates, createEmptyHolidayDate()]
                  }
                });
              }}
              variant="secondary"
            />
          </View>
        );
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardTitle}>Rule {index + 1}</Text>
          <Text style={styles.helpText}>{rule.enabled ? "Enabled" : "Disabled"}</Text>
        </View>
        <Switch
          accessibilityLabel={`Rule ${index + 1} enabled`}
          disabled={disabled}
          onValueChange={(enabled) => {
            onChange({ ...rule, enabled });
          }}
          trackColor={{ false: colors.border, true: colors.primarySoft }}
          thumbColor={rule.enabled ? colors.primary : colors.textMuted}
          value={rule.enabled}
        />
      </View>

      <FieldError message={errors[path]} />
      <FieldError message={errors[`${path}.enabled`]} />

      <FormField
        autoCapitalize="words"
        editable={!disabled}
        error={errors[`${path}.name`]}
        label="Rule name"
        onChangeText={(name) => {
          onChange({ ...rule, name });
        }}
        placeholder="Name this rule"
        value={rule.name}
      />

      <View style={styles.conditionFields}>
        <Text style={styles.fieldLabel}>Rule type</Text>
        <SegmentedControl
          accessibilityLabel={`Rule ${index + 1} type`}
          disabled={disabled}
          onChange={(type) => {
            onChange(changePayPolicyRuleType(rule, type));
          }}
          options={RULE_TYPE_OPTIONS}
          value={rule.type}
          wrap
        />
        <FieldError message={errors[`${path}.type`]} />
      </View>

      <FormField
        editable={!disabled}
        error={errors[`${path}.premiumPercent`]}
        inputMode="decimal"
        keyboardType="decimal-pad"
        label="Premium percent"
        onChangeText={(premiumPercent) => {
          onChange({ ...rule, premiumPercent });
        }}
        placeholder="0 to 1000"
        value={rule.premiumPercent}
      />
      {isZeroPremiumPercent(rule.premiumPercent) ? (
        <Text style={styles.warning}>A 0% premium is allowed and has no pay effect.</Text>
      ) : null}

      <FieldError message={errors[`${path}.condition`]} />
      {renderCondition()}

      <Button
        disabled={disabled}
        label="Remove rule"
        onPress={onRemove}
        variant="ghost"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    backgroundColor: colors.white,
    padding: spacing.md
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  cardTitleBlock: {
    flex: 1,
    gap: spacing.xs
  },
  cardTitle: {
    ...typography.sectionTitle,
    color: colors.text
  },
  conditionFields: {
    gap: spacing.sm
  },
  fieldLabel: {
    ...typography.label,
    color: colors.text
  },
  helpText: {
    ...typography.caption,
    color: colors.textSecondary
  },
  error: {
    ...typography.caption,
    color: colors.error
  },
  warning: {
    ...typography.caption,
    color: colors.warning
  },
  weekdayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  weekday: {
    minWidth: 58,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm
  },
  selectedWeekday: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  weekdayLabel: {
    ...typography.label,
    color: colors.text
  },
  selectedWeekdayLabel: {
    color: colors.white
  },
  holidayRow: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md
  },
  pressed: {
    opacity: 0.8
  },
  disabled: {
    opacity: 0.6
  }
});
