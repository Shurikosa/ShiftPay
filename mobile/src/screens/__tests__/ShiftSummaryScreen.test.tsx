import type { ComponentProps } from "react";
import { ActivityIndicator, ScrollView, Text } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { ApiError } from "../../api/errors";
import { getShiftSummary } from "../../api/shifts";
import { Button } from "../../components/Button";
import { PayCalculationBreakdown } from "../../components/PayCalculationBreakdown";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import type { User } from "../../types/auth";
import type {
  PayCalculation,
  UnavailablePaySegment
} from "../../types/payCalculation";
import type { ShiftSummary, ShiftSummaryWorker } from "../../types/shifts";
import {
  formatAuditDecimal,
  formatMoneyWithCurrencyLabel
} from "../../utils/format";
import { ShiftSummaryScreen } from "../ShiftSummaryScreen";

jest.mock("@expo/vector-icons/Ionicons", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text: NativeText } = jest.requireActual<typeof import("react-native")>("react-native");
  const MockIonicons = (props: Record<string, unknown>) =>
    React.createElement(NativeText, props as ComponentProps<typeof NativeText>);
  return { __esModule: true, default: MockIonicons };
});
jest.mock("@react-navigation/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) =>
      React.useEffect(effect, [effect])
  };
});
jest.mock("../../api/shifts", () => ({ getShiftSummary: jest.fn() }));
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));

const mockedGetShiftSummary = jest.mocked(getShiftSummary);
const mockedUseAuth = jest.mocked(useAuth);

const owner: User = {
  id: 5,
  email: "owner@example.com",
  firstName: "Fran",
  lastName: "Foreman",
  role: "FOREMAN",
  company: {
    id: 10,
    name: "Acme Construction",
    joinCode: "COMPANY",
    currencyLabel: "EUR",
    timeZone: "Europe/Berlin"
  }
};

const navigation = { goBack: jest.fn() };
const screenProps = {
  navigation,
  route: {
    key: "summary-test",
    name: "ShiftSummary",
    params: {
      shiftId: 100,
      shiftTitle: "Sunday night shift"
    }
  }
} as unknown as ComponentProps<typeof ShiftSummaryScreen>;

function propsForShift(
  shiftId: number,
  shiftTitle: string
): ComponentProps<typeof ShiftSummaryScreen> {
  return {
    ...screenProps,
    route: {
      ...screenProps.route,
      params: { shiftId, shiftTitle }
    }
  } as ComponentProps<typeof ShiftSummaryScreen>;
}

function completeCalculation(ruleName = "Summary night premium"): PayCalculation {
  return {
    snapshotStatus: "COMPLETE",
    totalRawSeconds: 3600,
    totalRawMinutesExact: 60,
    totalBaseAmount: 90.004,
    totalPremiumAmount: 10,
    totalAmount: 100.004,
    segments: [
      {
        snapshotStatus: "COMPLETE",
        start: "2026-07-05T22:00:00Z",
        end: "2026-07-05T23:00:00Z",
        payableSeconds: 3600,
        payableMinutesExact: 60,
        payableMinutes: 60,
        baseHourlyRate: 90.004,
        appliedRules: [
          {
            id: 3001,
            name: ruleName,
            type: "TIME_OF_DAY",
            premiumPercent: 11.1106
          }
        ],
        stackingStrategy: "ADD",
        effectivePremiumPercent: 11.1106,
        effectiveHourlyRate: 100.004,
        baseAmount: 90.004,
        premiumAmount: 10,
        totalAmount: 100.004
      }
    ]
  };
}

function unavailableCalculation(): PayCalculation {
  const segment: UnavailablePaySegment = {
    snapshotStatus: "UNAVAILABLE",
    start: "2026-07-05T22:00:00Z",
    end: "2026-07-05T23:00:00Z",
    payableSeconds: 1,
    payableMinutesExact: 0.01666667,
    payableMinutes: 0,
    baseHourlyRate: 20,
    appliedRules: null,
    stackingStrategy: "HIGHEST_ONLY",
    effectivePremiumPercent: 25,
    effectiveHourlyRate: 25,
    baseAmount: 0.12345678,
    premiumAmount: 0.0308642,
    totalAmount: 0.15432098
  };
  return {
    snapshotStatus: "UNAVAILABLE",
    totalRawSeconds: 1,
    totalRawMinutesExact: 0.01666667,
    totalBaseAmount: 0.12345678,
    totalPremiumAmount: 0.0308642,
    totalAmount: 0.15432098,
    segments: [segment]
  };
}

function workerFixture(
  overrides: Partial<ShiftSummaryWorker> = {}
): ShiftSummaryWorker {
  return {
    attendanceId: 500,
    workerId: 10,
    firstName: "John",
    lastName: "Worker",
    workedMinutes: 60,
    pauseMinutes: 0,
    hourlyRate: 90,
    salary: 100,
    payCalculation: completeCalculation(),
    ...overrides
  };
}

function summaryFixture(overrides: Partial<ShiftSummary> = {}): ShiftSummary {
  return {
    shiftId: 100,
    status: "CLOSED",
    currencyLabel: "EUR",
    totalWorkers: 1,
    totalSalary: 100,
    totalBaseAmount: 90.004,
    totalPremiumAmount: 10,
    foremanWorkedMinutes: 480,
    foremanPauseMinutes: 15,
    foremanHourlyRate: 25,
    foremanSalary: 196.88,
    workers: [workerFixture()],
    ...overrides
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function button(view: ReactTestRenderer, label: string) {
  const result = view.root
    .findAllByType(Button)
    .find((candidate) => candidate.props.label === label);
  if (!result) throw new Error(`Missing button: ${label}`);
  return result;
}

function output(view: ReactTestRenderer): string {
  return view.root
    .findAllByType(Text)
    .flatMap((node) => node.props.children)
    .filter((value): value is string | number =>
      typeof value === "string" || typeof value === "number"
    )
    .join(" ");
}

describe("ShiftSummaryScreen", () => {
  let renderer: ReactTestRenderer | null = null;
  let authenticatedRequest: jest.Mock;

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.resetAllMocks();
    authenticatedRequest = jest.fn(
      (request: (token: string) => Promise<unknown>) => request("foreman-token")
    );
    mockedUseAuth.mockReturnValue({
      authenticatedRequest,
      user: owner
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
  });

  async function renderSummary({
    summary = summaryFixture(),
    settle = true,
    props = screenProps
  }: {
    summary?: ShiftSummary;
    settle?: boolean;
    props?: ComponentProps<typeof ShiftSummaryScreen>;
  } = {}): Promise<ReactTestRenderer> {
    mockedGetShiftSummary.mockResolvedValue(summary);
    await act(async () => {
      renderer = create(<ShiftSummaryScreen {...props} />);
      if (settle) await flush();
    });
    return renderer!;
  }

  it("shows a strong read-only header, scroll, Back, and exact shiftId request", async () => {
    const view = await renderSummary();
    expect(view.root.findByType(ScreenHeader).props).toMatchObject({
      eyebrow: "Shift result",
      title: "Sunday night shift"
    });
    expect(view.root.findByType(ScrollView).props).toMatchObject({
      horizontal: false,
      scrollEnabled: true,
      testID: "shift-summary-scroll"
    });
    expect(authenticatedRequest).toHaveBeenCalledTimes(1);
    expect(mockedGetShiftSummary).toHaveBeenCalledWith("foreman-token", 100);
    expect(view.root.findAllByType(Button)).toHaveLength(0);
    act(() => void view.root.findByType(ScreenHeader).props.backAction.onPress());
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it("blocks content during loading and does not reveal final results early", async () => {
    const pending = deferred<ShiftSummary>();
    mockedGetShiftSummary.mockReturnValueOnce(pending.promise);
    const view = await renderSummary({ settle: false });
    expect(view.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(view.root.findByProps({ testID: "shift-summary-loading" })).toBeDefined();
    expect(output(view)).not.toContain("Final worker salary");

    await act(async () => {
      pending.resolve(summaryFixture());
      await flush();
    });
    expect(output(view)).toContain("Final worker salary");
  });

  it.each([
    ["WORKER", { ...owner, role: "WORKER" as const }],
    ["FOREMAN without company", { ...owner, company: null }]
  ])("enforces the %s privacy gate before requesting data", async (_case, user) => {
    mockedUseAuth.mockReturnValue({ user, authenticatedRequest } as unknown as ReturnType<typeof useAuth>);
    const view = await renderSummary();
    expect(output(view)).toContain("Foreman company access required");
    expect(mockedGetShiftSummary).not.toHaveBeenCalled();
    expect(output(view)).not.toContain("Foreman result");
  });

  it("keeps non-owner backend denial private", async () => {
    mockedGetShiftSummary.mockRejectedValueOnce(new ApiError("Forbidden", 403));
    const view = await renderSummary();
    expect(output(view)).toContain("Summary not available");
    expect(output(view)).toContain("Forbidden");
    expect(output(view)).not.toContain("Foreman result");
    expect(output(view)).not.toContain("John Worker");
  });

  it("rejects a mismatched returned shiftId without rendering private totals", async () => {
    const view = await renderSummary({
      summary: summaryFixture({ shiftId: 999, foremanSalary: 9999 })
    });
    expect(output(view)).toContain("does not match the requested shift");
    expect(output(view)).not.toContain("9,999");
    expect(output(view)).not.toContain("Final worker salary");
  });

  it("renders CLOSED status and only returned totals without reconciling arithmetic", async () => {
    const summary = summaryFixture({
      totalWorkers: 9,
      totalSalary: 100.01,
      totalBaseAmount: 80.12345678,
      totalPremiumAmount: 30.87654321,
      workers: [workerFixture(), workerFixture({ attendanceId: 501, workerId: 11 })]
    });
    const view = await renderSummary({ summary });
    expect(
      view.root.findAllByType(StatusBadge).map((badge) => badge.props.label)
    ).toContain("Closed");
    expect(output(view)).toContain("Approved workers 9");
    expect(output(view)).toContain(formatMoneyWithCurrencyLabel(100.01, "EUR"));
    expect(output(view)).toContain(formatAuditDecimal(80.12345678));
    expect(output(view)).toContain(formatAuditDecimal(30.87654321));
    expect(output(view)).not.toContain("111.00 EUR");
    expect(output(view)).toContain("does not calculate or hide that rounding delta");
  });

  it.each(["OPEN", "ACTIVE", "CANCELLED", "DISCARDED"] as const)(
    "shows a clear read-only state without final results for %s",
    async (status) => {
      const view = await renderSummary({
        summary: summaryFixture({ status, totalSalary: 9876, foremanSalary: 5432 })
      });
      expect(view.root.findByProps({ testID: "shift-summary-not-closed" })).toBeDefined();
      expect(output(view)).toContain("Summary not ready");
      expect(output(view)).not.toContain("Final worker salary");
      expect(output(view)).not.toContain("Worker results");
      expect(output(view)).not.toContain("Foreman result");
      expect(output(view)).not.toContain("9,876");
    }
  );

  it("presents the backend non-CLOSED conflict as not ready", async () => {
    mockedGetShiftSummary.mockRejectedValueOnce(
      new ApiError("Shift summary is available only for CLOSED shifts", 409)
    );
    const view = await renderSummary();
    expect(output(view)).toContain("Summary not ready");
    expect(output(view)).toContain("available only for CLOSED");
    expect(output(view)).not.toContain("Final worker salary");
  });

  it("renders returned worker rows in backend order without deriving the approved count", async () => {
    const first = workerFixture({
      attendanceId: 700,
      workerId: 70,
      firstName: "A very long approved first name",
      lastName: "A very long approved family name"
    });
    const second = workerFixture({
      attendanceId: 600,
      workerId: 60,
      firstName: "Second",
      lastName: "Returned"
    });
    const view = await renderSummary({
      summary: summaryFixture({ totalWorkers: 12, workers: [first, second] })
    });
    const cards = view.root.findAll(
      (node) =>
        typeof node.props.testID === "string" &&
        node.props.testID.startsWith("shift-summary-worker-") &&
        node.props.testID !== "shift-summary-worker-totals"
    );
    expect([...new Set(cards.map((card) => card.props.testID))]).toEqual([
      "shift-summary-worker-700",
      "shift-summary-worker-600"
    ]);
    expect(output(view)).toContain("A very long approved first name");
    expect(output(view)).toContain("Approved workers 12");
  });

  it("renders private foreman fields only when the successful owner response returns them", async () => {
    const view = await renderSummary();
    expect(view.root.findByProps({ testID: "shift-summary-foreman-card" })).toBeDefined();
    expect(output(view)).toContain("Foreman result");
    expect(output(view)).toContain(formatMoneyWithCurrencyLabel(196.88, "EUR"));
    act(() => view.unmount());
    renderer = null;

    const omitted = await renderSummary({
      summary: summaryFixture({
        foremanWorkedMinutes: undefined,
        foremanPauseMinutes: undefined,
        foremanHourlyRate: undefined,
        foremanSalary: undefined
      })
    });
    expect(output(omitted)).not.toContain("Foreman result");
    expect(omitted.root.findAllByProps({ testID: "shift-summary-foreman-card" })).toHaveLength(0);
  });

  it("renders COMPLETE returned segments and premium rules without recalculation", async () => {
    const view = await renderSummary({
      summary: summaryFixture({
        workers: [workerFixture({ payCalculation: completeCalculation("Returned weekend premium") })]
      })
    });
    expect(view.root.findAllByType(PayCalculationBreakdown)).toHaveLength(1);
    expect(output(view)).toContain("Returned weekend premium");
    expect(output(view)).toContain("Segment 1");
    expect(output(view)).toContain(formatAuditDecimal(90.004));
  });

  it.each(["null", "absent"])(
    "keeps backend salary/fallback totals authoritative for legacy %s breakdown",
    async (variant) => {
      const worker = workerFixture({ salary: 88.77, payCalculation: null });
      if (variant === "absent") delete worker.payCalculation;
      const view = await renderSummary({
        summary: summaryFixture({
          totalSalary: 88.77,
          totalBaseAmount: 88.77,
          totalPremiumAmount: 0,
          workers: [worker]
        })
      });
      expect(output(view)).toContain(formatMoneyWithCurrencyLabel(88.77, "EUR"));
      expect(output(view)).toContain("Historical breakdown unavailable");
      expect(output(view)).toContain("backend fallback totals remain authoritative");
      expect(view.root.findAllByType(PayCalculationBreakdown)).toHaveLength(0);
      expect(output(view)).not.toContain("Segment 1");
    }
  );

  it("renders UNAVAILABLE as neutral unavailable state, never empty rules", async () => {
    const view = await renderSummary({
      summary: summaryFixture({
        workers: [workerFixture({ payCalculation: unavailableCalculation() })]
      })
    });
    expect(view.root.findAllByType(PayCalculationBreakdown)).toHaveLength(1);
    expect(output(view)).toContain("Breakdown details unavailable");
    expect(output(view)).toContain(formatAuditDecimal(0.12345678));
    expect(output(view)).not.toContain("No premium rules applied");
  });

  it("keeps nullable currency and optional fields absent without substitution", async () => {
    const view = await renderSummary({
      summary: summaryFixture({
        currencyLabel: null,
        foremanWorkedMinutes: undefined,
        foremanPauseMinutes: undefined,
        foremanHourlyRate: undefined,
        foremanSalary: undefined,
        workers: [workerFixture({ pauseMinutes: undefined, payCalculation: undefined })]
      })
    });
    const rendered = output(view);
    expect(rendered).toContain("currency unavailable");
    expect(rendered).not.toContain("100.00 EUR");
    expect(rendered).not.toContain("Pause time");
    expect(rendered).not.toContain("Foreman result");
  });

  it("shows load error and retries the exact summary request", async () => {
    mockedGetShiftSummary.mockRejectedValueOnce(new Error("Summary offline."));
    const view = await renderSummary();
    expect(view.root.findByProps({ testID: "shift-summary-error" })).toBeDefined();
    mockedGetShiftSummary.mockResolvedValueOnce(summaryFixture());
    await act(async () => {
      button(view, "Retry").props.onPress();
      await flush();
    });
    expect(mockedGetShiftSummary).toHaveBeenCalledTimes(2);
    expect(mockedGetShiftSummary).toHaveBeenLastCalledWith("foreman-token", 100);
    expect(output(view)).toContain("Final worker salary");
  });

  it("keeps the newest overlapping retry response and ignores the older one", async () => {
    mockedGetShiftSummary.mockRejectedValueOnce(new Error("Initial failure."));
    const view = await renderSummary();
    const retry = button(view, "Retry").props.onPress;
    const older = deferred<ShiftSummary>();
    const newer = deferred<ShiftSummary>();
    mockedGetShiftSummary
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    await act(async () => {
      retry();
      retry();
      await Promise.resolve();
    });
    await act(async () => {
      newer.resolve(summaryFixture({ totalSalary: 222.22 }));
      await flush();
    });
    await act(async () => {
      older.resolve(summaryFixture({ totalSalary: 111.11 }));
      await flush();
    });
    expect(output(view)).toContain(formatMoneyWithCurrencyLabel(222.22, "EUR"));
    expect(output(view)).not.toContain(formatMoneyWithCurrencyLabel(111.11, "EUR"));
  });

  it.each([
    ["403", new ApiError("Forbidden for B", 403)],
    ["network", new Error("B network failed.")]
  ])(
    "hides CLOSED A synchronously when route changes to B and keeps it hidden after B %s failure",
    async (_kind, bError) => {
      const summaryA = summaryFixture({
        totalSalary: 111.11,
        foremanSalary: 1111,
        workers: [workerFixture({ firstName: "Worker A" })]
      });
      const view = await renderSummary({ summary: summaryA });
      expect(output(view)).toContain(formatMoneyWithCurrencyLabel(111.11, "EUR"));
      expect(output(view)).toContain("Worker A");

      const responseB = deferred<ShiftSummary>();
      mockedGetShiftSummary.mockReturnValueOnce(responseB.promise);
      await act(async () => {
        renderer!.update(
          <ShiftSummaryScreen {...propsForShift(200, "Shift B")} />
        );
        await Promise.resolve();
      });
      expect(output(view)).toContain("Shift B");
      expect(output(view)).not.toContain(formatMoneyWithCurrencyLabel(111.11, "EUR"));
      expect(output(view)).not.toContain("Worker A");
      expect(output(view)).not.toContain("Foreman result");

      await act(async () => {
        responseB.reject(bError);
        await flush();
      });
      expect(output(view)).toContain(bError.message);
      expect(output(view)).not.toContain(formatMoneyWithCurrencyLabel(111.11, "EUR"));
      expect(output(view)).not.toContain("Worker A");
      expect(output(view)).not.toContain("Foreman result");
    }
  );

  it("ignores a late A response after B has loaded", async () => {
    const responseA = deferred<ShiftSummary>();
    mockedGetShiftSummary.mockReturnValueOnce(responseA.promise);
    const view = await renderSummary({ settle: false });
    const responseB = deferred<ShiftSummary>();
    mockedGetShiftSummary.mockReturnValueOnce(responseB.promise);
    await act(async () => {
      renderer!.update(
        <ShiftSummaryScreen {...propsForShift(200, "Shift B")} />
      );
      await Promise.resolve();
    });
    await act(async () => {
      responseB.resolve(
        summaryFixture({
          shiftId: 200,
          totalSalary: 222.22,
          workers: [workerFixture({ firstName: "Worker B" })]
        })
      );
      await flush();
    });
    expect(output(view)).toContain(formatMoneyWithCurrencyLabel(222.22, "EUR"));
    expect(output(view)).toContain("Worker B");

    await act(async () => {
      responseA.resolve(
        summaryFixture({
          totalSalary: 111.11,
          workers: [workerFixture({ firstName: "Late Worker A" })]
        })
      );
      await flush();
    });
    expect(output(view)).toContain(formatMoneyWithCurrencyLabel(222.22, "EUR"));
    expect(output(view)).toContain("Worker B");
    expect(output(view)).not.toContain(formatMoneyWithCurrencyLabel(111.11, "EUR"));
    expect(output(view)).not.toContain("Late Worker A");
  });

  it("shows only successful B data after replacing an already displayed A", async () => {
    const view = await renderSummary({
      summary: summaryFixture({
        totalSalary: 111.11,
        workers: [workerFixture({ firstName: "Worker A" })]
      })
    });
    const responseB = deferred<ShiftSummary>();
    mockedGetShiftSummary.mockReturnValueOnce(responseB.promise);
    await act(async () => {
      renderer!.update(
        <ShiftSummaryScreen {...propsForShift(200, "Shift B result")} />
      );
      await Promise.resolve();
    });
    expect(output(view)).not.toContain("Worker A");

    await act(async () => {
      responseB.resolve(
        summaryFixture({
          shiftId: 200,
          totalSalary: 222.22,
          foremanSalary: 2222,
          workers: [workerFixture({ firstName: "Worker B only" })]
        })
      );
      await flush();
    });
    const rendered = output(view);
    expect(rendered).toContain("Shift B result");
    expect(rendered).toContain("Worker B only");
    expect(rendered).toContain(formatMoneyWithCurrencyLabel(222.22, "EUR"));
    expect(rendered).not.toContain("Worker A");
    expect(rendered).not.toContain(formatMoneyWithCurrencyLabel(111.11, "EUR"));
  });

  it("removes stale CLOSED results when same-shift refresh returns authoritative non-CLOSED 409", async () => {
    const view = await renderSummary({
      summary: summaryFixture({
        totalSalary: 333.33,
        foremanSalary: 444.44,
        workers: [workerFixture({ firstName: "Final Worker" })]
      })
    });
    expect(view.root.findAllByType(PayCalculationBreakdown)).toHaveLength(1);
    const refreshedRequest = jest.fn(
      (request: (token: string) => Promise<unknown>) => request("foreman-token")
    );
    mockedUseAuth.mockReturnValue({
      authenticatedRequest: refreshedRequest,
      user: owner
    } as unknown as ReturnType<typeof useAuth>);
    const refresh = deferred<ShiftSummary>();
    mockedGetShiftSummary.mockReturnValueOnce(refresh.promise);
    await act(async () => {
      renderer!.update(<ShiftSummaryScreen {...screenProps} />);
      await Promise.resolve();
    });
    expect(output(view)).toContain("Final Worker");
    await act(async () => {
      refresh.reject(
        new ApiError("Shift summary is available only for CLOSED shifts", 409)
      );
      await flush();
    });
    const rendered = output(view);
    expect(rendered).toContain("Summary not ready");
    expect(rendered).not.toContain("Final worker salary");
    expect(rendered).not.toContain("Final Worker");
    expect(rendered).not.toContain("Foreman result");
    expect(rendered).not.toContain(formatMoneyWithCurrencyLabel(333.33, "EUR"));
    expect(view.root.findAllByType(PayCalculationBreakdown)).toHaveLength(0);
  });

  it("retains usable same-shift content after transient refresh failure", async () => {
    const view = await renderSummary({
      summary: summaryFixture({
        totalSalary: 333.33,
        workers: [workerFixture({ firstName: "Retained Worker" })]
      })
    });
    const refreshedRequest = jest.fn(
      (request: (token: string) => Promise<unknown>) => request("foreman-token")
    );
    mockedUseAuth.mockReturnValue({
      authenticatedRequest: refreshedRequest,
      user: owner
    } as unknown as ReturnType<typeof useAuth>);
    const refresh = deferred<ShiftSummary>();
    mockedGetShiftSummary.mockReturnValueOnce(refresh.promise);
    await act(async () => {
      renderer!.update(<ShiftSummaryScreen {...screenProps} />);
      await Promise.resolve();
    });
    expect(output(view)).toContain("Retained Worker");
    await act(async () => {
      refresh.reject(new Error("Refresh offline."));
      await flush();
    });
    expect(view.root.findByProps({ testID: "shift-summary-refresh-error" })).toBeDefined();
    expect(output(view)).toContain("Retained Worker");
    expect(output(view)).toContain(formatMoneyWithCurrencyLabel(333.33, "EUR"));
    expect(output(view)).toContain("Foreman result");
    expect(view.root.findAllByType(PayCalculationBreakdown)).toHaveLength(1);
  });

  it("ignores a pending response after unmount", async () => {
    const pending = deferred<ShiftSummary>();
    mockedGetShiftSummary.mockReturnValueOnce(pending.promise);
    await renderSummary({ settle: false });
    act(() => renderer!.unmount());
    renderer = null;
    await act(async () => {
      pending.resolve(summaryFixture());
      await flush();
    });
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
