import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { PayCalculation } from "../../types/payCalculation";
import type { PayoutRequest } from "../../types/payroll";
import { PayoutRequestCard } from "../PayoutRequestCard";

type PayoutRequestWithDetailedSnapshots = PayoutRequest & {
  payCalculation: PayCalculation;
  items: (
    PayoutRequest["items"][number] & {
      payCalculation: PayCalculation;
    }
  )[];
};

function requestWithForbiddenDetailFields(): PayoutRequestWithDetailedSnapshots {
  return {
    id: 900,
    companyId: 10,
    companyName: "Acme Construction",
    currencyLabel: "EUR",
    workerId: 1,
    workerFirstName: "John",
    workerLastName: "Worker",
    status: "PENDING",
    rawPayableMinutes: 467,
    payoutRoundedMinutes: 913,
    exactCalculatedAmount: 734.56,
    totalBaseAmount: 623.12345678,
    totalPremiumAmount: 512.87654321,
    payoutAmount: 117,
    requestedAt: "2026-07-06T20:00:00Z",
    approvedAt: null,
    paidAt: null,
    payCalculation: {
      snapshotStatus: "COMPLETE",
      totalRawSeconds: 3600,
      totalRawMinutesExact: 60,
      totalBaseAmount: 301.23456789,
      totalPremiumAmount: 201.23456789,
      totalAmount: 502.46913578,
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
              name: "Rule that must stay hidden",
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
    },
    items: [
      {
        attendanceId: 500,
        shiftId: 100,
        title: "Sunday night shift",
        actualStartTime: "2026-07-05T22:00:00Z",
        actualEndTime: "2026-07-05T23:00:00Z",
        paymentStatus: "PAYMENT_REQUESTED",
        rawPayableMinutes: 467,
        payoutRoundedMinutes: 407,
        hourlyRate: 20,
        calculatedSalary: 116.75,
        roundedItemAmountExact: 812.345678,
        totalBaseAmount: 301.23456789,
        totalPremiumAmount: 201.23456789,
        payoutAmount: 117,
        payCalculation: {
          snapshotStatus: "COMPLETE",
          totalRawSeconds: 3600,
          totalRawMinutesExact: 60,
          totalBaseAmount: 20,
          totalPremiumAmount: 5,
          totalAmount: 25,
          segments: []
        }
      }
    ]
  };
}

describe("PayoutRequestCard field guard", () => {
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

  it("shows only permitted payroll-card fields when detailed values are present", () => {
    act(() => {
      renderer = create(
        <PayoutRequestCard
          request={requestWithForbiddenDetailFields()}
          showWorker
        />
      );
    });

    const rendered = JSON.stringify(renderer?.toJSON());
    expect(rendered).toContain("John");
    expect(rendered).toContain("PENDING");
    expect(rendered).toContain("Sunday night shift");
    expect(rendered).toContain("Raw payable time");
    expect(rendered).toContain("7 h 47 min");
    expect(rendered).toContain("Final payout amount");

    expect(rendered).not.toContain("913");
    expect(rendered).not.toContain("407");
    expect(rendered).not.toContain("734.56");
    expect(rendered).not.toContain("812.345678");
    expect(rendered).not.toContain("623.12345678");
    expect(rendered).not.toContain("512.87654321");
    expect(rendered).not.toContain("301.23456789");
    expect(rendered).not.toContain("201.23456789");
    expect(rendered).not.toContain("Segment 1");
    expect(rendered).not.toContain("Rule that must stay hidden");
  });
});
