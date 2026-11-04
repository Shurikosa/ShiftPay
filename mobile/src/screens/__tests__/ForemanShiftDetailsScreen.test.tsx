import type { ComponentProps } from "react";
import { Alert, ActivityIndicator, ScrollView, Text } from "react-native";
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer
} from "react-test-renderer";
import { ApiError } from "../../api/errors";
import {
  approveAttendance,
  cancelShift,
  closeShift,
  discardShift,
  endAllPause,
  endMyPause,
  getShiftAttendance,
  getShiftById,
  startAllPause,
  startMyPause,
  startShift
} from "../../api/shifts";
import { Button } from "../../components/Button";
import { PayCalculationBreakdown } from "../../components/PayCalculationBreakdown";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useForemanManagedShifts } from "../../hooks/useForemanManagedShifts";
import type { User } from "../../types/auth";
import type { PayCalculation } from "../../types/payCalculation";
import type {
  ManagedShift,
  PauseState,
  ShiftAttendance,
  ShiftStatus
} from "../../types/shifts";
import { formatMoneyWithCurrencyLabel } from "../../utils/format";
import { ForemanShiftDetailsScreen } from "../ForemanShiftDetailsScreen";

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
jest.mock("../../api/shifts", () => ({
  approveAttendance: jest.fn(),
  cancelShift: jest.fn(),
  closeShift: jest.fn(),
  discardShift: jest.fn(),
  endAllPause: jest.fn(),
  endMyPause: jest.fn(),
  getShiftAttendance: jest.fn(),
  getShiftById: jest.fn(),
  startAllPause: jest.fn(),
  startMyPause: jest.fn(),
  startShift: jest.fn()
}));
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../hooks/useForemanManagedShifts", () => ({
  useForemanManagedShifts: jest.fn()
}));

const mockedApproveAttendance = jest.mocked(approveAttendance);
const mockedCancelShift = jest.mocked(cancelShift);
const mockedCloseShift = jest.mocked(closeShift);
const mockedDiscardShift = jest.mocked(discardShift);
const mockedEndAllPause = jest.mocked(endAllPause);
const mockedEndMyPause = jest.mocked(endMyPause);
const mockedGetShiftAttendance = jest.mocked(getShiftAttendance);
const mockedGetShiftById = jest.mocked(getShiftById);
const mockedStartAllPause = jest.mocked(startAllPause);
const mockedStartMyPause = jest.mocked(startMyPause);
const mockedStartShift = jest.mocked(startShift);
const mockedUseAuth = jest.mocked(useAuth);
const mockedUseForemanManagedShifts = jest.mocked(useForemanManagedShifts);

const navigation = { goBack: jest.fn(), navigate: jest.fn() };
const screenProps = {
  navigation,
  route: {
    key: "foreman-shift-test",
    name: "ForemanShiftDetails",
    params: { shiftId: 100 }
  }
} as unknown as ComponentProps<typeof ForemanShiftDetailsScreen>;

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

const inactivePause: PauseState = {
  allPaused: false,
  allPauseStartedAt: null,
  personallyPaused: false,
  personalPauseStartedAt: null,
  effectivePauseMinutes: 0
};

function completeCalculation(ruleName = "Managed night premium"): PayCalculation {
  return {
    snapshotStatus: "COMPLETE",
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
            name: ruleName,
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

function unavailableCalculation(): PayCalculation {
  return {
    snapshotStatus: "UNAVAILABLE",
    totalRawSeconds: 3600,
    totalRawMinutesExact: 60,
    totalBaseAmount: 20,
    totalPremiumAmount: 5,
    totalAmount: 25,
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
        baseAmount: 20,
        premiumAmount: 5,
        totalAmount: 25
      }
    ]
  };
}

function shiftFixture(overrides: Partial<ManagedShift> = {}): ManagedShift {
  return {
    id: 100,
    companyId: 10,
    companyName: "Acme Construction",
    currencyLabel: "EUR",
    title: "Sunday night shift",
    location: "Cologne",
    status: "CLOSED",
    joinCode: "ABC123",
    actualStartTime: "2026-07-05T22:00:00Z",
    actualEndTime: "2026-07-05T23:00:00Z",
    defaultBreakMinutes: 0,
    defaultHourlyRate: 20,
    foremanHourlyRate: 25,
    pauseState: inactivePause,
    createdBy: 5,
    ...overrides
  };
}

function attendanceFixture(
  overrides: Partial<ShiftAttendance> = {}
): ShiftAttendance {
  return {
    attendanceId: 500,
    workerId: 10,
    firstName: "John",
    lastName: "Worker",
    status: "APPROVED",
    paymentStatus: "UNPAID",
    hourlyRate: 20,
    currencyLabel: "EUR",
    breakMinutes: 0,
    payableStartTime: "2026-07-05T22:00:00Z",
    pauseMinutes: 0,
    workedMinutes: 60,
    calculatedSalary: 25,
    payCalculation: completeCalculation(),
    pauseState: inactivePause,
    joinedAt: "2026-07-05T21:45:00Z",
    approvedAt: "2026-07-05T21:50:00Z",
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
  await Promise.resolve();
}

function button(view: ReactTestRenderer, label: string): ReactTestInstance {
  const result = view.root
    .findAllByType(Button)
    .find((candidate) => candidate.props.label === label);
  if (!result) throw new Error(`Missing button: ${label}`);
  return result;
}

function buttonLabels(view: ReactTestRenderer): string[] {
  return view.root.findAllByType(Button).map((candidate) => candidate.props.label);
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

function shortShiftError(): ApiError {
  return new ApiError(
    "Shift duration is less than 15 minutes; confirm whether to save or discard",
    409,
    {
      status: 409,
      error: "Conflict",
      message: "Shift duration is less than 15 minutes; confirm whether to save or discard",
      code: "SHORT_SHIFT_REQUIRES_DECISION",
      actualDurationMinutes: 7,
      minimumDurationMinutes: 15
    }
  );
}

describe("ForemanShiftDetailsScreen", () => {
  let renderer: ReactTestRenderer | null = null;
  let authenticatedRequest: jest.Mock;
  let refreshManagedShifts: jest.Mock;

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.resetAllMocks();
    authenticatedRequest = jest.fn(
      (request: (token: string) => Promise<unknown>) => request("foreman-token")
    );
    refreshManagedShifts = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      authenticatedRequest,
      user: owner
    } as unknown as ReturnType<typeof useAuth>);
    mockedUseForemanManagedShifts.mockReturnValue({
      refresh: refreshManagedShifts
    } as never);
    mockedGetShiftById.mockResolvedValue(shiftFixture());
    mockedGetShiftAttendance.mockResolvedValue([]);
    mockedApproveAttendance.mockResolvedValue({} as never);
    mockedCancelShift.mockResolvedValue(shiftFixture({ status: "CANCELLED" }));
    mockedCloseShift.mockResolvedValue({} as never);
    mockedDiscardShift.mockResolvedValue({} as never);
    mockedEndAllPause.mockResolvedValue({} as never);
    mockedEndMyPause.mockResolvedValue({} as never);
    mockedStartAllPause.mockResolvedValue({} as never);
    mockedStartMyPause.mockResolvedValue({} as never);
    mockedStartShift.mockResolvedValue({} as never);
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
    jest.restoreAllMocks();
  });

  async function renderDetails({
    shift = shiftFixture(),
    attendance = [],
    props = screenProps,
    settle = true
  }: {
    shift?: ManagedShift;
    attendance?: ShiftAttendance[];
    props?: ComponentProps<typeof ForemanShiftDetailsScreen>;
    settle?: boolean;
  } = {}): Promise<ReactTestRenderer> {
    mockedGetShiftById.mockResolvedValue(shift);
    mockedGetShiftAttendance.mockResolvedValue(attendance);
    await act(async () => {
      renderer = create(<ForemanShiftDetailsScreen {...props} />);
      if (settle) await flush();
    });
    return renderer!;
  }

  it("shows a strong scrollable header and blocks private content during initial loading", async () => {
    const pending = deferred<ManagedShift>();
    mockedGetShiftById.mockReturnValueOnce(pending.promise);
    const view = await renderDetails({ settle: false });
    expect(view.root.findByType(ScreenHeader).props).toMatchObject({
      title: "Shift details"
    });
    expect(view.root.findByType(ScrollView).props).toMatchObject({
      horizontal: false,
      scrollEnabled: true,
      testID: "foreman-shift-details-scroll"
    });
    expect(view.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(output(view)).not.toContain("ABC123");

    await act(async () => {
      pending.resolve(shiftFixture());
      await flush();
    });
    expect(output(view)).toContain("ABC123");
  });

  it.each([
    ["WORKER", { ...owner, role: "WORKER" as const }],
    ["FOREMAN without company", { ...owner, company: null }]
  ])("enforces the %s role/company gate before API access", async (_case, user) => {
    mockedUseAuth.mockReturnValue({ user, authenticatedRequest } as unknown as ReturnType<typeof useAuth>);
    const view = await renderDetails();
    expect(output(view)).toContain("Foreman company access required");
    expect(mockedGetShiftById).not.toHaveBeenCalled();
    expect(mockedGetShiftAttendance).not.toHaveBeenCalled();
  });

  it.each([
    ["different creator", { createdBy: 77 }],
    ["different company", { companyId: 88, foremanHourlyRate: 999 }]
  ])("blocks private details for a %s response", async (_case, overrides) => {
    const privateShift = shiftFixture({
      title: "Private owner title",
      ...overrides
    });
    const props = {
      ...screenProps,
      route: {
        ...screenProps.route,
        params: { shiftId: 100, initialShift: privateShift }
      }
    } as ComponentProps<typeof ForemanShiftDetailsScreen>;
    const view = await renderDetails({ shift: privateShift, props });
    expect(output(view)).toContain("Shift access denied");
    expect(output(view)).not.toContain("Private owner title");
    expect(output(view)).not.toContain("999");
    expect(mockedGetShiftAttendance).not.toHaveBeenCalled();
  });

  it.each([
    ["OPEN", "Open"],
    ["ACTIVE", "Active"],
    ["CLOSED", "Closed"],
    ["CANCELLED", "Cancelled"],
    ["DISCARDED", "Discarded"]
  ] as const)("renders canonical %s lifecycle status", async (status, label) => {
    const view = await renderDetails({ shift: shiftFixture({ status }) });
    expect(
      view.root.findAllByType(StatusBadge).map((badge) => badge.props.label)
    ).toContain(label);
    expect(output(view)).not.toContain(` ${status} `);
  });

  it.each<{
    status: ShiftStatus;
    present: string[];
    absent: string[];
  }>([
    {
      status: "OPEN",
      present: ["Start shift", "Cancel shift", "Approve attendance"],
      absent: ["Pause myself", "Pause everyone", "Close shift", "Open summary"]
    },
    {
      status: "ACTIVE",
      present: ["Pause myself", "Pause everyone", "Close shift", "Approve attendance"],
      absent: ["Start shift", "Cancel shift", "Open summary"]
    },
    {
      status: "CLOSED",
      present: ["Open summary"],
      absent: ["Start shift", "Cancel shift", "Pause myself", "Close shift", "Approve attendance"]
    },
    {
      status: "CANCELLED",
      present: [],
      absent: ["Start shift", "Cancel shift", "Pause myself", "Close shift", "Open summary", "Approve attendance", "Payroll"]
    },
    {
      status: "DISCARDED",
      present: [],
      absent: ["Start shift", "Cancel shift", "Pause myself", "Close shift", "Open summary", "Approve attendance", "Payroll"]
    }
  ])("shows only contextual actions for $status", async ({ status, present, absent }) => {
    const view = await renderDetails({
      shift: shiftFixture({ status }),
      attendance: [attendanceFixture({ status: "JOINED", calculatedSalary: null })]
    });
    const labels = buttonLabels(view);
    for (const label of present) expect(labels).toContain(label);
    for (const label of absent) expect(labels).not.toContain(label);
    expect(labels).toContain("Refresh");
  });

  it("separates destructive cancellation and preserves Back/summary navigation", async () => {
    const open = await renderDetails({ shift: shiftFixture({ status: "OPEN" }) });
    expect(open.root.findByProps({ testID: "foreman-shift-destructive-card" })).toBeDefined();
    expect(button(open, "Cancel shift").props.variant).toBe("destructive");
    act(() => void open.root.findByType(ScreenHeader).props.backAction.onPress());
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    act(() => open.unmount());
    renderer = null;

    const closed = await renderDetails({ shift: shiftFixture({ status: "CLOSED" }) });
    act(() => void button(closed, "Open summary").props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("ShiftSummary", {
      shiftId: 100,
      shiftTitle: "Sunday night shift"
    });
  });

  it("renders attendance empty, error/retry, and returned data states", async () => {
    const empty = await renderDetails({ shift: shiftFixture({ status: "OPEN" }) });
    expect(empty.root.findByProps({ testID: "foreman-attendance-empty" })).toBeDefined();
    act(() => empty.unmount());
    renderer = null;

    mockedGetShiftAttendance.mockRejectedValueOnce(new Error("Attendance offline."));
    const errorView = await renderDetails({
      shift: shiftFixture({ status: "OPEN" }),
      attendance: [attendanceFixture()]
    });
    expect(errorView.root.findByProps({ testID: "foreman-attendance-error" })).toBeDefined();
    expect(output(errorView)).toContain("Attendance offline.");
    mockedGetShiftAttendance.mockResolvedValueOnce([
      attendanceFixture({ firstName: "Returned" })
    ]);
    await act(async () => {
      button(errorView, "Retry").props.onPress();
      await flush();
    });
    expect(output(errorView)).toContain("Returned");
  });

  it("shows shift load error with retry", async () => {
    mockedGetShiftById.mockRejectedValueOnce(new Error("Shift offline."));
    const view = await renderDetails();
    expect(view.root.findByProps({ testID: "foreman-shift-error" })).toBeDefined();
    mockedGetShiftById.mockResolvedValueOnce(shiftFixture());
    mockedGetShiftAttendance.mockResolvedValueOnce([]);
    await act(async () => {
      button(view, "Retry").props.onPress();
      await flush();
    });
    expect(mockedGetShiftById).toHaveBeenCalledTimes(2);
    expect(output(view)).toContain("Sunday night shift");
  });

  it("shows only returned nullable fields and never substitutes the current company label", async () => {
    const attendance = attendanceFixture({
      approvedAt: null,
      payableStartTime: null,
      pauseMinutes: null,
      workedMinutes: null,
      calculatedSalary: null,
      payCalculation: undefined,
      currencyLabel: null,
      paidAt: null
    });
    const view = await renderDetails({
      shift: shiftFixture({
        location: null,
        actualStartTime: null,
        actualEndTime: null,
        foremanHourlyRate: undefined,
        currencyLabel: null,
        status: "OPEN"
      }),
      attendance: [attendance]
    });
    const rendered = output(view);
    expect(rendered).not.toContain("Location");
    expect(rendered).not.toContain("Actual start");
    expect(rendered).not.toContain("Actual end");
    expect(rendered).not.toContain("Foreman hourly rate");
    expect(rendered).not.toContain("Payable start");
    expect(rendered).not.toContain("Worked time");
    expect(rendered).not.toContain("Calculated salary");
    expect(rendered).toContain("currency unavailable");
    expect(rendered).not.toContain("20.00 EUR");
  });

  it("renders exact shift and attendance pause data including late-worker payable start", async () => {
    const activePause: PauseState = {
      allPaused: true,
      allPauseStartedAt: "2026-07-05T22:10:00Z",
      personallyPaused: true,
      personalPauseStartedAt: "2026-07-05T22:12:00Z",
      effectivePauseMinutes: 8
    };
    const view = await renderDetails({
      shift: shiftFixture({ status: "ACTIVE", pauseState: activePause }),
      attendance: [
        attendanceFixture({
          payableStartTime: "2026-07-05T22:15:00Z",
          pauseState: activePause,
          pauseMinutes: 8,
          workedMinutes: 37
        })
      ]
    });
    const rendered = output(view);
    expect(rendered).toContain("Personal pause active");
    expect(rendered).toContain("Crew pause active");
    expect(rendered).toContain("Payable start");
    expect(rendered).toContain("Pause time");
    expect(rendered).toContain("8 min");
    expect(rendered).toContain("Worked time");
    expect(rendered).toContain("37 min");
  });

  it("distinguishes complete, unavailable, and absent final breakdowns", async () => {
    const view = await renderDetails({
      attendance: [
        attendanceFixture({ attendanceId: 1, payCalculation: completeCalculation("Returned complete rule") }),
        attendanceFixture({ attendanceId: 2, payCalculation: unavailableCalculation() }),
        attendanceFixture({ attendanceId: 3, payCalculation: undefined })
      ]
    });
    expect(view.root.findAllByType(PayCalculationBreakdown)).toHaveLength(1);
    expect(output(view)).toContain("Returned complete rule");
    expect(view.root.findByProps({ testID: "foreman-attendance-breakdown-unavailable-2" })).toBeDefined();
    expect(view.root.findByProps({ testID: "foreman-attendance-breakdown-absent-3" })).toBeDefined();
    expect(output(view)).toContain(formatMoneyWithCurrencyLabel(25, "EUR"));
  });

  it("never renders a managed-worker breakdown outside final closed approved attendance", async () => {
    const view = await renderDetails({
      shift: shiftFixture({ status: "ACTIVE" }),
      attendance: [attendanceFixture({ payCalculation: completeCalculation("Private audit rule") })]
    });
    expect(view.root.findAllByType(PayCalculationBreakdown)).toHaveLength(0);
    expect(output(view)).not.toContain("Private audit rule");
  });

  it("approves only a JOINED worker in OPEN/ACTIVE and refreshes authoritatively", async () => {
    const joined = attendanceFixture({
      status: "JOINED",
      approvedAt: null,
      calculatedSalary: null,
      payCalculation: undefined
    });
    mockedGetShiftById
      .mockResolvedValueOnce(shiftFixture({ status: "OPEN" }))
      .mockResolvedValueOnce(shiftFixture({ status: "OPEN" }));
    mockedGetShiftAttendance
      .mockResolvedValueOnce([joined])
      .mockResolvedValueOnce([attendanceFixture()]);
    const view = await renderDetails();
    await act(async () => {
      button(view, "Approve attendance").props.onPress();
      await flush();
    });
    expect(mockedApproveAttendance).toHaveBeenCalledWith("foreman-token", 100, 500);
    expect(mockedGetShiftAttendance).toHaveBeenCalledTimes(2);
    expect(output(view)).toContain("Worker attendance approved.");
    expect(buttonLabels(view)).not.toContain("Approve attendance");
  });

  it("guards a stale approve callback after attendance refresh", async () => {
    const joined = attendanceFixture({ status: "JOINED", calculatedSalary: null });
    mockedGetShiftAttendance
      .mockResolvedValueOnce([joined])
      .mockResolvedValueOnce([attendanceFixture()]);
    const view = await renderDetails({ shift: shiftFixture({ status: "OPEN" }) });
    const staleApprove = button(view, "Approve attendance").props.onPress;
    await act(async () => {
      button(view, "Refresh").props.onPress();
      await flush();
    });
    act(() => void staleApprove());
    expect(mockedApproveAttendance).not.toHaveBeenCalled();
  });

  it("starts an OPEN shift once, locks duplicate callbacks, and refreshes", async () => {
    const open = shiftFixture({ status: "OPEN" });
    const active = shiftFixture({ status: "ACTIVE" });
    mockedGetShiftById.mockResolvedValueOnce(open).mockResolvedValueOnce(active);
    const pending = deferred<Awaited<ReturnType<typeof startShift>>>();
    mockedStartShift.mockReturnValueOnce(pending.promise);
    const view = await renderDetails();
    const savedStart = button(view, "Start shift").props.onPress;
    await act(async () => {
      savedStart();
      savedStart();
      await Promise.resolve();
    });
    expect(mockedStartShift).toHaveBeenCalledTimes(1);
    expect(button(view, "Start shift").props.loading).toBe(true);
    await act(async () => {
      pending.resolve({} as Awaited<ReturnType<typeof startShift>>);
      await flush();
    });
    expect(output(view)).toContain("Shift started.");
    expect(buttonLabels(view)).toContain("Close shift");
  });

  it("cancels only after destructive confirmation", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
    mockedGetShiftById
      .mockResolvedValueOnce(shiftFixture({ status: "OPEN" }))
      .mockResolvedValueOnce(shiftFixture({ status: "CANCELLED" }));
    const view = await renderDetails();
    act(() => void button(view, "Cancel shift").props.onPress());
    expect(mockedCancelShift).not.toHaveBeenCalled();
    const actions = alert.mock.calls[0]?.[2];
    const confirm = actions?.find((item) => item.text === "Cancel shift");
    await act(async () => {
      confirm?.onPress?.();
      await flush();
    });
    expect(mockedCancelShift).toHaveBeenCalledWith("foreman-token", 100);
    expect(output(view)).toContain("Shift cancelled.");
    expect(buttonLabels(view)).not.toContain("Open summary");
  });

  it.each([
    ["Pause myself", mockedStartMyPause, inactivePause],
    ["Resume myself", mockedEndMyPause, { ...inactivePause, personallyPaused: true }],
    ["Pause everyone", mockedStartAllPause, inactivePause],
    ["Resume everyone", mockedEndAllPause, { ...inactivePause, allPaused: true }]
  ] as const)("runs %s from returned pause state", async (label, endpoint, pauseState) => {
    const active = shiftFixture({ status: "ACTIVE", pauseState });
    mockedGetShiftById.mockResolvedValue(active);
    const view = await renderDetails({ shift: active });
    await act(async () => {
      button(view, label).props.onPress();
      await flush();
    });
    expect(endpoint).toHaveBeenCalledWith("foreman-token", 100);
  });

  it("closes an ACTIVE shift and exposes summary only after refresh", async () => {
    mockedGetShiftById
      .mockResolvedValueOnce(shiftFixture({ status: "ACTIVE" }))
      .mockResolvedValueOnce(shiftFixture({ status: "CLOSED" }));
    const view = await renderDetails();
    await act(async () => {
      button(view, "Close shift").props.onPress();
      await flush();
    });
    expect(mockedCloseShift).toHaveBeenCalledWith("foreman-token", 100, undefined);
    expect(output(view)).toContain("Shift closed. Summary is available.");
    expect(buttonLabels(view)).toContain("Open summary");
  });

  it("uses the backend short-shift decision and saves with the exact override", async () => {
    mockedGetShiftById
      .mockResolvedValueOnce(shiftFixture({ status: "ACTIVE" }))
      .mockResolvedValueOnce(shiftFixture({ status: "CLOSED" }));
    mockedCloseShift.mockRejectedValueOnce(shortShiftError()).mockResolvedValueOnce({} as never);
    const view = await renderDetails();
    await act(async () => {
      button(view, "Close shift").props.onPress();
      await flush();
    });
    expect(output(view)).toContain("Backend measured 7 min");
    expect(mockedDiscardShift).not.toHaveBeenCalled();
    await act(async () => {
      button(view, "Save shift").props.onPress();
      await flush();
    });
    expect(mockedCloseShift.mock.calls).toEqual([
      ["foreman-token", 100, undefined],
      ["foreman-token", 100, { saveShortShift: true }]
    ]);
    expect(buttonLabels(view)).toContain("Open summary");
  });

  it("discards only through the backend short-shift decision endpoint", async () => {
    mockedGetShiftById
      .mockResolvedValueOnce(shiftFixture({ status: "ACTIVE" }))
      .mockResolvedValueOnce(shiftFixture({ status: "DISCARDED" }));
    mockedCloseShift.mockRejectedValueOnce(shortShiftError());
    const view = await renderDetails();
    await act(async () => {
      button(view, "Close shift").props.onPress();
      await flush();
    });
    await act(async () => {
      button(view, "Discard short shift").props.onPress();
      await flush();
    });
    expect(mockedDiscardShift).toHaveBeenCalledWith("foreman-token", 100);
    expect(output(view)).toContain("Short shift discarded.");
    expect(buttonLabels(view)).not.toContain("Open summary");
    expect(buttonLabels(view)).not.toContain("Payroll");
  });

  it("keeps the decision open after a failed Save POST and permits an exact retry", async () => {
    const active = shiftFixture({ status: "ACTIVE" });
    const saveAttempt = deferred<Awaited<ReturnType<typeof closeShift>>>();
    mockedGetShiftById
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(shiftFixture({ status: "CLOSED" }));
    mockedCloseShift
      .mockRejectedValueOnce(shortShiftError())
      .mockReturnValueOnce(saveAttempt.promise)
      .mockResolvedValueOnce({} as never);
    const view = await renderDetails();
    await act(async () => {
      button(view, "Close shift").props.onPress();
      await flush();
    });
    const firstSave = button(view, "Save shift").props.onPress;

    await act(async () => {
      firstSave();
      firstSave();
      await Promise.resolve();
    });
    expect(mockedCloseShift).toHaveBeenCalledTimes(2);
    await act(async () => {
      saveAttempt.reject(new Error("Save offline."));
      await flush();
    });
    expect(output(view)).toContain("Save offline.");
    expect(buttonLabels(view)).toContain("Save shift");
    expect(buttonLabels(view)).toContain("Discard short shift");

    await act(async () => {
      button(view, "Save shift").props.onPress();
      await flush();
    });
    expect(mockedCloseShift.mock.calls).toEqual([
      ["foreman-token", 100, undefined],
      ["foreman-token", 100, { saveShortShift: true }],
      ["foreman-token", 100, { saveShortShift: true }]
    ]);
    expect(buttonLabels(view)).toContain("Open summary");
  });

  it("keeps the decision open after a failed Discard POST and permits retry", async () => {
    const discardAttempt = deferred<Awaited<ReturnType<typeof discardShift>>>();
    mockedGetShiftById
      .mockResolvedValueOnce(shiftFixture({ status: "ACTIVE" }))
      .mockResolvedValueOnce(shiftFixture({ status: "DISCARDED" }));
    mockedCloseShift.mockRejectedValueOnce(shortShiftError());
    mockedDiscardShift
      .mockReturnValueOnce(discardAttempt.promise)
      .mockResolvedValueOnce({} as never);
    const view = await renderDetails();
    await act(async () => {
      button(view, "Close shift").props.onPress();
      await flush();
    });
    const firstDiscard = button(view, "Discard short shift").props.onPress;

    await act(async () => {
      firstDiscard();
      firstDiscard();
      await Promise.resolve();
    });
    expect(mockedDiscardShift).toHaveBeenCalledTimes(1);
    await act(async () => {
      discardAttempt.reject(new Error("Discard offline."));
      await flush();
    });
    expect(output(view)).toContain("Discard offline.");
    expect(buttonLabels(view)).toContain("Discard short shift");

    await act(async () => {
      button(view, "Discard short shift").props.onPress();
      await flush();
    });
    expect(mockedDiscardShift).toHaveBeenCalledTimes(2);
    expect(mockedDiscardShift).toHaveBeenNthCalledWith(
      2,
      "foreman-token",
      100
    );
    expect(buttonLabels(view)).not.toContain("Open summary");
  });

  it("closes the decision after confirmed Save, blocks stale decision callbacks, and retries only refresh", async () => {
    const confirmedSave = deferred<Awaited<ReturnType<typeof closeShift>>>();
    mockedGetShiftById
      .mockResolvedValueOnce(shiftFixture({ status: "ACTIVE" }))
      .mockRejectedValueOnce(new Error("Save refresh failed."))
      .mockResolvedValueOnce(shiftFixture({ status: "CLOSED" }));
    mockedCloseShift
      .mockRejectedValueOnce(shortShiftError())
      .mockReturnValueOnce(confirmedSave.promise);
    const view = await renderDetails();
    await act(async () => {
      button(view, "Close shift").props.onPress();
      await flush();
    });
    const staleSave = button(view, "Save shift").props.onPress;
    const staleDiscard = button(view, "Discard short shift").props.onPress;
    await act(async () => {
      staleSave();
      await Promise.resolve();
    });
    await act(async () => {
      confirmedSave.resolve({} as Awaited<ReturnType<typeof closeShift>>);
      await flush();
    });

    expect(output(view)).toContain("Save refresh failed.");
    expect(buttonLabels(view)).not.toContain("Save shift");
    act(() => {
      void staleSave();
      void staleDiscard();
    });
    expect(mockedCloseShift).toHaveBeenCalledTimes(2);
    expect(mockedDiscardShift).not.toHaveBeenCalled();

    await act(async () => {
      button(view, "Retry refresh").props.onPress();
      await flush();
    });
    expect(mockedCloseShift).toHaveBeenCalledTimes(2);
    expect(mockedDiscardShift).not.toHaveBeenCalled();
    expect(mockedGetShiftById).toHaveBeenCalledTimes(3);
    expect(buttonLabels(view)).toContain("Open summary");
  });

  it("closes the decision after confirmed Discard, blocks stale decision callbacks, and retries only refresh", async () => {
    const confirmedDiscard = deferred<Awaited<ReturnType<typeof discardShift>>>();
    mockedGetShiftById
      .mockResolvedValueOnce(shiftFixture({ status: "ACTIVE" }))
      .mockRejectedValueOnce(new Error("Discard refresh failed."))
      .mockResolvedValueOnce(shiftFixture({ status: "DISCARDED" }));
    mockedCloseShift.mockRejectedValueOnce(shortShiftError());
    mockedDiscardShift.mockReturnValueOnce(confirmedDiscard.promise);
    const view = await renderDetails();
    await act(async () => {
      button(view, "Close shift").props.onPress();
      await flush();
    });
    const staleSave = button(view, "Save shift").props.onPress;
    const staleDiscard = button(view, "Discard short shift").props.onPress;
    await act(async () => {
      staleDiscard();
      await Promise.resolve();
    });
    await act(async () => {
      confirmedDiscard.resolve({} as Awaited<ReturnType<typeof discardShift>>);
      await flush();
    });

    expect(output(view)).toContain("Discard refresh failed.");
    expect(buttonLabels(view)).not.toContain("Discard short shift");
    act(() => {
      void staleSave();
      void staleDiscard();
    });
    expect(mockedCloseShift).toHaveBeenCalledTimes(1);
    expect(mockedDiscardShift).toHaveBeenCalledTimes(1);

    await act(async () => {
      button(view, "Retry refresh").props.onPress();
      await flush();
    });
    expect(mockedCloseShift).toHaveBeenCalledTimes(1);
    expect(mockedDiscardShift).toHaveBeenCalledTimes(1);
    expect(mockedGetShiftById).toHaveBeenCalledTimes(3);
    expect(buttonLabels(view)).not.toContain("Open summary");
  });

  it("invalidates saved Save and Discard callbacks synchronously after Keep active", async () => {
    const keepRefresh = deferred<ManagedShift>();
    mockedGetShiftById
      .mockResolvedValueOnce(shiftFixture({ status: "ACTIVE" }))
      .mockReturnValueOnce(keepRefresh.promise);
    mockedCloseShift.mockRejectedValueOnce(shortShiftError());
    const view = await renderDetails();
    await act(async () => {
      button(view, "Close shift").props.onPress();
      await flush();
    });
    const staleSave = button(view, "Save shift").props.onPress;
    const staleDiscard = button(view, "Discard short shift").props.onPress;

    await act(async () => {
      button(view, "Keep active").props.onPress();
      staleSave();
      staleDiscard();
      await Promise.resolve();
    });
    expect(mockedCloseShift).toHaveBeenCalledTimes(1);
    expect(mockedDiscardShift).not.toHaveBeenCalled();

    await act(async () => {
      keepRefresh.resolve(shiftFixture({ status: "ACTIVE" }));
      await flush();
    });
    act(() => {
      void staleSave();
      void staleDiscard();
    });
    expect(mockedCloseShift).toHaveBeenCalledTimes(1);
    expect(mockedDiscardShift).not.toHaveBeenCalled();
  });

  it("invalidates saved short-decision callbacks on unmount", async () => {
    mockedCloseShift.mockRejectedValueOnce(shortShiftError());
    const view = await renderDetails({
      shift: shiftFixture({ status: "ACTIVE" })
    });
    await act(async () => {
      button(view, "Close shift").props.onPress();
      await flush();
    });
    const staleSave = button(view, "Save shift").props.onPress;
    const staleDiscard = button(view, "Discard short shift").props.onPress;
    act(() => view.unmount());
    renderer = null;

    act(() => {
      void staleSave();
      void staleDiscard();
    });
    expect(mockedCloseShift).toHaveBeenCalledTimes(1);
    expect(mockedDiscardShift).not.toHaveBeenCalled();
  });

  it("keeps direct mutation failure retryable", async () => {
    const open = shiftFixture({ status: "OPEN" });
    mockedGetShiftById.mockResolvedValue(open);
    mockedStartShift.mockRejectedValueOnce(new Error("Start offline."));
    const view = await renderDetails({ shift: open });
    await act(async () => {
      button(view, "Start shift").props.onPress();
      await flush();
    });
    expect(output(view)).toContain("Start offline.");
    await act(async () => {
      button(view, "Start shift").props.onPress();
      await flush();
    });
    expect(mockedStartShift).toHaveBeenCalledTimes(2);
  });

  it("blocks repeat mutation after confirmed success until refresh succeeds", async () => {
    const open = shiftFixture({ status: "OPEN" });
    mockedGetShiftById
      .mockResolvedValueOnce(open)
      .mockRejectedValueOnce(new Error("Refresh failed."))
      .mockResolvedValueOnce(shiftFixture({ status: "ACTIVE" }));
    const view = await renderDetails();
    const staleStart = button(view, "Start shift").props.onPress;
    await act(async () => {
      staleStart();
      await flush();
    });
    expect(output(view)).toContain("Refresh failed.");
    expect(button(view, "Start shift").props.disabled).toBe(true);
    act(() => void staleStart());
    expect(mockedStartShift).toHaveBeenCalledTimes(1);
    await act(async () => {
      button(view, "Retry refresh").props.onPress();
      await flush();
    });
    expect(mockedStartShift).toHaveBeenCalledTimes(1);
    expect(buttonLabels(view)).toContain("Close shift");
  });

  it("ignores an older overlapping load that resolves last", async () => {
    const view = await renderDetails({ shift: shiftFixture({ status: "OPEN" }) });
    const refresh = button(view, "Refresh").props.onPress;
    const older = deferred<ManagedShift>();
    mockedGetShiftById
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce(shiftFixture({ status: "CLOSED" }));
    mockedGetShiftAttendance.mockResolvedValueOnce([]);
    await act(async () => {
      refresh();
      refresh();
      await flush();
    });
    expect(buttonLabels(view)).toContain("Open summary");
    await act(async () => {
      older.resolve(shiftFixture({ status: "ACTIVE" }));
      await flush();
    });
    expect(buttonLabels(view)).toContain("Open summary");
    expect(buttonLabels(view)).not.toContain("Close shift");
  });

  it("ignores pending load and mutation completions after unmount", async () => {
    const loadPending = deferred<ManagedShift>();
    mockedGetShiftById.mockReturnValueOnce(loadPending.promise);
    await renderDetails({ settle: false });
    act(() => renderer!.unmount());
    renderer = null;
    await act(async () => {
      loadPending.resolve(shiftFixture());
      await flush();
    });
    expect(mockedGetShiftAttendance).not.toHaveBeenCalled();

    const mutationPending = deferred<Awaited<ReturnType<typeof startShift>>>();
    mockedGetShiftById.mockResolvedValueOnce(shiftFixture({ status: "OPEN" }));
    mockedGetShiftAttendance.mockResolvedValueOnce([]);
    mockedStartShift.mockReturnValueOnce(mutationPending.promise);
    const view = await renderDetails();
    await act(async () => {
      button(view, "Start shift").props.onPress();
      await Promise.resolve();
    });
    act(() => view.unmount());
    renderer = null;
    await act(async () => {
      mutationPending.resolve({} as Awaited<ReturnType<typeof startShift>>);
      await flush();
    });
    expect(mockedGetShiftById).toHaveBeenCalledTimes(2);
    expect(refreshManagedShifts).not.toHaveBeenCalled();
  });
});
