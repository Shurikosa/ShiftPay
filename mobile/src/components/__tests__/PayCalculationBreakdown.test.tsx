import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type {
  CompletePaySegment,
  PayCalculation,
  UnavailablePaySegment
} from "../../types/payCalculation";
import { PayCalculationBreakdown } from "../PayCalculationBreakdown";

function completeSegment(
  overrides: Partial<CompletePaySegment> = {}
): CompletePaySegment {
  return {
    snapshotStatus: "COMPLETE",
    start: "2026-07-05T22:00:00Z",
    end: "2026-07-06T04:00:00Z",
    payableSeconds: 21600,
    payableMinutesExact: 360,
    payableMinutes: 360,
    baseHourlyRate: 20,
    appliedRules: [
      {
        id: 3001,
        name: "Night premium",
        type: "TIME_OF_DAY",
        premiumPercent: 37.5
      }
    ],
    stackingStrategy: "ADD",
    effectivePremiumPercent: 37.5,
    effectiveHourlyRate: 27.5,
    baseAmount: 120,
    premiumAmount: 45,
    totalAmount: 165,
    ...overrides
  };
}

function unavailableSegment(
  overrides: Partial<UnavailablePaySegment> = {}
): UnavailablePaySegment {
  return {
    snapshotStatus: "UNAVAILABLE",
    start: "2026-07-05T22:00:00Z",
    end: "2026-07-06T04:00:00Z",
    payableSeconds: 21600,
    payableMinutesExact: 360,
    payableMinutes: 360,
    baseHourlyRate: 20,
    appliedRules: null,
    stackingStrategy: "HIGHEST_ONLY",
    effectivePremiumPercent: 37.5,
    effectiveHourlyRate: 27.5,
    baseAmount: 120,
    premiumAmount: 45,
    totalAmount: 165,
    ...overrides
  };
}

function calculationFixture(
  overrides: Partial<PayCalculation> = {}
): PayCalculation {
  return {
    snapshotStatus: "COMPLETE",
    totalRawSeconds: 28800,
    totalRawMinutesExact: 480,
    totalBaseAmount: 160,
    totalPremiumAmount: 45,
    totalAmount: 205,
    segments: [completeSegment()],
    ...overrides
  };
}

function output(renderer: ReactTestRenderer): string {
  return JSON.stringify(renderer.toJSON());
}

describe("PayCalculationBreakdown", () => {
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

  function renderCalculation(calculation: PayCalculation): ReactTestRenderer {
    act(() => {
      renderer = create(<PayCalculationBreakdown calculation={calculation} />);
    });

    return renderer as ReactTestRenderer;
  }

  it("renders backend COMPLETE totals, segment fields, and applied rule snapshots", () => {
    const view = renderCalculation(calculationFixture());
    const rendered = output(view);

    expect(rendered).toContain("Pay breakdown");
    expect(rendered).toContain("Total payable seconds");
    expect(rendered).toContain("28800 sec");
    expect(rendered).toContain("Total base amount (audit)");
    expect(rendered).toContain("205");
    expect(rendered).toContain("Segment 1");
    expect(rendered).toContain("21600 sec");
    expect(rendered).toContain("Night premium");
    expect(rendered).toContain("TIME OF DAY");
    expect(rendered).toContain("37.5%");
    expect(rendered).toContain("ADD");
  });

  it("shows a neutral no-rules message for a COMPLETE empty rule snapshot", () => {
    const view = renderCalculation(
      calculationFixture({
        segments: [completeSegment({ appliedRules: [] })]
      })
    );

    expect(output(view)).toContain("No premium rules applied");
  });

  it("treats UNAVAILABLE segment rules as unknown rather than no applied rules", () => {
    const view = renderCalculation(
      calculationFixture({
        snapshotStatus: "UNAVAILABLE",
        segments: [unavailableSegment()]
      })
    );
    const rendered = output(view);

    expect(rendered).toContain("Breakdown details unavailable");
    expect(rendered).toContain("HIGHEST ONLY");
    expect(rendered).not.toContain("No premium rules applied");
  });

  it("shows calculation-level UNAVAILABLE while retaining returned audit fields", () => {
    const view = renderCalculation(
      calculationFixture({
        snapshotStatus: "UNAVAILABLE",
        totalRawSeconds: 17,
        totalBaseAmount: 0.12345678,
        segments: []
      })
    );
    const rendered = output(view);

    expect(rendered).toContain("Breakdown details unavailable");
    expect(rendered).toContain("17 sec");
    expect(rendered).toContain("0.12345678");
  });
});
