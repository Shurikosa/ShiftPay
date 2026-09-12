import type { ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { useAuth } from "../../context/AuthContext";
import { useWorkerShiftHistory } from "../../hooks/useWorkerShiftHistory";
import type { PayCalculation } from "../../types/payCalculation";
import type { WorkerShiftHistoryItem } from "../../types/shifts";
import { WorkerShiftDetailsScreen } from "../WorkerShiftDetailsScreen";

jest.mock("../../context/AuthContext", () => ({
  useAuth: jest.fn()
}));

jest.mock("../../hooks/useWorkerShiftHistory", () => ({
  useWorkerShiftHistory: jest.fn()
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedUseWorkerShiftHistory = jest.mocked(useWorkerShiftHistory);

const payCalculation: PayCalculation = {
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

function shiftFixture(
  overrides: Partial<WorkerShiftHistoryItem> = {}
): WorkerShiftHistoryItem {
  return {
    shiftId: 100,
    attendanceId: 500,
    companyId: 10,
    companyName: "Acme Construction",
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
    payCalculation,
    ...overrides
  };
}

type ScreenProps = ComponentProps<typeof WorkerShiftDetailsScreen>;

function screenProps(shift: WorkerShiftHistoryItem): ScreenProps {
  return {
    navigation: {
      goBack: jest.fn()
    },
    route: {
      key: "worker-shift-test",
      name: "WorkerShiftDetails",
      params: { shift }
    }
  } as unknown as ScreenProps;
}

describe("WorkerShiftDetailsScreen pay breakdown", () => {
  let renderer: ReactTestRenderer | null = null;

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      authenticatedRequest: jest.fn()
    } as unknown as ReturnType<typeof useAuth>);
    mockedUseWorkerShiftHistory.mockReturnValue({
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

  function renderShift(shift: WorkerShiftHistoryItem): string {
    act(() => {
      renderer = create(<WorkerShiftDetailsScreen {...screenProps(shift)} />);
    });

    return JSON.stringify(renderer?.toJSON());
  }

  it("integrates the read-only COMPLETE breakdown for own closed approved attendance", () => {
    const rendered = renderShift(shiftFixture());

    expect(rendered).toContain("Calculated salary");
    expect(rendered).toContain("25.00");
    expect(rendered).toContain("Pay breakdown");
    expect(rendered).toContain("Night premium");
    expect(rendered).toContain("Total premium amount (audit)");
  });

  it.each(["null", "absent"])(
    "keeps stored salary authoritative for a legacy %s calculation",
    (variant) => {
      const shift = shiftFixture({ payCalculation: null });

      if (variant === "absent") {
        delete shift.payCalculation;
      }

      const rendered = renderShift(shift);

      expect(rendered).toContain("Calculated salary");
      expect(rendered).toContain("25.00");
      expect(rendered).toContain("Historical breakdown unavailable");
      expect(rendered).toContain("stored calculated salary remains");
      expect(rendered).not.toContain("Total base amount (audit)");
      expect(rendered).not.toContain("Segment 1");
    }
  );

  it.each([
    ["ACTIVE", "APPROVED"],
    ["DISCARDED", "APPROVED"],
    ["CLOSED", "JOINED"]
  ] as const)(
    "does not show a final breakdown for %s / %s attendance",
    (status, attendanceStatus) => {
      const rendered = renderShift(
        shiftFixture({
          status,
          attendanceStatus
        })
      );

      expect(rendered).not.toContain("Pay breakdown");
      expect(rendered).not.toContain("Historical breakdown unavailable");
      expect(rendered).not.toContain("Night premium");
    }
  );

  it("does not show a final breakdown while a closed approved salary is pending", () => {
    const rendered = renderShift(
      shiftFixture({
        calculatedSalary: null
      })
    );

    expect(rendered).toContain("Pending");
    expect(rendered).not.toContain("Pay breakdown");
    expect(rendered).not.toContain("Historical breakdown unavailable");
  });
});
