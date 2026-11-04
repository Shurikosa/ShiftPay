import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import type { PayPolicyRuleType, PayPolicyWeekday } from "../types/payPolicy";
import { PAY_POLICY_WEEKDAYS } from "../types/payPolicy";
import {
  changePayPolicyRuleType,
  createEmptyHolidayDate,
  isZeroPremiumPercent,
  parseThresholdHours,
  type HolidayRuleForm,
  type PayPolicyFormErrors,
  type PayPolicyRuleForm
} from "../utils/payPolicyForm";
import { trimCurrencyLabelBoundaries } from "../utils/companySettings";
import { theme } from "../utils/theme";
import { Button } from "./Button";
import { Card } from "./Card";
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
  companyDefaultWorkerHourlyRate: number | null;
  currencyLabel: string | null;
  disabled?: boolean;
  errors: PayPolicyFormErrors;
  index: number;
  onChange: (rule: PayPolicyRuleForm) => void;
  onOpenCompanySettings?: () => void;
  onRemove: () => void;
  rule: PayPolicyRuleForm;
}

function FieldError({ message }: { message?: string }) {
  return message ? <Text allowFontScaling style={styles.error}>{message}</Text> : null;
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
  companyDefaultWorkerHourlyRate,
  currencyLabel,
  disabled = false,
  errors,
  index,
  onChange,
  onOpenCompanySettings,
  onRemove,
  rule
}: PayPolicyRuleEditorProps) {
  const path = `rules[${index}]`;
  const normalizedPremiumPercent = rule.premiumPercent.trim().replace(",", ".");
  const premiumPercent = Number(normalizedPremiumPercent);
  const validPremiumPercent =
    /^\d+(?:\.\d{1,4})?$/.test(normalizedPremiumPercent) &&
    Number.isFinite(premiumPercent) &&
    premiumPercent >= 0 &&
    premiumPercent <= 1000;
  const canShowPreview =
    companyDefaultWorkerHourlyRate !== null &&
    Number.isFinite(companyDefaultWorkerHourlyRate) &&
    currencyLabel !== null &&
    trimCurrencyLabelBoundaries(currencyLabel).length > 0 &&
    validPremiumPercent;

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
            <Text allowFontScaling style={styles.helpText}>
              Use 24-hour time such as 22:00. The range may cross midnight.
            </Text>
          </View>
        );
      case "DAILY_OVERTIME":
      case "WEEKLY_OVERTIME": {
        return (
          <View style={styles.conditionFields}>
            <FormField
              editable={!disabled}
              error={errors[`${path}.condition.thresholdMinutes`]}
              inputMode="decimal"
              keyboardType="decimal-pad"
              label="Threshold hours"
              onChangeText={(hours) => {
                const minutes = parseThresholdHours(hours);
                onChange({
                  ...rule,
                  condition: {
                    thresholdHours: hours,
                    thresholdMinutes: minutes === null ? "" : String(minutes),
                    thresholdHoursEdited: true
                  }
                });
              }}
              placeholder={rule.type === "DAILY_OVERTIME" ? "8" : "40"}
              value={rule.condition.thresholdHours}
            />
            <Text allowFontScaling style={styles.helpText}>
              {rule.type === "DAILY_OVERTIME"
                ? "Applies after this many payable hours in one company-timezone day."
                : "Applies after this many payable hours since the selected company-timezone week start."}
            </Text>
          </View>
        );
      }
      case "DAY_OF_WEEK":
        return (
          <View style={styles.conditionFields}>
            <Text allowFontScaling style={styles.fieldLabel}>Weekdays</Text>
            <Text allowFontScaling style={styles.helpText}>Choose every company-local weekday this premium can match.</Text>
            <View style={styles.weekdayGrid}>
              {PAY_POLICY_WEEKDAYS.map((weekday) => {
                const selected = rule.condition.weekdays.includes(weekday);

                return (
                  <Pressable
                    accessibilityLabel={`${WEEKDAY_LABELS[weekday]} weekday`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected, disabled }}
                    aria-checked={selected}
                    aria-disabled={disabled}
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
                      allowFontScaling
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
            <Text allowFontScaling style={styles.fieldLabel}>Manual local dates</Text>
            <Text allowFontScaling style={styles.helpText}>
              Enter holidays manually in the company timezone. ShiftPay has no automatic legal or country calendar.
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
    <Card testID={`pay-rule-card-${index}`}>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleBlock}>
            <Text accessibilityRole="header" allowFontScaling style={styles.cardTitle}>
              Rule {index + 1}
            </Text>
            <Text allowFontScaling style={styles.helpText}>
              {rule.enabled ? "Enabled and eligible for backend evaluation" : "Disabled and excluded from backend evaluation"}
            </Text>
          </View>
          <Switch
            accessibilityHint="Controls whether this rule can apply to future backend pay calculations."
            accessibilityLabel={`Rule ${index + 1} enabled`}
            accessibilityRole="switch"
            accessibilityState={{ checked: rule.enabled, disabled }}
            aria-checked={rule.enabled}
            aria-disabled={disabled}
            disabled={disabled}
            onValueChange={(enabled) => {
              onChange({ ...rule, enabled });
            }}
            trackColor={{ false: theme.colors.border, true: theme.colors.brand.tint }}
            thumbColor={rule.enabled ? theme.colors.brand.primary : theme.colors.ink.muted}
            value={rule.enabled}
          />
        </View>

        <FieldError message={errors[path]} />
        <FieldError message={errors[`${path}.enabled`]} />

        <FormField
          accessibilityHint="Names this premium rule in the current policy draft."
          allowFontScaling
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
          <Text allowFontScaling style={styles.fieldLabel}>Rule type</Text>
          <SegmentedControl
            accessibilityHint="Selects the condition this rule uses. Changing type resets its condition fields."
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
          accessibilityHint="Enter a percentage from zero through one thousand with up to four decimal places."
          allowFontScaling
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
          <Text allowFontScaling style={styles.warning}>A 0% premium is allowed and has no pay effect.</Text>
        ) : null}
        {canShowPreview ? (
          <View
            accessibilityLabel={`Illustrative single-rule example using company worker default. Premium plus ${(companyDefaultWorkerHourlyRate * premiumPercent / 100).toFixed(2)} ${currencyLabel} per hour. Rate with this rule only ${(companyDefaultWorkerHourlyRate * (1 + premiumPercent / 100)).toFixed(2)} ${currencyLabel} per hour. This is not a payroll calculation.`}
            accessible
            style={styles.preview}
            testID={`pay-rule-preview-${index}`}
          >
            <Text allowFontScaling style={styles.previewTitle}>Illustrative single-rule example</Text>
            <Text allowFontScaling style={styles.helpText}>
              Uses the company worker default of {String(companyDefaultWorkerHourlyRate)} {currencyLabel}/hour.
            </Text>
            <Text allowFontScaling style={styles.previewValue}>
              Premium: +{(companyDefaultWorkerHourlyRate * premiumPercent / 100).toFixed(2)} {currencyLabel}/hour
            </Text>
            <Text allowFontScaling style={styles.previewValue}>
              Rate with this rule only: {(companyDefaultWorkerHourlyRate * (1 + premiumPercent / 100)).toFixed(2)} {currencyLabel}/hour
            </Text>
            <Text allowFontScaling style={styles.helpText}>This illustration does not determine rule matches, stacking, overtime, salary, payroll, or payout.</Text>
          </View>
        ) : companyDefaultWorkerHourlyRate === null ? (
          <View style={styles.referenceNotice}>
            <Text allowFontScaling style={styles.helpText}>Set a default worker hourly rate in Company Settings to see an illustrative example.</Text>
            {onOpenCompanySettings ? <Button label="Open Company Settings" onPress={onOpenCompanySettings} variant="ghost" /> : null}
          </View>
        ) : currencyLabel === null || trimCurrencyLabelBoundaries(currencyLabel).length === 0 ? (
          <View style={styles.referenceNotice}>
            <Text allowFontScaling style={styles.helpText}>Set a currency label in Company Settings to see an illustrative example. No fallback label is assumed.</Text>
            {onOpenCompanySettings ? <Button label="Open Company Settings" onPress={onOpenCompanySettings} variant="ghost" /> : null}
          </View>
        ) : null}

        <View style={styles.conditionSection}>
          <Text accessibilityRole="header" allowFontScaling style={styles.conditionTitle}>
            Rule condition
          </Text>
          <FieldError message={errors[`${path}.condition`]} />
          {renderCondition()}
        </View>

        <Button
          accessibilityHint={`Removes rule ${index + 1} from this unsaved draft.`}
          disabled={disabled}
          label="Remove rule"
          onPress={onRemove}
          variant="ghost"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardContent: {
    gap: theme.space[4]
  },
  cardHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.space[3]
  },
  cardTitleBlock: {
    minWidth: theme.target.min,
    flexGrow: 1,
    flexShrink: 1,
    gap: theme.space[1]
  },
  cardTitle: {
    ...theme.typography.sectionTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  conditionFields: {
    gap: theme.space[2]
  },
  conditionSection: {
    gap: theme.space[3],
    borderTopWidth: theme.border.default,
    borderTopColor: theme.colors.border,
    paddingTop: theme.space[4]
  },
  conditionTitle: {
    ...theme.typography.cardTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  fieldLabel: {
    ...theme.typography.label,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  helpText: {
    ...theme.typography.supporting,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  error: {
    ...theme.typography.supporting,
    color: theme.colors.danger.fg,
    flexShrink: 1
  },
  warning: {
    ...theme.typography.supporting,
    color: theme.colors.warning.fg,
    backgroundColor: theme.colors.warning.bg,
    borderRadius: theme.radius.sm,
    padding: theme.space[2],
    flexShrink: 1
  },
  preview: {
    gap: theme.space[1],
    borderWidth: theme.border.default,
    borderColor: theme.colors.info.fg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.info.bg,
    padding: theme.space[3]
  },
  previewTitle: {
    ...theme.typography.cardTitle,
    color: theme.colors.info.fg,
    flexShrink: 1
  },
  previewValue: {
    ...theme.typography.label,
    color: theme.colors.info.fg,
    flexShrink: 1
  },
  referenceNotice: {
    gap: theme.space[2],
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface.subtle,
    padding: theme.space[3]
  },
  weekdayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space[2]
  },
  weekday: {
    minWidth: theme.target.min,
    minHeight: theme.target.min,
    maxWidth: "100%",
    flexGrow: 1,
    flexBasis: 64,
    flexShrink: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: theme.border.default,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface.default,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[2]
  },
  selectedWeekday: {
    borderColor: theme.colors.brand.primary,
    backgroundColor: theme.colors.brand.primary
  },
  weekdayLabel: {
    ...theme.typography.label,
    color: theme.colors.ink.primary,
    flexShrink: 1,
    textAlign: "center"
  },
  selectedWeekdayLabel: {
    color: theme.colors.surface.default
  },
  holidayRow: {
    gap: theme.space[2],
    borderTopWidth: theme.border.default,
    borderTopColor: theme.colors.border,
    paddingTop: theme.space[3]
  },
  pressed: {
    opacity: 0.8
  },
  disabled: {
    opacity: 0.6
  }
});
