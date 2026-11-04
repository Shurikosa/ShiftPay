import type { ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { ScrollView, StyleSheet, Text, type ViewStyle } from "react-native";
import { endMyPause, startMyPause } from "../../api/shifts";
import { Card } from "../../components/Card";
import { PayCalculationBreakdown } from "../../components/PayCalculationBreakdown";
import { Screen } from "../../components/Screen";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useWorkerShiftHistory } from "../../hooks/useWorkerShiftHistory";
import type { User } from "../../types/auth";
import type { PayCalculation } from "../../types/payCalculation";
import type {
  ShiftPauseResponse,
  WorkerShiftHistoryItem
} from "../../types/shifts";
import { formatMoneyWithCurrencyLabel } from "../../utils/format";
import { WorkerShiftDetailsScreen } from "../WorkerShiftDetailsScreen";

jest.mock("../../components/AppIcon", () => ({
  AppIcon: () => null,
  isAppIconName: () => true
}));

jest.mock("../../api/shifts", () => ({
  endMyPause: jest.fn(),
  startMyPause: jest.fn()
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: jest.fn()
}));

jest.mock("../../hooks/useWorkerShiftHistory", () => ({
  useWorkerShiftHistory: jest.fn()
}));

const mockedEndMyPause = jest.mocked(endMyPause);
const mockedStartMyPause = jest.mocked(startMyPause);
const mockedUseAuth = jest.mocked(useAuth);
const mockedUseWorkerShiftHistory = jest.mocked(useWorkerShiftHistory);

const worker: User = {
  id: 8,
  email: "worker@example.com",
  firstName: "Ada",
  lastName: "Worker",
  role: "WORKER",
  company: {
    id: 10,
    name: "Acme Construction",
    currencyLabel: "EUR",
    timeZone: "Europe/Berlin"
  }
};

const completePayCalculation: PayCalculation = {
  snapshotStatus: "COMPLETE",
  totalRawSeconds: 3600,
  totalRawMinutesExact: 60,
  totalBaseAmount: 19.12345678,
  totalPremiumAmount: 5.87654321,
  totalAmount: 24.99999999,
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
      baseAmount: 19.12345678,
      premiumAmount: 5.87654321,
      totalAmount: 24.99999999
    }
  ]
};

const unavailablePayCalculation: PayCalculation = {
  ...completePayCalculation,
  snapshotStatus: "UNAVAILABLE",
  segments: [
    {
      snapshotStatus: "UNAVAILABLE",
      start: "2026-07-05T22:00:00Z",
      end: "2026-07-05T23:00:00Z",
      payableSeconds: 3600,
      payableMinutesExact: 60,
      payableMinutes: 60,
      baseHourlyRate: 20,
      appliedRules: null,
      stackingStrategy: "ADD",
      effectivePremiumPercent: 25,
      effectiveHourlyRate: 25,
      baseAmount: 19.12345678,
      premiumAmount: 5.87654321,
      totalAmount: 24.99999999
    }
  ]
};

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
    hourlyRate: 20,
    breakMinutes: 0,
    payableStartTime: "2026-07-05T22:00:00Z",
    pauseMinutes: 0,
    workedMinutes: 60,
    calculatedSalary: 25,
    payCalculation: completePayCalculation,
    ...overrides
  };
}

function activeShift(
  overrides: Partial<WorkerShiftHistoryItem> = {}
): WorkerShiftHistoryItem {
  return shiftFixture({
    status: "ACTIVE",
    actualEndTime: null,
    paymentStatus: null,
    paidAt: null,
    pauseMinutes: null,
    workedMinutes: null,
    calculatedSalary: null,
    payCalculation: undefined,
    pauseState: {
      allPaused: false,
      allPauseStartedAt: null,
      personallyPaused: false,
      personalPauseStartedAt: null,
      effectivePauseMinutes: null
    },
    ...overrides
  });
}

const pauseResponse: ShiftPauseResponse = {
  shiftId: 100,
  pauseId: 901,
  scope: "PERSONAL",
  userId: worker.id,
  active: true,
  startedAt: "2026-07-05T22:30:00Z",
  endedAt: null
};

type ScreenProps = ComponentProps<typeof WorkerShiftDetailsScreen>;

function screenProps(
  shift: WorkerShiftHistoryItem,
  goBack = jest.fn()
): ScreenProps {
  return {
    navigation: { goBack },
    route: {
      key: "worker-shift-test",
      name: "WorkerShiftDetails",
      params: { shift }
    }
  } as unknown as ScreenProps;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function output(view: ReactTestRenderer): string {
  return JSON.stringify(view.toJSON());
}

describe("WorkerShiftDetailsScreen", () => {
  let renderer: ReactTestRenderer | null = null;
  let refresh: jest.MockedFunction<() => Promise<WorkerShiftHistoryItem[]>>;
  let authenticatedRequest: jest.Mock;

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    refresh = jest.fn().mockResolvedValue([]);
    authenticatedRequest = jest.fn(
      (request: (token: string) => Promise<unknown>) => request("worker-token")
    );
    mockedUseAuth.mockReturnValue({
      authenticatedRequest,
      status: "authenticated",
      user: worker
    } as unknown as ReturnType<typeof useAuth>);
    mockedUseWorkerShiftHistory.mockReturnValue({
      shifts: [],
      loading: false,
      error: null,
      refresh
    });
    mockedStartMyPause.mockResolvedValue(pauseResponse);
    mockedEndMyPause.mockResolvedValue({
      ...pauseResponse,
      active: false,
      endedAt: "2026-07-05T22:45:00Z"
    });
  });

  afterEach(() => {
    if (renderer) {
      act(() => renderer?.unmount());
      renderer = null;
    }
  });

  function renderShift(
    shift: WorkerShiftHistoryItem,
    goBack = jest.fn()
  ): ReactTestRenderer {
    act(() => {
      renderer = create(<WorkerShiftDetailsScreen {...screenProps(shift, goBack)} />);
    });
    return renderer as ReactTestRenderer;
  }

  function findButton(testID: string): ReactTestRenderer["root"] {
    return renderer!.root.findByProps({ testID });
  }

  it("renders a scrollable strong-header composition with separate returned status dimensions", () => {
    const longText = "A very long returned shift title that must wrap instead of clipping on a narrow screen";
    const view = renderShift(shiftFixture({ title: longText }));

    expect(view.root.findByType(Screen).props.scroll).toBe(true);
    expect(view.root.findByType(ScrollView).props).toMatchObject({
      horizontal: false,
      scrollEnabled: true,
      testID: "worker-shift-details-scroll"
    });
    expect(view.root.findByType(ScreenHeader).props).toMatchObject({
      eyebrow: "Worker shift",
      subtitle: "Acme Construction",
      title: longText
    });
    expect(view.root.findAllByType(Card)).toHaveLength(5);
    expect(view.root.findAllByType(StatusBadge).map((badge) => badge.props.label)).toEqual([
      "Closed",
      "Attendance approved",
      "Unpaid"
    ]);
    expect(output(view)).toContain("Shift information");
    expect(output(view)).toContain("Timing");
    expect(output(view)).toContain("Work");
    expect(output(view)).toContain("Pay");

    const titleNode = view.root.findAllByType(Text).find(
      (node) => node.props.children === longText
    )!;
    const titleStyle = StyleSheet.flatten(titleNode.props.style) as ViewStyle;
    expect(titleStyle.height).toBeUndefined();
    expect(titleStyle.maxHeight).toBeUndefined();
    expect(titleStyle.overflow).not.toBe("hidden");
  });

  it.each([
    ["FOREMAN", worker.company, "Worker access required"],
    ["WORKER", null, "Worker access required"],
    [
      "WORKER",
      { ...worker.company!, id: 999 },
      "Worker access required"
    ]
  ] as const)("keeps the WORKER/company gate for %s access", (role, company, copy) => {
    mockedUseAuth.mockReturnValue({
      authenticatedRequest,
      status: "authenticated",
      user: { ...worker, role, company }
    } as unknown as ReturnType<typeof useAuth>);

    const view = renderShift(activeShift());
    expect(output(view)).toContain(copy);
    expect(view.root.findAllByProps({ testID: "worker-shift-details-content" })).toHaveLength(0);
    expect(view.root.findAllByProps({ testID: "worker-shift-pause-action" })).toHaveLength(0);
    expect(mockedStartMyPause).not.toHaveBeenCalled();
  });

  it("shows personal and crew pause as separate dimensions without merging them into shift status", () => {
    const view = renderShift(activeShift({
      pauseState: {
        allPaused: true,
        allPauseStartedAt: "2026-07-05T22:40:00Z",
        personallyPaused: true,
        personalPauseStartedAt: "2026-07-05T22:35:00Z",
        effectivePauseMinutes: 5
      }
    }));

    expect(view.root.findAllByType(StatusBadge).map((badge) => badge.props.label)).toEqual([
      "Active",
      "Attendance approved",
      "Personal pause active",
      "Crew pause active"
    ]);
    expect(output(view)).toContain("Paused by foreman");
    expect(view.root.findAllByProps({ testID: "worker-shift-pause-action" })).toHaveLength(0);
  });

  it.each([
    ["JOINED", "Waiting for approval"],
    ["REJECTED", "Attendance rejected"],
    ["CANCELLED", "Attendance cancelled"]
  ] as const)("renders the %s attendance state independently", (attendanceStatus, label) => {
    const view = renderShift(activeShift({ attendanceStatus }));
    expect(view.root.findAllByType(StatusBadge).map((badge) => badge.props.label)).toContain(label);
    expect(view.root.findAllByProps({ testID: "worker-shift-pause-action" })).toHaveLength(0);
  });

  it.each([
    ["OPEN", "Open"],
    ["ACTIVE", "Active"],
    ["CLOSED", "Closed"],
    ["CANCELLED", "Cancelled"],
    ["DISCARDED", "Discarded"]
  ] as const)("uses canonical copy for the %s shift state", (status, label) => {
    const view = renderShift(shiftFixture({ status }));
    expect(view.root.findAllByType(StatusBadge).map((badge) => badge.props.label)).toContain(label);
  });

  it.each([
    ["UNPAID", "Unpaid"],
    ["PAYMENT_REQUESTED", "Payment requested"],
    ["PAID", "Paid"]
  ] as const)("keeps the %s payment state separate", (paymentStatus, label) => {
    const view = renderShift(shiftFixture({ paymentStatus }));
    const badges = view.root.findAllByType(StatusBadge);
    expect(badges.map((badge) => badge.props.label)).toEqual([
      "Closed",
      "Attendance approved",
      label
    ]);
    expect(
      badges.find((badge) => badge.props.label === label)?.props.accessibilityLabel
    ).toBe("Payment status");
  });

  it("does not invent nullable timing, work, payment, salary, location, or currency values", () => {
    const view = renderShift(shiftFixture({
      location: null,
      actualStartTime: null,
      actualEndTime: null,
      payableStartTime: null,
      pauseMinutes: null,
      workedMinutes: null,
      calculatedSalary: null,
      paymentStatus: null,
      paidAt: null,
      currencyLabel: null,
      payCalculation: undefined
    }));
    const rendered = output(view);

    expect(rendered).toContain("Timing not available yet");
    expect(rendered).toContain("currency unavailable");
    expect(rendered).not.toContain("Location");
    expect(rendered).not.toContain("Actual start");
    expect(rendered).not.toContain("Actual end");
    expect(rendered).not.toContain("Payable start");
    expect(rendered).not.toContain("Pause time");
    expect(rendered).not.toContain("Worked time");
    expect(rendered).not.toContain("Calculated salary");
    expect(rendered).not.toContain("Payment status");
    expect(rendered).not.toContain("Breakdown not recorded");
  });

  it("keeps discarded attendance non-payable and omits payment and calculation detail", () => {
    const view = renderShift(shiftFixture({ status: "DISCARDED" }));
    const rendered = output(view);

    expect(rendered).toContain("Discarded shift");
    expect(rendered).toContain("Not payable");
    expect(rendered).not.toContain("Calculated salary");
    expect(rendered).not.toContain("Payment status");
    expect(rendered).not.toContain("Pay breakdown");
  });

  it("renders the COMPLETE breakdown and keeps settlement salary distinct from audit totals", () => {
    const view = renderShift(shiftFixture());
    const rendered = output(view);

    expect(view.root.findAllByType(PayCalculationBreakdown)).toHaveLength(1);
    expect(rendered).toContain("Night premium");
    expect(rendered).toContain("19.12345678");
    expect(rendered).toContain(formatMoneyWithCurrencyLabel(25, "EUR"));
    expect(rendered).not.toContain("Breakdown details unavailable");
  });

  it("renders UNAVAILABLE as degraded returned audit data, not as no premium rules", () => {
    const view = renderShift(shiftFixture({ payCalculation: unavailablePayCalculation }));
    const rendered = output(view);

    expect(rendered).toContain("Breakdown details unavailable");
    expect(rendered).toContain("19.12345678");
    expect(rendered).not.toContain("No premium rules applied");
  });

  it.each(["null", "absent"])(
    "renders the closed legacy %s breakdown state without reconstructing it",
    (variant) => {
      const shift = shiftFixture({ payCalculation: null });
      if (variant === "absent") delete shift.payCalculation;
      const view = renderShift(shift);
      const rendered = output(view);

      expect(rendered).toContain("Breakdown not recorded");
      expect(rendered).toContain("stored calculated salary remains");
      expect(rendered).toContain(formatMoneyWithCurrencyLabel(25, "EUR"));
      expect(view.root.findAllByType(PayCalculationBreakdown)).toHaveLength(0);
    }
  );

  it("locks duplicate pause mutations, exposes busy state, refreshes exact IDs, and reports success", async () => {
    const initial = activeShift();
    const mutation = deferred<ShiftPauseResponse>();
    const refreshed = activeShift({
      title: "Exact refreshed attendance",
      pauseState: {
        ...initial.pauseState!,
        personallyPaused: true,
        personalPauseStartedAt: "2026-07-05T22:30:00Z"
      }
    });
    mockedStartMyPause.mockReturnValueOnce(mutation.promise);
    refresh.mockResolvedValueOnce([
      activeShift({ shiftId: 999, attendanceId: 500, title: "Wrong shift" }),
      activeShift({ shiftId: 100, attendanceId: 999, title: "Wrong attendance" }),
      refreshed
    ]);
    const view = renderShift(initial);
    const pauseButton = findButton("worker-shift-pause-action");

    act(() => {
      pauseButton.props.onPress();
      pauseButton.props.onPress();
    });

    expect(mockedStartMyPause).toHaveBeenCalledTimes(1);
    expect(mockedStartMyPause).toHaveBeenCalledWith("worker-token", 100);
    expect(findButton("worker-shift-pause-action").props).toMatchObject({
      disabled: true,
      loading: true
    });
    expect(findButton("worker-shift-refresh-action").props.disabled).toBe(true);

    await act(async () => {
      mutation.resolve(pauseResponse);
      await flushPromises();
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(output(view)).toContain("Exact refreshed attendance");
    expect(output(view)).toContain("Your pause started.");
    expect(findButton("worker-shift-pause-action").props.label).toBe("Resume my work");
  });

  it("shows pause failure, retries the same action, and preserves the success refresh", async () => {
    const initial = activeShift();
    mockedStartMyPause
      .mockRejectedValueOnce(new Error("Network unavailable."))
      .mockResolvedValueOnce(pauseResponse);
    refresh.mockResolvedValueOnce([
      activeShift({
        pauseState: { ...initial.pauseState!, personallyPaused: true }
      })
    ]);
    const view = renderShift(initial);

    await act(async () => {
      findButton("worker-shift-pause-action").props.onPress();
      await flushPromises();
    });
    expect(output(view)).toContain("Could not update pause");
    expect(output(view)).toContain("Network unavailable.");
    expect(findButton("worker-shift-pause-action").props.disabled).toBe(false);

    await act(async () => {
      findButton("worker-shift-details-retry").props.onPress();
      await flushPromises();
    });
    expect(mockedStartMyPause).toHaveBeenCalledTimes(2);
    expect(output(view)).toContain("Your pause started.");
    expect(output(view)).not.toContain("Network unavailable.");
  });

  it.each([
    ["pause", false, "Pause my work", "Resume my work"],
    ["resume", true, "Resume my work", "Pause my work"]
  ] as const)(
    "keeps %s mutation locked after backend success until refresh succeeds",
    async (_direction, initiallyPaused, initialLabel, refreshedLabel) => {
      const base = activeShift();
      const initial = activeShift({
        pauseState: {
          ...base.pauseState!,
          personallyPaused: initiallyPaused,
          personalPauseStartedAt: initiallyPaused
            ? "2026-07-05T22:30:00Z"
            : null
        }
      });
      refresh
        .mockRejectedValueOnce(new Error("History temporarily unavailable."))
        .mockResolvedValueOnce([
          activeShift({
            pauseState: {
              ...initial.pauseState!,
              personallyPaused: !initiallyPaused,
              personalPauseStartedAt: initiallyPaused
                ? null
                : "2026-07-05T22:45:00Z"
            }
          })
        ]);
      const view = renderShift(initial);
      const savedMutationCallback = findButton("worker-shift-pause-action").props
        .onPress as () => void;

      await act(async () => {
        savedMutationCallback();
        await flushPromises();
      });
      expect(output(view)).toContain("The pause action succeeded");
      expect(output(view)).toContain("Could not refresh shift");
      expect(findButton("worker-shift-pause-action").props).toMatchObject({
        disabled: true,
        label: initialLabel
      });

      act(() => savedMutationCallback());
      expect(mockedStartMyPause).toHaveBeenCalledTimes(initiallyPaused ? 0 : 1);
      expect(mockedEndMyPause).toHaveBeenCalledTimes(initiallyPaused ? 1 : 0);
      expect(refresh).toHaveBeenCalledTimes(1);

      await act(async () => {
        findButton("worker-shift-details-retry").props.onPress();
        await flushPromises();
      });
      expect(mockedStartMyPause).toHaveBeenCalledTimes(initiallyPaused ? 0 : 1);
      expect(mockedEndMyPause).toHaveBeenCalledTimes(initiallyPaused ? 1 : 0);
      expect(refresh).toHaveBeenCalledTimes(2);
      expect(findButton("worker-shift-pause-action").props).toMatchObject({
        disabled: false,
        label: refreshedLabel
      });
    }
  );

  it("keeps pause ownership across same-pair snapshot updates until confirmed reconciliation", async () => {
    const initial = activeShift({ shiftId: 16, attendanceId: 12 });
    const pendingPost = deferred<ShiftPauseResponse>();
    mockedStartMyPause.mockReturnValueOnce(pendingPost.promise);
    refresh
      .mockRejectedValueOnce(new Error("Authoritative refresh failed."))
      .mockResolvedValueOnce([
        activeShift({
          shiftId: 16,
          attendanceId: 12,
          pauseState: {
            ...initial.pauseState!,
            personallyPaused: true,
            personalPauseStartedAt: "2026-10-28T13:55:00Z"
          }
        })
      ]);
    const view = renderShift(initial);
    const savedPreUpdateCallback = findButton("worker-shift-pause-action").props
      .onPress as () => void;

    act(() => savedPreUpdateCallback());
    expect(mockedStartMyPause).toHaveBeenCalledTimes(1);

    const pendingSnapshot = {
      ...initial,
      title: "Same attendance while pause POST is pending"
    };
    act(() => {
      renderer!.update(
        <WorkerShiftDetailsScreen {...screenProps(pendingSnapshot)} />
      );
    });
    const pendingUiCallback = findButton("worker-shift-pause-action").props
      .onPress as () => void;
    expect(findButton("worker-shift-pause-action").props).toMatchObject({
      disabled: true,
      loading: true
    });

    act(() => {
      savedPreUpdateCallback();
      pendingUiCallback();
    });
    expect(mockedStartMyPause).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingPost.resolve({ ...pauseResponse, shiftId: 16 });
      await flushPromises();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(output(view)).toContain("The pause action succeeded");

    const confirmedSnapshot = {
      ...pendingSnapshot,
      title: "Same attendance awaiting reconciliation"
    };
    act(() => {
      renderer!.update(
        <WorkerShiftDetailsScreen {...screenProps(confirmedSnapshot)} />
      );
    });
    const confirmedUiCallback = findButton("worker-shift-pause-action").props
      .onPress as () => void;
    expect(findButton("worker-shift-pause-action").props).toMatchObject({
      disabled: true,
      label: "Pause my work"
    });

    act(() => {
      savedPreUpdateCallback();
      pendingUiCallback();
      confirmedUiCallback();
    });
    expect(mockedStartMyPause).toHaveBeenCalledTimes(1);

    await act(async () => {
      findButton("worker-shift-details-retry").props.onPress();
      await flushPromises();
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(mockedStartMyPause).toHaveBeenCalledTimes(1);
    expect(findButton("worker-shift-pause-action").props).toMatchObject({
      disabled: false,
      label: "Resume my work"
    });
  });

  it("uses resume for a returned personal pause and keeps the shift ID boundary", async () => {
    const initial = activeShift({
      pauseState: {
        allPaused: false,
        allPauseStartedAt: null,
        personallyPaused: true,
        personalPauseStartedAt: "2026-07-05T22:30:00Z",
        effectivePauseMinutes: 10
      }
    });
    refresh.mockResolvedValueOnce([
      activeShift({ pauseState: { ...initial.pauseState!, personallyPaused: false } })
    ]);
    const view = renderShift(initial);

    expect(findButton("worker-shift-pause-action").props.label).toBe("Resume my work");
    await act(async () => {
      findButton("worker-shift-pause-action").props.onPress();
      await flushPromises();
    });
    expect(mockedEndMyPause).toHaveBeenCalledWith("worker-token", 100);
    expect(mockedStartMyPause).not.toHaveBeenCalled();
    expect(output(view)).toContain("Your pause ended.");
  });

  it("shows refresh loading/error and retries while retaining the selected content", async () => {
    const initial = activeShift();
    const failedRefresh = deferred<WorkerShiftHistoryItem[]>();
    refresh
      .mockReturnValueOnce(failedRefresh.promise)
      .mockResolvedValueOnce([activeShift({ title: "Fresh title" })]);
    const view = renderShift(initial);

    act(() => {
      void findButton("worker-shift-refresh-action").props.onPress();
    });
    expect(findButton("worker-shift-refresh-action").props).toMatchObject({
      disabled: true,
      loading: true
    });
    expect(output(view)).toContain("Sunday night shift");

    await act(async () => {
      failedRefresh.reject(new Error("Refresh network error."));
      await flushPromises();
    });
    expect(output(view)).toContain("Could not refresh shift");
    expect(output(view)).toContain("Refresh network error.");

    await act(async () => {
      findButton("worker-shift-details-retry").props.onPress();
      await flushPromises();
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(output(view)).toContain("Fresh title");
  });

  it("publishes a newer exact page snapshot and ignores a late stale legacy response", async () => {
    const staleLegacyShift = shiftFixture({
      shiftId: 16,
      attendanceId: 12,
      title: "QA Site 16 stale detail",
      status: "OPEN",
      actualStartTime: null,
      actualEndTime: null,
      attendanceStatus: "JOINED",
      paymentStatus: "UNPAID",
      payableStartTime: null,
      pauseMinutes: null,
      workedMinutes: null,
      calculatedSalary: null,
      payCalculation: undefined,
      pauseState: undefined
    });
    const authoritativePageShift = activeShift({
      shiftId: 16,
      attendanceId: 12,
      title: "QA Site 16 current page item",
      attendanceStatus: "APPROVED"
    });
    const view = renderShift(staleLegacyShift);

    expect(view.root.findAllByType(StatusBadge).map((badge) => badge.props.label)).toEqual([
      "Open",
      "Waiting for approval",
      "Unpaid"
    ]);
    expect(
      view.root.findAllByProps({ testID: "worker-shift-pause-action" })
    ).toHaveLength(0);

    act(() => {
      renderer!.update(
        <WorkerShiftDetailsScreen
          {...screenProps(authoritativePageShift)}
        />
      );
    });

    expect(view.root.findAllByType(StatusBadge).map((badge) => badge.props.label)).toEqual([
      "Active",
      "Attendance approved"
    ]);
    expect(findButton("worker-shift-pause-action").props).toMatchObject({
      disabled: false,
      label: "Pause my work"
    });
    expect(output(view)).toContain("QA Site 16 current page item");

    const staleLegacyResponse = deferred<WorkerShiftHistoryItem[]>();
    refresh.mockReturnValueOnce(staleLegacyResponse.promise);
    act(() => {
      findButton("worker-shift-refresh-action").props.onPress();
    });
    const latestPageShift = {
      ...authoritativePageShift,
      title: "QA Site 16 latest page item"
    };
    act(() => {
      renderer!.update(
        <WorkerShiftDetailsScreen {...screenProps(latestPageShift)} />
      );
    });

    await act(async () => {
      staleLegacyResponse.resolve([staleLegacyShift]);
      await flushPromises();
    });

    expect(view.root.findAllByType(StatusBadge).map((badge) => badge.props.label)).toEqual([
      "Active",
      "Attendance approved"
    ]);
    expect(findButton("worker-shift-pause-action").props).toMatchObject({
      disabled: false,
      label: "Pause my work"
    });
    expect(output(view)).toContain("QA Site 16 latest page item");
    expect(output(view)).not.toContain("QA Site 16 stale detail");
  });

  it("treats a missing exact shiftId/attendanceId pair as a refresh error", async () => {
    refresh.mockResolvedValueOnce([
      activeShift({ shiftId: 100, attendanceId: 501 }),
      activeShift({ shiftId: 101, attendanceId: 500 })
    ]);
    const view = renderShift(activeShift());

    await act(async () => {
      findButton("worker-shift-refresh-action").props.onPress();
      await flushPromises();
    });
    expect(output(view)).toContain("This attendance is no longer available");
    expect(output(view)).toContain("Sunday night shift");
  });

  it("ignores late mutation work after Back unmount and never refreshes stale content", async () => {
    const mutation = deferred<ShiftPauseResponse>();
    mockedStartMyPause.mockReturnValueOnce(mutation.promise);
    const goBack = jest.fn();
    renderShift(activeShift(), goBack);

    act(() => {
      void findButton("worker-shift-pause-action").props.onPress();
    });
    const backAction = renderer!.root.findByType(ScreenHeader).props.backAction;
    expect(backAction.label).toBe("Back");
    act(() => {
      backAction.onPress();
      renderer?.unmount();
      renderer = null;
    });
    expect(goBack).toHaveBeenCalledTimes(1);

    await act(async () => {
      mutation.resolve(pauseResponse);
      await flushPromises();
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
