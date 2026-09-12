import { ApiError } from "../../api/errors";
import type { PayPolicy } from "../../types/payPolicy";
import {
  createEmptyHolidayDate,
  createEmptyPayPolicyRule,
  hydratePayPolicyForm,
  mapPayPolicySaveError,
  reconcilePayPolicyFormErrors,
  serializePayPolicyForm,
  validatePayPolicyForm,
  type PayPolicyForm
} from "../payPolicyForm";

function emptyPolicy(overrides: Partial<PayPolicy> = {}): PayPolicy {
  return {
    id: 2000,
    companyId: 10,
    version: 1,
    active: true,
    timeZone: "Europe/Berlin",
    weekStartsOn: "MONDAY",
    stackingStrategy: "ADD",
    rules: [],
    createdAt: "2026-07-01T10:00:00Z",
    ...overrides
  };
}

describe("pay policy form mapping and validation", () => {
  it("round-trips an empty policy and preserves a backend-returned week start", () => {
    const form = hydratePayPolicyForm(
      emptyPolicy({
        weekStartsOn: "WEDNESDAY",
        stackingStrategy: "HIGHEST_ONLY"
      })
    );

    expect(validatePayPolicyForm(form)).toEqual({});
    expect(serializePayPolicyForm(form)).toEqual({
      weekStartsOn: "WEDNESDAY",
      stackingStrategy: "HIGHEST_ONLY",
      rules: []
    });
  });

  it("serializes decimal percentages and all discriminated rule conditions", () => {
    const policy = emptyPolicy({
      rules: [
        {
          id: 1,
          name: "Night",
          type: "TIME_OF_DAY",
          enabled: true,
          premiumPercent: 37.5,
          condition: { startTime: "22:00:00", endTime: "06:00:00" }
        },
        {
          id: 2,
          name: "Daily",
          type: "DAILY_OVERTIME",
          enabled: true,
          premiumPercent: 50,
          condition: { thresholdMinutes: 480 }
        },
        {
          id: 3,
          name: "Weekly",
          type: "WEEKLY_OVERTIME",
          enabled: false,
          premiumPercent: 0,
          condition: { thresholdMinutes: 2400 }
        },
        {
          id: 4,
          name: "Custom days",
          type: "DAY_OF_WEEK",
          enabled: true,
          premiumPercent: 12.25,
          condition: { weekdays: ["TUESDAY", "THURSDAY", "SATURDAY"] }
        },
        {
          id: 5,
          name: "Company holidays",
          type: "HOLIDAY",
          enabled: true,
          premiumPercent: 1000,
          condition: {
            dates: [
              { date: "2026-12-24", label: "Christmas Eve" },
              { date: "2026-12-31", label: null }
            ]
          }
        }
      ]
    });
    const form = hydratePayPolicyForm(policy);

    expect(validatePayPolicyForm(form)).toEqual({});
    expect(serializePayPolicyForm(form)).toEqual({
      weekStartsOn: "MONDAY",
      stackingStrategy: "ADD",
      rules: [
        {
          name: "Night",
          type: "TIME_OF_DAY",
          enabled: true,
          premiumPercent: 37.5,
          condition: { startTime: "22:00:00", endTime: "06:00:00" }
        },
        {
          name: "Daily",
          type: "DAILY_OVERTIME",
          enabled: true,
          premiumPercent: 50,
          condition: { thresholdMinutes: 480 }
        },
        {
          name: "Weekly",
          type: "WEEKLY_OVERTIME",
          enabled: false,
          premiumPercent: 0,
          condition: { thresholdMinutes: 2400 }
        },
        {
          name: "Custom days",
          type: "DAY_OF_WEEK",
          enabled: true,
          premiumPercent: 12.25,
          condition: { weekdays: ["TUESDAY", "THURSDAY", "SATURDAY"] }
        },
        {
          name: "Company holidays",
          type: "HOLIDAY",
          enabled: true,
          premiumPercent: 1000,
          condition: {
            dates: [
              { date: "2026-12-24", label: "Christmas Eve" },
              { date: "2026-12-31" }
            ]
          }
        }
      ]
    });
  });

  it("accepts zero and four decimal places while rejecting range and scale errors", () => {
    const rule = createEmptyPayPolicyRule("DAILY_OVERTIME");
    if (rule.type !== "DAILY_OVERTIME") {
      throw new Error("Expected daily overtime form");
    }

    const form: PayPolicyForm = {
      weekStartsOn: "MONDAY",
      stackingStrategy: "ADD",
      rules: [
        {
          ...rule,
          premiumPercent: "0.0000",
          condition: { thresholdMinutes: "480" }
        }
      ]
    };

    expect(validatePayPolicyForm(form)).toEqual({});
    expect(serializePayPolicyForm(form).rules[0]?.premiumPercent).toBe(0);

    form.rules[0] = { ...form.rules[0]!, premiumPercent: "1000.0000" };
    expect(validatePayPolicyForm(form)).toEqual({});
    expect(serializePayPolicyForm(form).rules[0]?.premiumPercent).toBe(1000);

    form.rules[0] = { ...form.rules[0]!, premiumPercent: "10.12345" };
    expect(validatePayPolicyForm(form)["rules[0].premiumPercent"]).toBeDefined();

    form.rules[0] = { ...form.rules[0]!, premiumPercent: "1000.0001" };
    expect(validatePayPolicyForm(form)["rules[0].premiumPercent"]).toBeDefined();
  });

  it("accepts cross-midnight time and rejects semantically equal endpoints", () => {
    const rule = createEmptyPayPolicyRule("TIME_OF_DAY");
    if (rule.type !== "TIME_OF_DAY") {
      throw new Error("Expected time-of-day form");
    }

    const form: PayPolicyForm = {
      weekStartsOn: "MONDAY",
      stackingStrategy: "ADD",
      rules: [
        {
          ...rule,
          premiumPercent: "25",
          condition: { startTime: "22:00", endTime: "06:00" }
        }
      ]
    };

    expect(validatePayPolicyForm(form)).toEqual({});

    form.rules[0] = {
      ...rule,
      premiumPercent: "25",
      condition: { startTime: "08:00", endTime: "08:00:00" }
    };
    expect(validatePayPolicyForm(form)["rules[0].condition.endTime"]).toBeDefined();
  });

  it("validates overtime, arbitrary weekdays, and explicit holiday dates", () => {
    const daily = createEmptyPayPolicyRule("DAILY_OVERTIME");
    const weekdays = createEmptyPayPolicyRule("DAY_OF_WEEK");
    const holiday = createEmptyPayPolicyRule("HOLIDAY");

    if (
      daily.type !== "DAILY_OVERTIME" ||
      weekdays.type !== "DAY_OF_WEEK" ||
      holiday.type !== "HOLIDAY"
    ) {
      throw new Error("Unexpected rule form type");
    }

    const date = createEmptyHolidayDate();
    const form: PayPolicyForm = {
      weekStartsOn: "SUNDAY",
      stackingStrategy: "HIGHEST_ONLY",
      rules: [
        { ...daily, premiumPercent: "50", condition: { thresholdMinutes: "0" } },
        {
          ...weekdays,
          premiumPercent: "12.5",
          condition: { weekdays: ["MONDAY", "WEDNESDAY", "FRIDAY"] }
        },
        {
          ...holiday,
          premiumPercent: "100",
          condition: {
            dates: [{ ...date, date: "2026-02-29", label: "  Optional label  " }]
          }
        }
      ]
    };

    const errors = validatePayPolicyForm(form);
    expect(errors["rules[0].condition.thresholdMinutes"]).toBeDefined();
    expect(errors["rules[2].condition.dates[0].date"]).toBeDefined();
    expect(errors["rules[1].condition.weekdays"]).toBeUndefined();

    form.rules[0] = { ...daily, premiumPercent: "50", condition: { thresholdMinutes: "1" } };
    form.rules[2] = {
      ...holiday,
      premiumPercent: "100",
      condition: { dates: [{ ...date, date: "2028-02-29", label: "  Optional label  " }] }
    };

    expect(validatePayPolicyForm(form)).toEqual({});
    expect(serializePayPolicyForm(form).rules[2]).toMatchObject({
      condition: {
        dates: [{ date: "2028-02-29", label: "Optional label" }]
      }
    });
  });

  it("maps recognized backend field paths and keeps unknown 400 errors general", () => {
    const rule = createEmptyPayPolicyRule("TIME_OF_DAY");
    const form: PayPolicyForm = {
      weekStartsOn: "MONDAY",
      stackingStrategy: "ADD",
      rules: [{ ...rule, premiumPercent: "25" }]
    };

    expect(
      mapPayPolicySaveError(
        new ApiError(
          "rules[0].condition.endTime: must be different from startTime",
          400
        ),
        form
      )
    ).toEqual({
      fieldErrors: {
        "rules[0].condition.endTime": "must be different from startTime"
      }
    });

    expect(
      mapPayPolicySaveError(new ApiError("internalField: invalid", 400), form)
    ).toEqual({
      fieldErrors: {},
      generalError: "Could not save pay rules. Review the form and try again."
    });
  });

  it("preserves unrelated backend errors while clearing an edited field error", () => {
    const previousForm = hydratePayPolicyForm(
      emptyPolicy({
        rules: [
          {
            id: 1,
            name: "Night",
            type: "TIME_OF_DAY",
            enabled: true,
            premiumPercent: 25,
            condition: { startTime: "22:00", endTime: "06:00" }
          },
          {
            id: 2,
            name: "Daily",
            type: "DAILY_OVERTIME",
            enabled: true,
            premiumPercent: 50,
            condition: { thresholdMinutes: 480 }
          }
        ]
      })
    );
    const firstRule = previousForm.rules[0];
    if (!firstRule) {
      throw new Error("Expected first rule");
    }

    const nextForm: PayPolicyForm = {
      ...previousForm,
      rules: [
        { ...firstRule, premiumPercent: "37.5" },
        ...previousForm.rules.slice(1)
      ]
    };

    expect(
      reconcilePayPolicyFormErrors(previousForm, nextForm, {
        "rules[0].premiumPercent": "backend premium error",
        "rules[1].name": "backend name error"
      })
    ).toEqual({
      "rules[1].name": "backend name error"
    });
  });

  it("drops removed-rule errors and reindexes errors for rules that remain", () => {
    const previousForm = hydratePayPolicyForm(
      emptyPolicy({
        rules: [
          {
            id: 1,
            name: "Night",
            type: "TIME_OF_DAY",
            enabled: true,
            premiumPercent: 25,
            condition: { startTime: "22:00", endTime: "06:00" }
          },
          {
            id: 2,
            name: "Daily",
            type: "DAILY_OVERTIME",
            enabled: true,
            premiumPercent: 50,
            condition: { thresholdMinutes: 480 }
          }
        ]
      })
    );
    const nextForm: PayPolicyForm = {
      ...previousForm,
      rules: previousForm.rules.slice(1)
    };

    expect(
      reconcilePayPolicyFormErrors(previousForm, nextForm, {
        "rules[0].premiumPercent": "removed rule error",
        "rules[1].condition.thresholdMinutes": "remaining rule error"
      })
    ).toEqual({
      "rules[0].condition.thresholdMinutes": "remaining rule error"
    });
  });

  it("reindexes a remaining holiday field error after another date is removed", () => {
    const previousForm = hydratePayPolicyForm(
      emptyPolicy({
        rules: [
          {
            id: 1,
            name: "Holidays",
            type: "HOLIDAY",
            enabled: true,
            premiumPercent: 100,
            condition: {
              dates: [
                { date: "2026-12-24", label: "Christmas Eve" },
                { date: "2026-12-31" }
              ]
            }
          }
        ]
      })
    );
    const holidayRule = previousForm.rules[0];
    if (holidayRule?.type !== "HOLIDAY") {
      throw new Error("Expected holiday rule");
    }

    const nextForm: PayPolicyForm = {
      ...previousForm,
      rules: [
        {
          ...holidayRule,
          condition: { dates: holidayRule.condition.dates.slice(1) }
        }
      ]
    };

    expect(
      reconcilePayPolicyFormErrors(previousForm, nextForm, {
        "rules[0].condition.dates[1].date": "remaining holiday error"
      })
    ).toEqual({
      "rules[0].condition.dates[0].date": "remaining holiday error"
    });
  });

  it("preserves backend condition errors when only enabled changes", () => {
    const previousForm = hydratePayPolicyForm(
      emptyPolicy({
        rules: [
          {
            id: 1,
            name: "Holidays",
            type: "HOLIDAY",
            enabled: true,
            premiumPercent: 100,
            condition: {
              dates: [
                { date: "2026-12-25", label: "First" },
                { date: "2026-12-25", label: "Duplicate" }
              ]
            }
          }
        ]
      })
    );
    const holidayRule = previousForm.rules[0];
    if (holidayRule?.type !== "HOLIDAY") {
      throw new Error("Expected holiday rule");
    }

    const nextForm: PayPolicyForm = {
      ...previousForm,
      rules: [{ ...holidayRule, enabled: false }]
    };

    expect(
      reconcilePayPolicyFormErrors(previousForm, nextForm, {
        "rules[0].enabled": "enabled backend error",
        "rules[0].condition.dates": "must not contain duplicate dates"
      })
    ).toEqual({
      "rules[0].condition.dates": "must not contain duplicate dates"
    });
  });
});
