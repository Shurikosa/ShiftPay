import { Text, View } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getMyShiftHistory } from "../../api/shifts";
import { Button } from "../../components/Button";
import { useAuth } from "../AuthContext";
import {
  useWorkerShiftHistoryContext,
  WorkerShiftHistoryProvider
} from "../WorkerShiftHistoryContext";
import type { WorkerShiftHistoryItem } from "../../types/shifts";

jest.mock("../../api/shifts", () => ({
  getMyShiftHistory: jest.fn()
}));

jest.mock("../AuthContext", () => ({
  useAuth: jest.fn()
}));

const mockedGetMyShiftHistory = jest.mocked(getMyShiftHistory);
const mockedUseAuth = jest.mocked(useAuth);

const historyItem: WorkerShiftHistoryItem = {
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
  payCalculation: {
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
  }
};

function HistoryConsumer() {
  const { shifts, refresh } = useWorkerShiftHistoryContext();

  return (
    <View>
      <Text>{JSON.stringify(shifts)}</Text>
      <Button
        label="Refresh history"
        onPress={() => {
          void refresh().catch(() => undefined);
        }}
      />
    </View>
  );
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("WorkerShiftHistoryContext payCalculation hydration", () => {
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
      (request: (token: string) => Promise<unknown>) => request("worker-token")
    );
    mockedUseAuth.mockReturnValue({
      authenticatedRequest
    } as unknown as ReturnType<typeof useAuth>);
    mockedGetMyShiftHistory.mockResolvedValue([historyItem]);
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer?.unmount();
      });
      renderer = null;
    }
  });

  it("preserves the returned calculation and applied-rule snapshot after refresh", async () => {
    act(() => {
      renderer = create(
        <WorkerShiftHistoryProvider>
          <HistoryConsumer />
        </WorkerShiftHistoryProvider>
      );
    });

    await act(async () => {
      renderer?.root.findByType(Button).props.onPress();
      await flushPromises();
    });

    const hydratedHistory = renderer?.root.findAllByType(Text)[0]?.props.children;
    expect(authenticatedRequest).toHaveBeenCalledTimes(1);
    expect(mockedGetMyShiftHistory).toHaveBeenCalledWith("worker-token");
    expect(hydratedHistory).toContain('"payCalculation"');
    expect(hydratedHistory).toContain('"totalPremiumAmount":5');
    expect(hydratedHistory).toContain("Night premium");
  });
});
