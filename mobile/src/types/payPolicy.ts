export const PAY_POLICY_WEEKDAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY"
] as const;

export type PayPolicyWeekday = (typeof PAY_POLICY_WEEKDAYS)[number];

export type PayPolicyStackingStrategy = "ADD" | "HIGHEST_ONLY";

export type PayPolicyRuleType =
  | "TIME_OF_DAY"
  | "DAILY_OVERTIME"
  | "WEEKLY_OVERTIME"
  | "DAY_OF_WEEK"
  | "HOLIDAY";

export interface TimeOfDayCondition {
  startTime: string;
  endTime: string;
}

export interface OvertimeCondition {
  thresholdMinutes: number;
}

export interface DayOfWeekCondition {
  weekdays: PayPolicyWeekday[];
}

export interface ManualHolidayDate {
  date: string;
  label?: string | null;
}

export interface HolidayCondition {
  dates: ManualHolidayDate[];
}

export type PayPolicyRuleCondition =
  | TimeOfDayCondition
  | OvertimeCondition
  | DayOfWeekCondition
  | HolidayCondition;

interface PayPolicyRuleBase<TType extends PayPolicyRuleType, TCondition> {
  id: number;
  name: string;
  type: TType;
  enabled: boolean;
  premiumPercent: number;
  condition: TCondition;
}

export type TimeOfDayPayPolicyRule = PayPolicyRuleBase<
  "TIME_OF_DAY",
  TimeOfDayCondition
>;

export type DailyOvertimePayPolicyRule = PayPolicyRuleBase<
  "DAILY_OVERTIME",
  OvertimeCondition
>;

export type WeeklyOvertimePayPolicyRule = PayPolicyRuleBase<
  "WEEKLY_OVERTIME",
  OvertimeCondition
>;

export type DayOfWeekPayPolicyRule = PayPolicyRuleBase<
  "DAY_OF_WEEK",
  DayOfWeekCondition
>;

export type HolidayPayPolicyRule = PayPolicyRuleBase<"HOLIDAY", HolidayCondition>;

export type PayPolicyRule =
  | TimeOfDayPayPolicyRule
  | DailyOvertimePayPolicyRule
  | WeeklyOvertimePayPolicyRule
  | DayOfWeekPayPolicyRule
  | HolidayPayPolicyRule;

interface UpdatePayPolicyRuleBase<TType extends PayPolicyRuleType, TCondition> {
  name: string;
  type: TType;
  enabled: boolean;
  premiumPercent: number;
  condition: TCondition;
}

export type UpdateTimeOfDayPayPolicyRule = UpdatePayPolicyRuleBase<
  "TIME_OF_DAY",
  TimeOfDayCondition
>;

export type UpdateDailyOvertimePayPolicyRule = UpdatePayPolicyRuleBase<
  "DAILY_OVERTIME",
  OvertimeCondition
>;

export type UpdateWeeklyOvertimePayPolicyRule = UpdatePayPolicyRuleBase<
  "WEEKLY_OVERTIME",
  OvertimeCondition
>;

export type UpdateDayOfWeekPayPolicyRule = UpdatePayPolicyRuleBase<
  "DAY_OF_WEEK",
  DayOfWeekCondition
>;

export type UpdateHolidayPayPolicyRule = UpdatePayPolicyRuleBase<
  "HOLIDAY",
  HolidayCondition
>;

export type UpdatePayPolicyRule =
  | UpdateTimeOfDayPayPolicyRule
  | UpdateDailyOvertimePayPolicyRule
  | UpdateWeeklyOvertimePayPolicyRule
  | UpdateDayOfWeekPayPolicyRule
  | UpdateHolidayPayPolicyRule;

export interface PayPolicy {
  id: number;
  companyId: number;
  version: number;
  active: boolean;
  timeZone: string;
  weekStartsOn: PayPolicyWeekday;
  stackingStrategy: PayPolicyStackingStrategy;
  rules: PayPolicyRule[];
  createdAt: string;
}

export interface PayPolicyVersionSummary {
  id: number;
  companyId: number;
  version: number;
  active: boolean;
  timeZone: string;
  weekStartsOn: PayPolicyWeekday;
  stackingStrategy: PayPolicyStackingStrategy;
  ruleCount: number;
  createdAt: string;
}

export interface UpdatePayPolicyRequest {
  weekStartsOn: PayPolicyWeekday;
  stackingStrategy: PayPolicyStackingStrategy;
  rules: UpdatePayPolicyRule[];
}
