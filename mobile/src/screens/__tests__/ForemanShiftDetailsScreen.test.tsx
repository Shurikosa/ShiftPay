import type { ComponentProps } from "react";
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer
} from "react-test-renderer";
import {
  closeShift,
  getShiftAttendance,
  getShiftById
} from "../../api/shifts";
import { Button } from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import { useForemanManagedShifts } from "../../hooks/useForemanManagedShifts";
import type { PayCalculation } from "../../types/payCalculation";
import type {
  AttendanceStatus,
  ManagedShift,
  ShiftAttendance,
  ShiftStatus
} from "../../types/shifts";
import { ForemanShiftDetailsScreen } from "../ForemanShiftDetailsScreen";

jest.mock("@react-navigation/native", () => {
  const actualReact = jest.requireActual<typeof import("react")>("react");

  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      actualReact.useEffect(effect, [effect]);
    }
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

jest.mock("../../context/AuthContext", () => ({
  useAuth: jest.fn()
}));

jest.mock("../../hooks/useForemanManagedShifts", () => ({
  useForemanManagedShifts: jest.fn()
}));

const mockedGetShiftAttendance = jest.mocked(getShiftAttendance);
const mockedGetShiftById = jest.mocked(getShiftById);
const mockedCloseShift = jest.mocked(closeShift);
const mockedUseAuth = jest.mocked(useAuth);
const mockedUseForemanManagedShifts = jest.mocked(useForemanManagedShifts);

function calculationFixture(ruleName = "Managed night premium"): PayCalculation {
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

function shiftFixture(overrides: Partial<ManagedShift> = {}): ManagedShift {
  return {
    id: 100,
    companyId: 10,
    companyName: "Acme Construction",
    title: "Sunday night shift",
    location: "Cologne",
    status: "CLOSED",
    joinCode: "ABC123",
    actualStartTime: "2026-07-05T22:00:00Z",
    actualEndTime: "2026-07-05T23:00:00Z",
    defaultBreakMinutes: 0,
    defaultHourlyRate: 20,
    foremanHourlyRate: 25,
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
    breakMinutes: 0,
    payableStartTime: "2026-07-05T22:00:00Z",
    pauseMinutes: 0,
    workedMinutes: 60,
    calculatedSalary: 25,
    payCalculation: calculationFixture(),
    joinedAt: "2026-07-05T21:45:00Z",
    approvedAt: "2026-07-05T21:50:00Z",
    ...overrides
  };
}

type ScreenProps = ComponentProps<typeof ForemanShiftDetailsScreen>;

const screenProps = {
  navigation: {
    goBack: jest.fn(),
    navigate: jest.fn()
  },
  route: {
    key: "foreman-shift-test",
    name: "ForemanShiftDetails",
    params: {
      shiftId: 100
    }
  }
} as unknown as ScreenProps;

function findButton(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const button = renderer.root
    .findAllByType(Button)
    .find((candidate) => candidate.props.label === label);

  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }

  return button;
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function deferred<TValue>() {
  let resolve!: (value: TValue) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<TValue>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe("ForemanShiftDetailsScreen pay breakdown", () => {
  let renderer: ReactTestRenderer | null = null;
  let authenticatedRequest: jest.Mock;

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authenticatedRequest = jest.fn(
      (request: (token: string) => Promise<unknown>) => request("foreman-token")
    );
    mockedUseAuth.mockReturnValue({
      authenticatedRequest,
      user: {
        id: 5,
        role: "FOREMAN"
      }
    } as unknown as ReturnType<typeof useAuth>);
    mockedUseForemanManagedShifts.mockReturnValue({
      shifts: [],
      loading: false,
      error: null,
      refresh: jest.fn()
    });
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer?.unmount();
      });
      renderer = null;
    }
  });

  async function renderDetails(
    shift: ManagedShift,
    attendance: ShiftAttendance[]
  ): Promise<string> {
    mockedGetShiftById.mockResolvedValueOnce(shift);
    mockedGetShiftAttendance.mockResolvedValueOnce(attendance);

    await act(async () => {
      renderer = create(<ForemanShiftDetailsScreen {...screenProps} />);
      await flushPromises();
    });

    return JSON.stringify(renderer?.toJSON());
  }

  it("renders the returned managed-worker breakdown only for final approved attendance", async () => {
    const rendered = await renderDetails(
      shiftFixture(),
      [attendanceFixture()]
    );

    expect(authenticatedRequest).toHaveBeenCalledTimes(1);
    expect(mockedGetShiftById).toHaveBeenCalledWith("foreman-token", 100);
    expect(mockedGetShiftAttendance).toHaveBeenCalledWith("foreman-token", 100);
    expect(rendered).toContain("John");
    expect(rendered).toContain("Calculated salary");
    expect(rendered).toContain("25.00");
    expect(rendered).toContain("Pay breakdown");
    expect(rendered).toContain("Managed night premium");
  });

  it.each(["null", "absent"])(
    "shows the managed legacy state for a %s calculation without fabricating details",
    async (variant) => {
      const attendance = attendanceFixture({ payCalculation: null });

      if (variant === "absent") {
        delete attendance.payCalculation;
      }

      const rendered = await renderDetails(shiftFixture(), [attendance]);

      expect(rendered).toContain("25.00");
      expect(rendered).toContain("Historical breakdown unavailable");
      expect(rendered).toContain("stored calculated salary remains");
      expect(rendered).not.toContain("Segment 1");
      expect(rendered).not.toContain("Managed night premium");
    }
  );

  it.each<{
    shiftStatus: ShiftStatus;
    attendanceStatus: AttendanceStatus;
    salary: number | null;
  }>([
    { shiftStatus: "OPEN", attendanceStatus: "APPROVED", salary: 25 },
    { shiftStatus: "ACTIVE", attendanceStatus: "APPROVED", salary: 25 },
    { shiftStatus: "CANCELLED", attendanceStatus: "APPROVED", salary: 25 },
    { shiftStatus: "DISCARDED", attendanceStatus: "APPROVED", salary: 25 },
    { shiftStatus: "CLOSED", attendanceStatus: "JOINED", salary: 25 },
    { shiftStatus: "CLOSED", attendanceStatus: "REJECTED", salary: 25 },
    { shiftStatus: "CLOSED", attendanceStatus: "CANCELLED", salary: 25 },
    { shiftStatus: "CLOSED", attendanceStatus: "APPROVED", salary: null }
  ])(
    "suppresses final details for $shiftStatus / $attendanceStatus / $salary",
    async ({ shiftStatus, attendanceStatus, salary }) => {
      const rendered = await renderDetails(
        shiftFixture({ status: shiftStatus }),
        [
          attendanceFixture({
            status: attendanceStatus,
            calculatedSalary: salary
          })
        ]
      );

      expect(rendered).not.toContain("Pay breakdown");
      expect(rendered).not.toContain("Historical breakdown unavailable");
      expect(rendered).not.toContain("Managed night premium");
    }
  );

  it("preserves the refreshed payCalculation returned by attendance reload", async () => {
    mockedGetShiftById
      .mockResolvedValueOnce(shiftFixture())
      .mockResolvedValueOnce(shiftFixture());
    mockedGetShiftAttendance
      .mockResolvedValueOnce([
        attendanceFixture({
          payCalculation: calculationFixture("Initial managed rule")
        })
      ])
      .mockResolvedValueOnce([
        attendanceFixture({
          payCalculation: calculationFixture("Refreshed managed rule")
        })
      ]);

    await act(async () => {
      renderer = create(<ForemanShiftDetailsScreen {...screenProps} />);
      await flushPromises();
    });

    expect(JSON.stringify(renderer?.toJSON())).toContain("Initial managed rule");

    await act(async () => {
      if (!renderer) {
        throw new Error("Screen was not rendered.");
      }
      findButton(renderer, "Refresh").props.onPress();
      await flushPromises();
    });

    const rendered = JSON.stringify(renderer?.toJSON());
    expect(mockedGetShiftAttendance).toHaveBeenCalledTimes(2);
    expect(rendered).toContain("Refreshed managed rule");
    expect(rendered).not.toContain("Initial managed rule");
  });

  it("keeps the post-close refresh when an older focused load resolves last", async () => {
    const initialShiftLoad = deferred<ManagedShift>();
    const initialAttendanceLoad = deferred<ShiftAttendance[]>();
    const activeInitialShift = shiftFixture({
      status: "ACTIVE",
      actualEndTime: null
    });
    const closedShift = shiftFixture({ status: "CLOSED" });
    const closedAttendance = [
      attendanceFixture({
        payCalculation: calculationFixture("Post-close managed premium")
      })
    ];
    const raceScreenProps = {
      ...screenProps,
      route: {
        ...screenProps.route,
        params: {
          ...screenProps.route.params,
          initialShift: activeInitialShift
        }
      }
    } as unknown as ScreenProps;

    mockedGetShiftById
      .mockReturnValueOnce(initialShiftLoad.promise)
      .mockResolvedValueOnce(closedShift);
    mockedGetShiftAttendance
      .mockReturnValueOnce(initialAttendanceLoad.promise)
      .mockResolvedValueOnce(closedAttendance);
    mockedCloseShift.mockResolvedValueOnce({
      id: 100,
      status: "CLOSED",
      actualEndTime: "2026-07-05T23:00:00Z"
    });

    await act(async () => {
      renderer = create(<ForemanShiftDetailsScreen {...raceScreenProps} />);
      await flushPromises();
    });

    expect(mockedGetShiftById).toHaveBeenCalledTimes(1);
    expect(mockedGetShiftAttendance).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(renderer?.toJSON())).toContain("ACTIVE");

    await act(async () => {
      if (!renderer) {
        throw new Error("Screen was not rendered.");
      }

      findButton(renderer, "Close shift").props.onPress();
      await flushPromises();
    });

    const refreshed = JSON.stringify(renderer?.toJSON());
    expect(mockedGetShiftById).toHaveBeenCalledTimes(2);
    expect(mockedGetShiftAttendance).toHaveBeenCalledTimes(2);
    expect(refreshed).toContain("CLOSED");
    expect(refreshed).toContain("Post-close managed premium");
    expect(refreshed).toContain("Shift closed. Summary is available.");

    await act(async () => {
      initialShiftLoad.resolve(activeInitialShift);
      initialAttendanceLoad.resolve([
        attendanceFixture({
          status: "JOINED",
          calculatedSalary: null,
          payCalculation: null
        })
      ]);
      await flushPromises();
    });

    const afterStaleCompletion = JSON.stringify(renderer?.toJSON());
    expect(afterStaleCompletion).toContain("CLOSED");
    expect(afterStaleCompletion).toContain("Post-close managed premium");
    expect(afterStaleCompletion).toContain("Shift closed. Summary is available.");
    expect(afterStaleCompletion).not.toContain("ACTIVE");
  });
});
