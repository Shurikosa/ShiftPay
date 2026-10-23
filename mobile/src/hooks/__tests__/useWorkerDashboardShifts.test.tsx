import { useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getMyDashboardShifts } from "../../api/shifts";
import { useAuth } from "../../context/AuthContext";
import type {
  WorkerShiftHistoryItem,
  WorkerShiftHistoryPageResponse
} from "../../types/shifts";
import { useWorkerDashboardShifts } from "../useWorkerDashboardShifts";

jest.mock("../../api/shifts", () => ({
  getMyDashboardShifts: jest.fn()
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: jest.fn()
}));

const mockedGetMyDashboardShifts = jest.mocked(getMyDashboardShifts);
const mockedUseAuth = jest.mocked(useAuth);

type DashboardState = ReturnType<typeof useWorkerDashboardShifts>;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function shiftFixture(attendanceId: number): WorkerShiftHistoryItem {
  return {
    shiftId: attendanceId + 1000,
    attendanceId,
    companyId: 10,
    companyName: "Acme Construction",
    currencyLabel: "EUR",
    title: `Worker shift ${attendanceId}`,
    location: null,
    status: "CLOSED",
    actualStartTime: "2026-07-05T08:00:00Z",
    actualEndTime: "2026-07-05T16:00:00Z",
    attendanceStatus: "APPROVED",
    paymentStatus: "UNPAID",
    hourlyRate: 20,
    breakMinutes: 30,
    workedMinutes: 450,
    calculatedSalary: 150
  };
}

function page(items: WorkerShiftHistoryItem[]): WorkerShiftHistoryPageResponse {
  return {
    items,
    nextCursor: "ignored-dashboard-cursor",
    hasMore: true
  };
}

let latestState: DashboardState;

function Harness({ enabled }: { enabled: boolean }) {
  const state = useWorkerDashboardShifts(enabled);
  useEffect(() => {
    latestState = state;
  }, [state]);
  return null;
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("useWorkerDashboardShifts", () => {
  let view: ReactTestRenderer | null = null;
  let authenticatedRequest: jest.Mock;

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetMyDashboardShifts.mockReset();
    authenticatedRequest = jest.fn(
      (request: (token: string) => Promise<unknown>) => request("worker-token")
    );
    mockedUseAuth.mockReturnValue({
      authenticatedRequest
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    if (view) {
      act(() => view?.unmount());
      view = null;
    }
  });

  async function renderHook(enabled = true): Promise<void> {
    act(() => {
      view = create(<Harness enabled={enabled} />);
    });
    await act(async () => {
      await flushPromises();
    });
  }

  it("keeps the first attendance payload in backend order before applying the five-card limit", async () => {
    const firstNine = {
      ...shiftFixture(9),
      title: "First returned attendance nine"
    };
    const laterNine = {
      ...shiftFixture(9),
      title: "Later duplicate attendance nine"
    };
    const returned = [
      firstNine,
      shiftFixture(7),
      laterNine,
      shiftFixture(6),
      shiftFixture(4),
      shiftFixture(3),
      shiftFixture(2)
    ];
    mockedGetMyDashboardShifts.mockResolvedValueOnce(page(returned));

    await renderHook();

    expect(authenticatedRequest).toHaveBeenCalledTimes(1);
    expect(mockedGetMyDashboardShifts).toHaveBeenCalledTimes(1);
    expect(mockedGetMyDashboardShifts).toHaveBeenCalledWith("worker-token");
    expect(latestState.shifts.map((shift) => shift.attendanceId)).toEqual([
      9,
      7,
      6,
      4,
      3
    ]);
    expect(latestState.shifts[0]).toBe(firstNine);
    expect(latestState.shifts.map((shift) => shift.title)).not.toContain(
      laterNine.title
    );
    expect(new Set(latestState.shifts.map((shift) => shift.attendanceId)).size).toBe(
      latestState.shifts.length
    );
    expect(latestState.initialLoading).toBe(false);
  });

  it("coalesces rapid refresh requests into one request", async () => {
    mockedGetMyDashboardShifts.mockResolvedValueOnce(page([shiftFixture(9)]));
    await renderHook();
    const pendingRefresh = deferred<WorkerShiftHistoryPageResponse>();
    mockedGetMyDashboardShifts.mockReturnValueOnce(pendingRefresh.promise);

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = latestState.refresh();
      second = latestState.refresh();
    });

    expect(first).toBe(second);
    expect(mockedGetMyDashboardShifts).toHaveBeenCalledTimes(2);
    expect(latestState.refreshing).toBe(true);

    await act(async () => {
      pendingRefresh.resolve(page([shiftFixture(8)]));
      await first;
    });
    expect(latestState.shifts.map((shift) => shift.attendanceId)).toEqual([8]);
  });

  it("retains usable cards on refresh failure and replaces them after retry", async () => {
    mockedGetMyDashboardShifts.mockResolvedValueOnce(page([shiftFixture(9)]));
    await renderHook();
    mockedGetMyDashboardShifts
      .mockRejectedValueOnce(new Error("Refresh network failure"))
      .mockResolvedValueOnce(page([shiftFixture(8)]));

    await act(async () => {
      await expect(latestState.refresh()).rejects.toThrow("Refresh network failure");
    });

    expect(latestState.shifts.map((shift) => shift.attendanceId)).toEqual([9]);
    expect(latestState.initialError).toBeNull();
    expect(latestState.refreshError).toBe("Refresh network failure");

    await act(async () => {
      await latestState.refresh();
    });
    expect(latestState.shifts.map((shift) => shift.attendanceId)).toEqual([8]);
    expect(latestState.refreshError).toBeNull();
  });

  it("does not publish a stale response after the authenticated request generation changes", async () => {
    const oldRequest = deferred<WorkerShiftHistoryPageResponse>();
    const newRequest = deferred<WorkerShiftHistoryPageResponse>();
    mockedGetMyDashboardShifts
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);
    await renderHook();

    const newerAuthenticatedRequest = jest.fn(
      (request: (token: string) => Promise<unknown>) => request("new-worker-token")
    );
    mockedUseAuth.mockReturnValue({
      authenticatedRequest: newerAuthenticatedRequest
    } as unknown as ReturnType<typeof useAuth>);
    act(() => {
      view?.update(<Harness enabled />);
    });
    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      newRequest.resolve(page([shiftFixture(8)]));
      await flushPromises();
    });
    await act(async () => {
      oldRequest.resolve(page([shiftFixture(9)]));
      await flushPromises();
    });

    expect(mockedGetMyDashboardShifts).toHaveBeenNthCalledWith(
      2,
      "new-worker-token"
    );
    expect(latestState.shifts.map((shift) => shift.attendanceId)).toEqual([8]);
  });

  it("ignores completion after unmount", async () => {
    const pending = deferred<WorkerShiftHistoryPageResponse>();
    mockedGetMyDashboardShifts.mockReturnValueOnce(pending.promise);
    await renderHook();
    const stateAtUnmount = latestState;

    act(() => {
      view?.unmount();
      view = null;
    });
    await act(async () => {
      pending.resolve(page([shiftFixture(9)]));
      await flushPromises();
    });

    expect(stateAtUnmount.shifts).toEqual([]);
    expect(mockedGetMyDashboardShifts).toHaveBeenCalledTimes(1);
  });

  it("does not request worker data outside the allowed context", async () => {
    await renderHook(false);

    expect(mockedGetMyDashboardShifts).not.toHaveBeenCalled();
    expect(authenticatedRequest).not.toHaveBeenCalled();
    expect(latestState).toMatchObject({
      shifts: [],
      initialLoading: false,
      refreshing: false,
      initialError: null,
      refreshError: null
    });
  });
});
