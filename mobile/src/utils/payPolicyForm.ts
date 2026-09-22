import { ApiError, getErrorMessage } from "../api/errors";
import type {
  PayPolicy,
  PayPolicyRule,
  PayPolicyRuleType,
  PayPolicyStackingStrategy,
  PayPolicyWeekday,
  UpdatePayPolicyRequest,
  UpdatePayPolicyRule
} from "../types/payPolicy";

interface PayPolicyRuleFormBase<TType extends PayPolicyRuleType, TCondition> {
  clientId: string;
  name: string;
  type: TType;
  enabled: boolean;
  premiumPercent: string;
  condition: TCondition;
}

export type TimeOfDayRuleForm = PayPolicyRuleFormBase<
  "TIME_OF_DAY",
  {
    startTime: string;
    endTime: string;
  }
>;

export type DailyOvertimeRuleForm = PayPolicyRuleFormBase<
  "DAILY_OVERTIME",
  {
    thresholdMinutes: string;
    thresholdHours: string;
    /** Loaded minutes remain authoritative until the displayed hours are edited. */
    thresholdHoursEdited?: boolean;
  }
>;

export type WeeklyOvertimeRuleForm = PayPolicyRuleFormBase<
  "WEEKLY_OVERTIME",
  {
    thresholdMinutes: string;
    thresholdHours: string;
    thresholdHoursEdited?: boolean;
  }
>;

export type DayOfWeekRuleForm = PayPolicyRuleFormBase<
  "DAY_OF_WEEK",
  {
    weekdays: PayPolicyWeekday[];
  }
>;

export interface HolidayDateForm {
  clientId: string;
  date: string;
  label: string;
}

export type HolidayRuleForm = PayPolicyRuleFormBase<
  "HOLIDAY",
  {
    dates: HolidayDateForm[];
  }
>;

export type PayPolicyRuleForm =
  | TimeOfDayRuleForm
  | DailyOvertimeRuleForm
  | WeeklyOvertimeRuleForm
  | DayOfWeekRuleForm
  | HolidayRuleForm;

export interface PayPolicyForm {
  weekStartsOn: PayPolicyWeekday;
  stackingStrategy: PayPolicyStackingStrategy;
  rules: PayPolicyRuleForm[];
}

export type PayPolicyFormErrors = Record<string, string>;

export interface PayPolicySaveError {
  fieldErrors: PayPolicyFormErrors;
  generalError?: string;
}

interface ChangedFieldPaths {
  exact: Set<string>;
  prefixes: Set<string>;
}

let nextClientId = 0;
const MAX_THRESHOLD_MINUTES = 2_147_483_647n;

function createClientId(prefix: string): string {
  nextClientId += 1;
  return `${prefix}-${nextClientId}`;
}

function numberInputValue(value: number): string {
  return String(value);
}

export function formatThresholdHours(minutes: number): string {
  return String(minutes / 60);
}

/** Parses editable hours only when they represent an in-range whole-minute API value. */
export function parseThresholdHours(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) return null;

  // Decimal input is a rational number, not a binary floating-point value.
  // This makes 8.2 × 60 exactly 492 and rejects true fractional minutes
  // without an arbitrary tolerance.
  const whole = match[1] ?? "";
  const fraction = match[2] ?? "";
  const numerator = BigInt(`${whole}${fraction}`);
  const denominator = 10n ** BigInt(fraction.length);
  const minuteNumerator = numerator * 60n;

  if (minuteNumerator % denominator !== 0n) return null;

  const minutes = minuteNumerator / denominator;
  return minutes >= 1n && minutes <= MAX_THRESHOLD_MINUTES ? Number(minutes) : null;
}

function ruleBase(rule: PayPolicyRule, index: number) {
  return {
    clientId: `policy-rule-${rule.id}-${index}`,
    name: rule.name,
    enabled: rule.enabled,
    premiumPercent: numberInputValue(rule.premiumPercent)
  };
}

function toRuleForm(rule: PayPolicyRule, index: number): PayPolicyRuleForm {
  const base = ruleBase(rule, index);

  switch (rule.type) {
    case "TIME_OF_DAY":
      return {
        ...base,
        type: rule.type,
        condition: {
          startTime: rule.condition.startTime,
          endTime: rule.condition.endTime
        }
      };
    case "DAILY_OVERTIME":
    case "WEEKLY_OVERTIME":
      return {
        ...base,
        type: rule.type,
        condition: {
          thresholdMinutes: numberInputValue(rule.condition.thresholdMinutes),
          thresholdHours: formatThresholdHours(rule.condition.thresholdMinutes),
          thresholdHoursEdited: false
        }
      };
    case "DAY_OF_WEEK":
      return {
        ...base,
        type: rule.type,
        condition: {
          weekdays: [...rule.condition.weekdays]
        }
      };
    case "HOLIDAY":
      return {
        ...base,
        type: rule.type,
        condition: {
          dates: rule.condition.dates.map((holiday, holidayIndex) => ({
            clientId: `policy-rule-${rule.id}-holiday-${holidayIndex}`,
            date: holiday.date,
            label: holiday.label ?? ""
          }))
        }
      };
  }
}

export function hydratePayPolicyForm(policy: PayPolicy): PayPolicyForm {
  return {
    weekStartsOn: policy.weekStartsOn,
    stackingStrategy: policy.stackingStrategy,
    rules: policy.rules.map(toRuleForm)
  };
}

export function createEmptyPayPolicyRule(
  type: PayPolicyRuleType = "TIME_OF_DAY"
): PayPolicyRuleForm {
  const base = {
    clientId: createClientId("new-policy-rule"),
    name: "",
    enabled: true,
    premiumPercent: ""
  };

  switch (type) {
    case "TIME_OF_DAY":
      return {
        ...base,
        type,
        condition: {
          startTime: "",
          endTime: ""
        }
      };
    case "DAILY_OVERTIME":
    case "WEEKLY_OVERTIME":
      return {
        ...base,
        type,
        condition: {
          thresholdMinutes: "",
          thresholdHours: "",
          thresholdHoursEdited: true
        }
      };
    case "DAY_OF_WEEK":
      return {
        ...base,
        type,
        condition: {
          weekdays: []
        }
      };
    case "HOLIDAY":
      return {
        ...base,
        type,
        condition: {
          dates: []
        }
      };
  }
}

export function changePayPolicyRuleType(
  rule: PayPolicyRuleForm,
  type: PayPolicyRuleType
): PayPolicyRuleForm {
  if (rule.type === type) {
    return rule;
  }

  const changedRule = createEmptyPayPolicyRule(type);
  return {
    ...changedRule,
    clientId: rule.clientId,
    name: rule.name,
    enabled: rule.enabled,
    premiumPercent: rule.premiumPercent
  };
}

export function createEmptyHolidayDate(): HolidayDateForm {
  return {
    clientId: createClientId("new-holiday"),
    date: "",
    label: ""
  };
}

function parseLocalTime(value: string): number | null {
  const match = /^(?:([01]\d|2[0-3])):([0-5]\d)(?::([0-5]\d))?$/.exec(value.trim());

  if (!match) {
    return null;
  }

  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0);
}

function isValidLocalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1) {
    return false;
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function parsePremiumPercent(value: string): number | null {
  const normalized = value.trim().replace(",", ".");

  if (!/^\d+(?:\.\d{1,4})?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1000 ? parsed : null;
}

function parseThresholdMinutes(value: string): number | null {
  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = BigInt(normalized);
  return parsed >= 1n && parsed <= MAX_THRESHOLD_MINUTES ? Number(parsed) : null;
}

function validateTimeOfDayRule(
  rule: TimeOfDayRuleForm,
  path: string,
  errors: PayPolicyFormErrors
): void {
  const startTime = rule.condition.startTime.trim();
  const endTime = rule.condition.endTime.trim();
  const parsedStartTime = parseLocalTime(startTime);
  const parsedEndTime = parseLocalTime(endTime);

  if (parsedStartTime === null) {
    errors[`${path}.condition.startTime`] = "Use a valid 24-hour local time.";
  }

  if (parsedEndTime === null) {
    errors[`${path}.condition.endTime`] = "Use a valid 24-hour local time.";
  } else if (parsedStartTime !== null && parsedStartTime === parsedEndTime) {
    errors[`${path}.condition.endTime`] = "End time must be different from start time.";
  }
}

function validateOvertimeRule(
  rule: DailyOvertimeRuleForm | WeeklyOvertimeRuleForm,
  path: string,
  errors: PayPolicyFormErrors
): void {
  const minutes = rule.condition.thresholdHoursEdited !== true
    ? parseThresholdMinutes(rule.condition.thresholdMinutes)
    : parseThresholdHours(rule.condition.thresholdHours);

  if (minutes === null) {
    errors[`${path}.condition.thresholdMinutes`] =
      "Enter hours from 1 through 2147483647 minutes with no fractional minutes.";
  }
}

function validateDayOfWeekRule(
  rule: DayOfWeekRuleForm,
  path: string,
  errors: PayPolicyFormErrors
): void {
  if (rule.condition.weekdays.length === 0) {
    errors[`${path}.condition.weekdays`] = "Select at least one weekday.";
  }
}

function validateHolidayRule(
  rule: HolidayRuleForm,
  path: string,
  errors: PayPolicyFormErrors
): void {
  if (rule.condition.dates.length === 0) {
    errors[`${path}.condition.dates`] = "Add at least one local holiday date.";
    return;
  }

  rule.condition.dates.forEach((holiday, holidayIndex) => {
    if (!isValidLocalDate(holiday.date)) {
      errors[`${path}.condition.dates[${holidayIndex}].date`] =
        "Use a valid local date in YYYY-MM-DD format.";
    }
  });
}

export function validatePayPolicyForm(form: PayPolicyForm): PayPolicyFormErrors {
  const errors: PayPolicyFormErrors = {};

  form.rules.forEach((rule, index) => {
    const path = `rules[${index}]`;

    if (parsePremiumPercent(rule.premiumPercent) === null) {
      errors[`${path}.premiumPercent`] =
        "Enter 0 through 1000 with no more than 4 decimal places.";
    }

    switch (rule.type) {
      case "TIME_OF_DAY":
        validateTimeOfDayRule(rule, path, errors);
        break;
      case "DAILY_OVERTIME":
      case "WEEKLY_OVERTIME":
        validateOvertimeRule(rule, path, errors);
        break;
      case "DAY_OF_WEEK":
        validateDayOfWeekRule(rule, path, errors);
        break;
      case "HOLIDAY":
        validateHolidayRule(rule, path, errors);
        break;
    }
  });

  return errors;
}

function serializeRule(rule: PayPolicyRuleForm): UpdatePayPolicyRule {
  const base = {
    name: rule.name.trim(),
    enabled: rule.enabled,
    premiumPercent: parsePremiumPercent(rule.premiumPercent) ?? 0
  };

  switch (rule.type) {
    case "TIME_OF_DAY":
      return {
        ...base,
        type: rule.type,
        condition: {
          startTime: rule.condition.startTime.trim(),
          endTime: rule.condition.endTime.trim()
        }
      };
    case "DAILY_OVERTIME":
    case "WEEKLY_OVERTIME":
      return {
        ...base,
        type: rule.type,
        condition: {
          thresholdMinutes:
            rule.condition.thresholdHoursEdited !== true
              ? parseThresholdMinutes(rule.condition.thresholdMinutes) ?? 0
              : parseThresholdHours(rule.condition.thresholdHours) ?? 0
        }
      };
    case "DAY_OF_WEEK":
      return {
        ...base,
        type: rule.type,
        condition: {
          weekdays: [...rule.condition.weekdays]
        }
      };
    case "HOLIDAY":
      return {
        ...base,
        type: rule.type,
        condition: {
          dates: rule.condition.dates.map((holiday) => {
            const label = holiday.label.trim();
            return {
              date: holiday.date.trim(),
              ...(label.length > 0 ? { label } : {})
            };
          })
        }
      };
  }
}

export function serializePayPolicyForm(form: PayPolicyForm): UpdatePayPolicyRequest {
  return {
    weekStartsOn: form.weekStartsOn,
    stackingStrategy: form.stackingStrategy,
    rules: form.rules.map(serializeRule)
  };
}

function conditionPathExists(rule: PayPolicyRuleForm, suffix: string): boolean {
  if (suffix === "condition") {
    return true;
  }

  switch (rule.type) {
    case "TIME_OF_DAY":
      return suffix === "condition.startTime" || suffix === "condition.endTime";
    case "DAILY_OVERTIME":
    case "WEEKLY_OVERTIME":
      return suffix === "condition.thresholdMinutes" || suffix === "condition.thresholdHours";
    case "DAY_OF_WEEK":
      return suffix === "condition.weekdays";
    case "HOLIDAY": {
      if (suffix === "condition.dates") {
        return true;
      }

      const dateMatch = /^condition\.dates\[(\d+)\](?:\.(date|label))?$/.exec(suffix);
      if (!dateMatch) {
        return false;
      }

      const holidayIndex = Number(dateMatch[1]);
      return holidayIndex >= 0 && holidayIndex < rule.condition.dates.length;
    }
  }
}

function isRecognizedFieldPath(path: string, form: PayPolicyForm): boolean {
  if (path === "weekStartsOn" || path === "stackingStrategy") {
    return true;
  }

  const ruleMatch = /^rules\[(\d+)\](?:\.(.+))?$/.exec(path);
  if (!ruleMatch) {
    return false;
  }

  const ruleIndex = Number(ruleMatch[1]);
  const rule = form.rules[ruleIndex];
  const suffix = ruleMatch[2];

  if (!rule || suffix === undefined) {
    return Boolean(rule);
  }

  if (
    suffix === "name" ||
    suffix === "type" ||
    suffix === "enabled" ||
    suffix === "premiumPercent"
  ) {
    return true;
  }

  return conditionPathExists(rule, suffix);
}

function mapExistingErrorPath(
  path: string,
  previousForm: PayPolicyForm,
  nextForm: PayPolicyForm
): string | null {
  if (path === "weekStartsOn" || path === "stackingStrategy") {
    return path;
  }

  const ruleMatch = /^rules\[(\d+)\](?:\.(.+))?$/.exec(path);
  if (!ruleMatch) {
    return null;
  }

  const previousRuleIndex = Number(ruleMatch[1]);
  const previousRule = previousForm.rules[previousRuleIndex];
  if (!previousRule) {
    return null;
  }

  const nextRuleIndex = nextForm.rules.findIndex(
    (rule) => rule.clientId === previousRule.clientId
  );
  if (nextRuleIndex < 0) {
    return null;
  }

  const suffix = ruleMatch[2];
  if (!suffix) {
    return `rules[${nextRuleIndex}]`;
  }

  const holidayMatch = /^condition\.dates\[(\d+)\](.*)$/.exec(suffix);
  if (
    holidayMatch &&
    previousRule.type === "HOLIDAY" &&
    nextForm.rules[nextRuleIndex]?.type === "HOLIDAY"
  ) {
    const previousHoliday = previousRule.condition.dates[Number(holidayMatch[1])];
    const nextRule = nextForm.rules[nextRuleIndex];
    if (!previousHoliday || nextRule?.type !== "HOLIDAY") {
      return null;
    }

    const nextHolidayIndex = nextRule.condition.dates.findIndex(
      (holiday) => holiday.clientId === previousHoliday.clientId
    );
    if (nextHolidayIndex < 0) {
      return null;
    }

    const mappedHolidayPath = `rules[${nextRuleIndex}].condition.dates[${nextHolidayIndex}]${holidayMatch[2] ?? ""}`;
    return isRecognizedFieldPath(mappedHolidayPath, nextForm)
      ? mappedHolidayPath
      : null;
  }

  const mappedPath = `rules[${nextRuleIndex}].${suffix}`;
  return isRecognizedFieldPath(mappedPath, nextForm) ? mappedPath : null;
}

function valuesEqual<TValue>(first: readonly TValue[], second: readonly TValue[]): boolean {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
}

function collectChangedFieldPaths(
  previousForm: PayPolicyForm,
  nextForm: PayPolicyForm
): ChangedFieldPaths {
  const changed: ChangedFieldPaths = {
    exact: new Set<string>(),
    prefixes: new Set<string>()
  };

  if (previousForm.weekStartsOn !== nextForm.weekStartsOn) {
    changed.exact.add("weekStartsOn");
  }
  if (previousForm.stackingStrategy !== nextForm.stackingStrategy) {
    changed.exact.add("stackingStrategy");
  }

  previousForm.rules.forEach((previousRule) => {
    const nextRuleIndex = nextForm.rules.findIndex(
      (rule) => rule.clientId === previousRule.clientId
    );
    if (nextRuleIndex < 0) {
      return;
    }

    const nextRule = nextForm.rules[nextRuleIndex];
    if (!nextRule) {
      return;
    }

    const rulePath = `rules[${nextRuleIndex}]`;
    let anyRuleFieldChanged = false;
    let anyConditionFieldChanged = false;

    const markRuleField = (suffix: string) => {
      changed.exact.add(`${rulePath}.${suffix}`);
      anyRuleFieldChanged = true;
    };
    const markConditionField = (suffix: string) => {
      changed.exact.add(`${rulePath}.condition.${suffix}`);
      anyConditionFieldChanged = true;
      anyRuleFieldChanged = true;
    };

    if (previousRule.name !== nextRule.name) {
      markRuleField("name");
    }
    if (previousRule.enabled !== nextRule.enabled) {
      markRuleField("enabled");
    }
    if (previousRule.premiumPercent !== nextRule.premiumPercent) {
      markRuleField("premiumPercent");
    }
    if (previousRule.type !== nextRule.type) {
      markRuleField("type");
      changed.prefixes.add(`${rulePath}.condition`);
      anyConditionFieldChanged = true;
    } else {
      switch (previousRule.type) {
        case "TIME_OF_DAY":
          if (
            nextRule.type === "TIME_OF_DAY" &&
            (previousRule.condition.startTime !== nextRule.condition.startTime ||
              previousRule.condition.endTime !== nextRule.condition.endTime)
          ) {
            markConditionField("startTime");
            markConditionField("endTime");
          }
          break;
        case "DAILY_OVERTIME":
        case "WEEKLY_OVERTIME":
          if (
            nextRule.type === previousRule.type &&
            (previousRule.condition.thresholdMinutes !== nextRule.condition.thresholdMinutes ||
              previousRule.condition.thresholdHours !== nextRule.condition.thresholdHours ||
              previousRule.condition.thresholdHoursEdited !== nextRule.condition.thresholdHoursEdited)
          ) {
            markConditionField("thresholdMinutes");
          }
          break;
        case "DAY_OF_WEEK":
          if (
            nextRule.type === "DAY_OF_WEEK" &&
            !valuesEqual(
              previousRule.condition.weekdays,
              nextRule.condition.weekdays
            )
          ) {
            markConditionField("weekdays");
          }
          break;
        case "HOLIDAY":
          if (nextRule.type === "HOLIDAY") {
            const previousIds = previousRule.condition.dates.map(
              (holiday) => holiday.clientId
            );
            const nextIds = nextRule.condition.dates.map((holiday) => holiday.clientId);
            if (!valuesEqual(previousIds, nextIds)) {
              markConditionField("dates");
            }

            previousRule.condition.dates.forEach((previousHoliday) => {
              const nextHolidayIndex = nextRule.condition.dates.findIndex(
                (holiday) => holiday.clientId === previousHoliday.clientId
              );
              if (nextHolidayIndex < 0) {
                return;
              }

              const nextHoliday = nextRule.condition.dates[nextHolidayIndex];
              if (!nextHoliday) {
                return;
              }

              if (previousHoliday.date !== nextHoliday.date) {
                markConditionField(`dates[${nextHolidayIndex}].date`);
                changed.exact.add(`${rulePath}.condition.dates`);
              }
              if (previousHoliday.label !== nextHoliday.label) {
                markConditionField(`dates[${nextHolidayIndex}].label`);
              }
            });
          }
          break;
      }
    }

    if (anyConditionFieldChanged) {
      changed.exact.add(`${rulePath}.condition`);
    }
    if (anyRuleFieldChanged) {
      changed.exact.add(rulePath);
    }
  });

  return changed;
}

function isChangedFieldPath(path: string, changed: ChangedFieldPaths): boolean {
  if (changed.exact.has(path)) {
    return true;
  }

  return [...changed.prefixes].some(
    (prefix) => path === prefix || path.startsWith(`${prefix}.`)
  );
}

export function reconcilePayPolicyFormErrors(
  previousForm: PayPolicyForm,
  nextForm: PayPolicyForm,
  previousErrors: PayPolicyFormErrors
): PayPolicyFormErrors {
  const changed = collectChangedFieldPaths(previousForm, nextForm);
  const nextValidationErrors = validatePayPolicyForm(nextForm);
  const reconciledErrors: PayPolicyFormErrors = {};

  Object.entries(previousErrors).forEach(([path, message]) => {
    const mappedPath = mapExistingErrorPath(path, previousForm, nextForm);
    if (mappedPath && !isChangedFieldPath(mappedPath, changed)) {
      reconciledErrors[mappedPath] = message;
    }
  });

  Object.entries(nextValidationErrors).forEach(([path, message]) => {
    if (isChangedFieldPath(path, changed)) {
      reconciledErrors[path] = message;
    }
  });

  return reconciledErrors;
}

export function mapPayPolicySaveError(
  error: unknown,
  form: PayPolicyForm
): PayPolicySaveError {
  if (error instanceof ApiError && error.status === 400) {
    const fieldErrorMatch = /^([^:]+):\s*(.+)$/.exec(error.message);

    if (fieldErrorMatch) {
      const path = fieldErrorMatch[1]?.trim() ?? "";
      const message = fieldErrorMatch[2]?.trim() ?? "";

      if (path && message && isRecognizedFieldPath(path, form)) {
        return {
          fieldErrors: {
            [path]: message
          }
        };
      }
    }

    return {
      fieldErrors: {},
      generalError: "Could not save pay rules. Review the form and try again."
    };
  }

  return {
    fieldErrors: {},
    generalError: getErrorMessage(error)
  };
}

export function isZeroPremiumPercent(value: string): boolean {
  return parsePremiumPercent(value) === 0;
}
