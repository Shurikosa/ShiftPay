import type { ComponentProps } from "react";
import {
  act,
  create,
  type ReactTestRenderer
} from "react-test-renderer";
import { getShiftSummary } from "../../api/shifts";
import { useAuth } from "../../context/AuthContext";
import type {
  PayCalculation,
  UnavailablePaySegment
} from "../../types/payCalculation";
import type { ShiftSummary, ShiftSummaryWorker } from "../../types/shifts";
import { ShiftSummaryScreen } from "../ShiftSummaryScreen";

jest.mock("@react-navigation/native", () => {
  const actualReact = jest.requireActual<typeof import("react")>("react");

  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      actualReact.useEffect(effect, [effect]);
    }
  };
});

jest.mock("../../api/shifts", () => ({
  getShiftSummary: jest.fn()
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: jest.fn()
}));

const mockedGetShiftSummary = jest.mocked(getShiftSummary);
const mockedUseAuth = jest.mocked(useAuth);

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
    totalWorkers: 1,
    totalSalary: 100,
    totalBaseAmount: 90.004,
    totalPremiumAmount: 10,
    foremanWorkedMinutes: 480,
    foremanPauseMinutes: 15,
    foremanHourlyRate: 25,
    foremanSalary: 196.88,
    workers: [workerFixture()],
    ...overrides,
    currencyLabel: overrides.currencyLabel ?? "EUR"
  };
}

type ScreenProps = ComponentProps<typeof ShiftSummaryScreen>;

const screenProps = {
  navigation: {
    goBack: jest.fn()
  },
  route: {
    key: "summary-test",
    name: "ShiftSummary",
    params: {
      shiftId: 100,
      shiftTitle: "Sunday night shift"
    }
  }
} as unknown as ScreenProps;

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("ShiftSummaryScreen pay breakdown", () => {
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
      authenticatedRequest
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer?.unmount();
      });
      renderer = null;
    }
  });

  async function renderSummary(summary: ShiftSummary): Promise<string> {
    mockedGetShiftSummary.mockResolvedValueOnce(summary);

    await act(async () => {
      renderer = create(<ShiftSummaryScreen {...screenProps} />);
      await flushPromises();
    });

    return JSON.stringify(renderer?.toJSON());
  }

  it("hydrates and displays backend aggregate audit totals without deriving them", async () => {
    const rendered = await renderSummary(summaryFixture());

    expect(authenticatedRequest).toHaveBeenCalledTimes(1);
    expect(mockedGetShiftSummary).toHaveBeenCalledWith("foreman-token", 100);
    expect(rendered).toContain("Total worker salary");
    expect(rendered).toContain("100.00");
    expect(rendered).toContain("Total base amount (audit)");
    expect(rendered).toContain("90.004");
    expect(rendered).toContain("Total premium amount (audit)");
    expect(rendered).toContain("backend-provided audit values");
    expect(rendered).toContain("final settlement rounding");
  });

  it("displays private foreman salary fields only when the owner response returns them", async () => {
    const rendered = await renderSummary(summaryFixture());

    expect(rendered).toContain("Foreman salary");
    expect(rendered).toContain("8 h 0 min");
    expect(rendered).toContain("15 min");
    expect(rendered).toContain("25.00");
    expect(rendered).toContain("196.88");
  });

  it("does not invent a private foreman salary section when fields are omitted", async () => {
    const rendered = await renderSummary(
      summaryFixture({
        foremanWorkedMinutes: undefined,
        foremanPauseMinutes: undefined,
        foremanHourlyRate: undefined,
        foremanSalary: undefined
      })
    );

    expect(rendered).not.toContain("Foreman salary");
    expect(rendered).not.toContain("196.88");
  });

  it("renders each returned COMPLETE worker calculation through the shared breakdown", async () => {
    const rendered = await renderSummary(summaryFixture());

    expect(rendered).toContain("John");
    expect(rendered).toContain("Summary night premium");
    expect(rendered).toContain("Pay breakdown");
    expect(rendered).toContain("Segment 1");
  });

  it.each(["null", "absent"])(
    "keeps stored worker salary authoritative for a legacy %s calculation",
    async (variant) => {
      const worker = workerFixture({ salary: 88.77, payCalculation: null });

      if (variant === "absent") {
        delete worker.payCalculation;
      }

      const rendered = await renderSummary(
        summaryFixture({
          totalSalary: 88.77,
          workers: [worker]
        })
      );

      expect(rendered).toContain("88.77");
      expect(rendered).toContain("Historical breakdown unavailable");
      expect(rendered).toContain("stored salary remains");
      expect(rendered).toContain("no worker audit breakdown was reconstructed");
      expect(rendered).not.toContain("Segment 1");
      expect(rendered).not.toContain("Summary night premium");
    }
  );

  it("keeps UNAVAILABLE worker rule snapshots neutral while showing persisted fields", async () => {
    const rendered = await renderSummary(
      summaryFixture({
        workers: [workerFixture({ payCalculation: unavailableCalculation() })]
      })
    );

    expect(rendered).toContain("Breakdown details unavailable");
    expect(rendered).toContain("0.12345678");
    expect(rendered).not.toContain("No premium rules applied");
  });
});
