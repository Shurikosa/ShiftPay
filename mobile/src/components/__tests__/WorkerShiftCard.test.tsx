import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { StyleSheet, View, type TextStyle } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { PayCalculation, SnapshotStatus } from "../../types/payCalculation";
import type { WorkerShiftHistoryItem } from "../../types/shifts";
import {
  formatDateTime,
  formatMoneyWithCurrencyLabel
} from "../../utils/format";
import { theme } from "../../utils/theme";
import { StatusBadge } from "../StatusBadge";
import { WorkerShiftCard } from "../WorkerShiftCard";

jest.mock("@expo/vector-icons/Ionicons", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text: NativeText } = jest.requireActual<typeof import("react-native")>(
    "react-native"
  );
  const MockIonicons = (props: Record<string, unknown>) =>
    React.createElement(NativeText, props as ComponentProps<typeof NativeText>);

  return { __esModule: true, default: MockIonicons };
});

function calculationFixture(snapshotStatus: SnapshotStatus): PayCalculation {
  return {
    snapshotStatus,
    totalRawSeconds: 3600,
    totalRawMinutesExact: 60,
    totalBaseAmount: 20,
    totalPremiumAmount: 5,
    totalAmount: 25,
    segments: [
      {
        snapshotStatus: "COMPLETE",
        start: "2026-07-05T22:00:00Z",
        end: "2026-07-05T23:00:00Z",
        payableSeconds: 3600,
        payableMinutesExact: 60,
        payableMinutes: 60,
        baseHourlyRate: 20,
        appliedRules: [
          {
            id: 3001,
            name: "Night premium",
            type: "TIME_OF_DAY",
            premiumPercent: 25
          }
        ],
        stackingStrategy: "ADD",
        effectivePremiumPercent: 25,
        effectiveHourlyRate: 25,
        baseAmount: 20,
        premiumAmount: 5,
        totalAmount: 25
      }
    ]
  };
}

function shiftFixture(
  overrides: Partial<WorkerShiftHistoryItem> = {}
): WorkerShiftHistoryItem {
  return {
    shiftId: 100,
    attendanceId: 500,
    companyId: 10,
    companyName: "Acme Construction",
    currencyLabel: "EUR",
    title: "Sunday night shift",
    location: "Cologne",
    status: "CLOSED",
    actualStartTime: "2026-07-05T22:00:00Z",
    actualEndTime: "2026-07-05T23:00:00Z",
    attendanceStatus: "APPROVED",
    paymentStatus: "UNPAID",
    paidAt: null,
    hourlyRate: 20,
    breakMinutes: 0,
    payableStartTime: "2026-07-05T22:05:00Z",
    pauseMinutes: 0,
    workedMinutes: 60,
    calculatedSalary: 25,
    payCalculation: calculationFixture("COMPLETE"),
    pauseState: {
      allPaused: false,
      allPauseStartedAt: null,
      personallyPaused: false,
      personalPauseStartedAt: null,
      effectivePauseMinutes: 0
    },
    ...overrides
  };
}

async function renderCard(
  shift: WorkerShiftHistoryItem,
  onPress?: () => void
): Promise<ReactTestRenderer> {
  let view!: ReactTestRenderer;
  await act(async () => {
    view = create(<WorkerShiftCard onPress={onPress} shift={shift} />);
  });
  return view;
}

function renderedText(view: ReactTestRenderer): string {
  return JSON.stringify(view.toJSON());
}

function badgeLabels(view: ReactTestRenderer): string[] {
  return view.root.findAllByType(StatusBadge).map((badge) => badge.props.label);
}

function actionableCard(view: ReactTestRenderer) {
  return view.root.find(
    (node) =>
      node.props.accessibilityRole === "button" &&
      typeof node.props.style === "function"
  );
}

function contentContainer(view: ReactTestRenderer) {
  return view.root.findAllByType(View).find((node) => {
    const style = StyleSheet.flatten(node.props.style);
    return (
      style?.flexShrink === 1 &&
      style?.gap === theme.space[3] &&
      style?.maxWidth === "100%"
    );
  })!;
}

describe("WorkerShiftCard", () => {
  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("presents OPEN and JOINED as separate canonical status dimensions", async () => {
    const view = await renderCard(
      shiftFixture({
        actualStartTime: null,
        attendanceStatus: "JOINED",
        calculatedSalary: null,
        payCalculation: undefined,
        payableStartTime: null,
        paymentStatus: null,
        status: "OPEN",
        workedMinutes: null
      })
    );

    expect(badgeLabels(view)).toEqual(["Open", "Waiting for approval"]);
    expect(renderedText(view)).toContain("Start time pending");
    expect(renderedText(view)).toContain("Worked time pending");
    expect(renderedText(view)).toContain("Salary pending");
  });

  it("presents ACTIVE and APPROVED independently with returned timing metadata", async () => {
    const shift = shiftFixture({
      attendanceStatus: "APPROVED",
      payCalculation: undefined,
      paymentStatus: null,
      status: "ACTIVE"
    });
    const view = await renderCard(shift);

    expect(badgeLabels(view)).toEqual(["Active", "Attendance approved"]);
    expect(renderedText(view)).toContain(
      `Started ${formatDateTime(shift.actualStartTime)}`
    );
    expect(renderedText(view)).toContain(
      `Pay starts ${formatDateTime(shift.payableStartTime)}`
    );
  });

  it.each([
    [true, false, ["Personal pause active"]],
    [false, true, ["Crew pause active"]],
    [true, true, ["Personal pause active", "Crew pause active"]]
  ])(
    "keeps personal=%s and crew=%s pause badges explicit",
    async (personallyPaused, allPaused, expected) => {
      const view = await renderCard(
        shiftFixture({
          pauseState: {
            allPaused,
            allPauseStartedAt: allPaused ? "2026-07-05T22:30:00Z" : null,
            personallyPaused,
            personalPauseStartedAt: personallyPaused
              ? "2026-07-05T22:20:00Z"
              : null,
            effectivePauseMinutes: 5
          }
        }),
        jest.fn()
      );

      for (const label of expected) {
        expect(badgeLabels(view)).toContain(label);
      }
      expect(
        badgeLabels(view).filter((label) => label.includes("pause active"))
      ).toEqual(expected);
      const announcement = actionableCard(view).props.accessibilityLabel as string;
      for (const label of expected) {
        expect(announcement).toContain(`${label}.`);
      }
      if (!personallyPaused) {
        expect(announcement).not.toContain("Personal pause active.");
      }
      if (!allPaused) {
        expect(announcement).not.toContain("Crew pause active.");
      }
    }
  );

  it.each([
    ["UNPAID", "Unpaid"],
    ["PAYMENT_REQUESTED", "Payment requested"],
    ["PAID", "Paid"]
  ] as const)("shows CLOSED payment state %s without inferring another state", async (status, label) => {
    const view = await renderCard(shiftFixture({ paymentStatus: status }));
    const labels = badgeLabels(view);

    expect(labels).toContain("Closed");
    expect(labels).toContain("Attendance approved");
    expect(labels).toContain(label);
    expect(labels.filter((value) => ["Unpaid", "Payment requested", "Paid"].includes(value))).toEqual([
      label
    ]);
  });

  it.each([
    [calculationFixture("COMPLETE"), "Breakdown available"],
    [calculationFixture("UNAVAILABLE"), "Breakdown unavailable"],
    [undefined, null]
  ] as const)("maps the returned calculation snapshot without inventing one", async (calculation, expected) => {
    const view = await renderCard(shiftFixture({ payCalculation: calculation }));
    const labels = badgeLabels(view);

    if (expected) {
      expect(labels).toContain(expected);
    } else {
      expect(labels).not.toContain("Breakdown available");
      expect(labels).not.toContain("Breakdown unavailable");
    }
  });

  it("shows CANCELLED only as the returned shift status", async () => {
    const view = await renderCard(
      shiftFixture({
        payCalculation: undefined,
        paymentStatus: null,
        status: "CANCELLED"
      })
    );

    expect(badgeLabels(view)).toEqual(["Cancelled", "Attendance approved"]);
    expect(badgeLabels(view)).not.toContain("Paid");
  });

  it("presents DISCARDED as non-payable without salary or payment claims", async () => {
    const view = await renderCard(
      shiftFixture({
        status: "DISCARDED",
        paymentStatus: "PAID",
        paidAt: "2026-07-06T12:00:00Z"
      })
    );
    const output = renderedText(view);

    expect(badgeLabels(view)).toEqual(["Discarded", "Attendance approved"]);
    expect(output).toContain("Discarded short shift. No payroll.");
    expect(output).not.toContain("Salary ");
    expect(output).not.toContain("Pay starts");
    expect(output).not.toContain("Breakdown available");
  });

  it.each([
    ["REJECTED", "Attendance rejected"],
    ["CANCELLED", "Attendance cancelled"]
  ] as const)("uses canonical %s attendance presentation", async (status, label) => {
    const view = await renderCard(
      shiftFixture({ attendanceStatus: status, payCalculation: undefined })
    );
    expect(badgeLabels(view)).toContain(label);
  });

  it("keeps nullable returned metadata explicitly unavailable or pending", async () => {
    const view = await renderCard(
      shiftFixture({
        actualStartTime: null,
        calculatedSalary: null,
        currencyLabel: null,
        location: null,
        paidAt: null,
        payCalculation: undefined,
        payableStartTime: null,
        workedMinutes: null
      })
    );
    const output = renderedText(view);

    expect(output).toContain("No location set");
    expect(output).toContain("Start time pending");
    expect(output).toContain("Worked time pending");
    expect(output).toContain("Salary pending");
    expect(output).not.toContain("Pay starts");
  });

  it("preserves a returned amount with a null historical currency label", async () => {
    const view = await renderCard(
      shiftFixture({ calculatedSalary: 12.5, currencyLabel: null })
    );
    expect(renderedText(view)).toContain(
      `Salary ${formatMoneyWithCurrencyLabel(12.5, null)}`
    );
  });

  it("keeps real numeric zero distinct from pending values", async () => {
    const view = await renderCard(
      shiftFixture({ calculatedSalary: 0, workedMinutes: 0 })
    );
    const output = renderedText(view);

    expect(output).toContain("Worked 0 min");
    expect(output).toContain(`Salary ${formatMoneyWithCurrencyLabel(0, "EUR")}`);
    expect(output).not.toContain("Worked time pending");
    expect(output).not.toContain("Salary pending");
  });

  it("keeps zero values in the announcement without inventing a hidden rate", async () => {
    const shift = shiftFixture({
      actualStartTime: null,
      calculatedSalary: 0,
      hourlyRate: 0,
      paidAt: null,
      payCalculation: undefined,
      payableStartTime: null,
      pauseState: undefined,
      workedMinutes: 0
    });
    const view = await renderCard(shift, jest.fn());

    expect(actionableCard(view).props.accessibilityLabel).toBe(
      `View shift details. Sunday night shift. Acme Construction. Cologne. Closed. Attendance approved. Unpaid. Start time pending. Worked 0 min. Salary ${formatMoneyWithCurrencyLabel(0, "EUR")}.`
    );
    expect(actionableCard(view).props.accessibilityLabel).not.toContain("Rate");
  });

  it("preserves returned paidAt separately from payment and shift status", async () => {
    const paidAt = "2026-07-06T12:00:00Z";
    const view = await renderCard(
      shiftFixture({ paidAt, paymentStatus: "PAID" })
    );

    expect(badgeLabels(view)).toEqual(
      expect.arrayContaining(["Closed", "Attendance approved", "Paid"])
    );
    expect(renderedText(view)).toContain(`Paid ${formatDateTime(paidAt)}`);
  });

  it("keeps long title, company, and location copy scalable and unclipped", async () => {
    const values = [
      "A very long returned shift title that must wrap on a narrow viewport",
      "A very long returned company name that must remain fully readable",
      "A very long returned construction location with building and floor detail"
    ];
    const view = await renderCard(
      shiftFixture({
        companyName: values[1]!,
        location: values[2]!,
        title: values[0]!
      })
    );

    for (const value of values) {
      const node = view.root.findByProps({ children: value });
      const style = StyleSheet.flatten(node.props.style) as TextStyle;
      expect(node.props.allowFontScaling).toBe(true);
      expect(node.props.numberOfLines).toBeUndefined();
      expect(node.props.ellipsizeMode).toBeUndefined();
      expect(style.flexShrink).toBe(1);
      expect(style.height).toBeUndefined();
      expect(style.maxHeight).toBeUndefined();
      expect(style.overflow).not.toBe("hidden");
    }
  });

  it("does not advertise defensive CREATED as a product status", async () => {
    const view = await renderCard(
      shiftFixture({ payCalculation: undefined, status: "CREATED" })
    );

    expect(badgeLabels(view)).not.toContain("CREATED");
    expect(badgeLabels(view)).not.toContain("Created");
    expect(renderedText(view)).not.toContain("CREATED");
  });

  it("is one meaningfully named button and invokes onPress once when actionable", async () => {
    const onPress = jest.fn();
    const shift = shiftFixture();
    const view = await renderCard(shift, onPress);
    const buttons = view.root.findAll(
      (node) =>
        node.props.accessibilityRole === "button" &&
        typeof node.props.style === "function"
    );

    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.props.accessibilityRole).toBe("button");
    expect(buttons[0]?.props.accessibilityLabel).toContain(shift.title);
    expect(buttons[0]?.props.accessibilityLabel).toContain(shift.companyName);
    expect(buttons[0]?.props.accessibilityLabel).toContain(shift.location);

    act(() => {
      buttons[0]?.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("announces every visible status and metadata value exactly once in actionable mode", async () => {
    const paidAt = "2026-07-06T12:00:00Z";
    const shift = shiftFixture({
      paidAt,
      paymentStatus: "PAID",
      pauseState: {
        allPaused: true,
        allPauseStartedAt: "2026-07-05T22:30:00Z",
        personallyPaused: true,
        personalPauseStartedAt: "2026-07-05T22:20:00Z",
        effectivePauseMinutes: 5
      }
    });
    const view = await renderCard(shift, jest.fn());

    expect(actionableCard(view).props.accessibilityLabel).toBe(
      `View shift details. Sunday night shift. Acme Construction. Cologne. Closed. Attendance approved. Paid. Personal pause active. Crew pause active. Breakdown available. Started ${formatDateTime(shift.actualStartTime)}. Pay starts ${formatDateTime(shift.payableStartTime)}. Worked 1 h 0 min. Salary ${formatMoneyWithCurrencyLabel(25, "EUR")}. Paid ${formatDateTime(paidAt)}.`
    );
  });

  it("hides actionable descendants with the iOS and Android accessibility mechanisms", async () => {
    const view = await renderCard(shiftFixture(), jest.fn());
    const button = actionableCard(view);
    const content = contentContainer(view);

    expect(button.props).toMatchObject({
      accessible: true,
      accessibilityRole: "button"
    });
    expect(content.props).toMatchObject({
      accessible: false,
      accessibilityElementsHidden: true,
      "aria-hidden": true,
      importantForAccessibility: "no-hide-descendants"
    });
  });

  it("omits unavailable optional facts instead of inventing announcement copy", async () => {
    const shift = shiftFixture({
      actualStartTime: null,
      attendanceStatus: "JOINED",
      calculatedSalary: null,
      currencyLabel: null,
      location: null,
      paidAt: undefined,
      payCalculation: undefined,
      payableStartTime: undefined,
      pauseState: undefined,
      paymentStatus: null,
      status: "OPEN",
      workedMinutes: null
    });
    const view = await renderCard(shift, jest.fn());
    const announcement = actionableCard(view).props.accessibilityLabel;

    expect(announcement).toBe(
      "View shift details. Sunday night shift. Acme Construction. No location set. Open. Waiting for approval. Start time pending. Worked time pending. Salary pending."
    );
    expect(announcement).not.toContain("Pay starts");
    expect(announcement).not.toContain("Breakdown");
    expect(announcement).not.toContain("pause active");
    expect(announcement).not.toContain("Paid ");
  });

  it("announces DISCARDED as non-payable without stale pay metadata", async () => {
    const shift = shiftFixture({
      paidAt: "2026-07-06T12:00:00Z",
      paymentStatus: "PAID",
      status: "DISCARDED"
    });
    const view = await renderCard(shift, jest.fn());

    expect(actionableCard(view).props.accessibilityLabel).toBe(
      `View shift details. Sunday night shift. Acme Construction. Cologne. Discarded. Attendance approved. Started ${formatDateTime(shift.actualStartTime)}. Discarded short shift. No payroll.`
    );
  });

  it("keeps a passive card non-actionable", async () => {
    const shift = shiftFixture();
    const view = await renderCard(shift);

    expect(
      view.root.findAll((node) => node.props.accessibilityRole === "button")
    ).toHaveLength(0);
    const surface = view.root
      .findAllByType(View)
      .find((node) => node.props.testID === `worker-shift-card-${shift.attendanceId}`);
    expect(surface).toBeDefined();
    expect(surface?.props.accessibilityRole).toBeUndefined();
    expect(surface?.props.onPress).toBeUndefined();
    expect(contentContainer(view).props).toMatchObject({
      accessibilityElementsHidden: undefined,
      importantForAccessibility: undefined
    });
    expect(contentContainer(view).props.accessible).toBeUndefined();
    expect(contentContainer(view).props["aria-hidden"]).toBeUndefined();
    expect(view.root.findAllByType(StatusBadge)[0]?.props.label).toBe("Closed");
  });

  it("keeps full calculation segments and rules off the compact card", async () => {
    const view = await renderCard(shiftFixture());
    const output = renderedText(view);

    expect(output).toContain("Breakdown available");
    expect(output).not.toContain("Night premium");
    expect(output).not.toContain("Total base amount");
    expect(output).not.toContain("effectiveHourlyRate");
  });

  it("uses only decorative metadata icons", async () => {
    const view = await renderCard(shiftFixture());
    const icons = view.root.findAllByType(Ionicons);
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.props).toMatchObject({
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: "no-hide-descendants",
        "aria-hidden": true
      });
    }
  });
});
