import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { PayCalculation } from "../../types/payCalculation";
import type { WorkerShiftHistoryItem } from "../../types/shifts";
import { WorkerShiftCard } from "../WorkerShiftCard";

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
    pauseMinutes: 0,
    workedMinutes: 60,
    calculatedSalary: 25,
    payCalculation,
    ...overrides
  };
}

describe("WorkerShiftCard pay breakdown indicator", () => {
  let renderer: ReactTestRenderer | null = null;

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer?.unmount();
      });
      renderer = null;
    }
  });

  it("shows a concise indicator without putting full calculation detail on the card", () => {
    act(() => {
      renderer = create(<WorkerShiftCard shift={shiftFixture()} />);
    });
    const rendered = JSON.stringify(renderer?.toJSON());

    expect(rendered).toContain("Pay breakdown");
    expect(rendered).not.toContain("Night premium");
    expect(rendered).not.toContain("Total base amount");
  });

  it("does not advertise a final breakdown for a non-final shift", () => {
    act(() => {
      renderer = create(
        <WorkerShiftCard
          shift={shiftFixture({
            status: "ACTIVE",
            actualEndTime: null,
            workedMinutes: null,
            calculatedSalary: null
          })}
        />
      );
    });

    expect(JSON.stringify(renderer?.toJSON())).not.toContain("Pay breakdown");
  });
});
