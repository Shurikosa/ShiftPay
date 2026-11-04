import { useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getManagedDashboardShifts } from "../../api/shifts";
import { useAuth } from "../../context/AuthContext";
import type { ManagedShift, ManagedShiftPageResponse } from "../../types/shifts";
import { useForemanDashboardShifts } from "../useForemanDashboardShifts";

jest.mock("../../api/shifts", () => ({
  getManagedDashboardShifts: jest.fn()
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: jest.fn()
}));

const mockedGetManagedDashboardShifts = jest.mocked(getManagedDashboardShifts);
const mockedUseAuth = jest.mocked(useAuth);

type DashboardState = ReturnType<typeof useForemanDashboardShifts>;

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

function shiftFixture(id: number): ManagedShift {
  return {
    id,
    companyId: 10,
    companyName: "Acme Construction",
    currencyLabel: "EUR",
    title: `Managed shift ${id}`,
    location: null,
    status: "CLOSED",
    joinCode: `CODE${id}`,
    actualStartTime: "2026-07-05T08:00:00Z",
    actualEndTime: "2026-07-05T16:00:00Z",
    defaultBreakMinutes: 30,
    defaultHourlyRate: 20,
    foremanHourlyRate: 30,
    createdBy: 5
  };
}

function page(items: ManagedShift[]): ManagedShiftPageResponse {
  return {
    items,
    nextCursor: "ignored-dashboard-cursor",
    hasMore: true
  };
}

let latestState: DashboardState;

function Harness({ enabled }: { enabled: boolean }) {
  const state = useForemanDashboardShifts(enabled);
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

describe("useForemanDashboardShifts", () => {
  let view: ReactTestRenderer | null = null;
  let authenticatedRequest: jest.Mock;

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetManagedDashboardShifts.mockReset();
    authenticatedRequest = jest.fn(
      (request: (token: string) => Promise<unknown>) => request("foreman-token")
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

  it("keeps first-wins backend order before applying the five-shift limit", async () => {
    const firstNine = { ...shiftFixture(9), title: "First returned shift nine" };
    const laterNine = { ...shiftFixture(9), title: "Later duplicate shift nine" };
    mockedGetManagedDashboardShifts.mockResolvedValueOnce(page([
      firstNine,
      shiftFixture(7),
      laterNine,
      shiftFixture(6),
      shiftFixture(4),
      shiftFixture(3),
      shiftFixture(2)
    ]));

    await renderHook();

    expect(authenticatedRequest).toHaveBeenCalledTimes(1);
    expect(mockedGetManagedDashboardShifts).toHaveBeenCalledWith("foreman-token");
    expect(latestState.shifts.map((shift) => shift.id)).toEqual([9, 7, 6, 4, 3]);
    expect(latestState.shifts[0]).toBe(firstNine);
    expect(latestState.shifts.map((shift) => shift.title)).not.toContain(
      laterNine.title
    );
    expect(new Set(latestState.shifts.map((shift) => shift.id)).size).toBe(
      latestState.shifts.length
    );
    expect(latestState.initialLoading).toBe(false);
  });

  it("coalesces duplicate refresh requests", async () => {
    mockedGetManagedDashboardShifts.mockResolvedValueOnce(page([shiftFixture(9)]));
    await renderHook();
    const pendingRefresh = deferred<ManagedShiftPageResponse>();
    mockedGetManagedDashboardShifts.mockReturnValueOnce(pendingRefresh.promise);

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = latestState.refresh();
      second = latestState.refresh();
    });

    expect(first).toBe(second);
    expect(mockedGetManagedDashboardShifts).toHaveBeenCalledTimes(2);
    expect(latestState.refreshing).toBe(true);

    await act(async () => {
      pendingRefresh.resolve(page([shiftFixture(8)]));
      await first;
    });
    expect(latestState.shifts.map((shift) => shift.id)).toEqual([8]);
  });

  it("reports an initial error and recovers through retry", async () => {
    mockedGetManagedDashboardShifts
      .mockRejectedValueOnce(new Error("Initial network failure"))
      .mockResolvedValueOnce(page([shiftFixture(9)]));

    await renderHook();

    expect(latestState.shifts).toEqual([]);
    expect(latestState.initialLoading).toBe(false);
    expect(latestState.initialError).toBe("Initial network failure");
    expect(latestState.refreshError).toBeNull();

    await act(async () => {
      await latestState.refresh();
    });
    expect(latestState.shifts.map((shift) => shift.id)).toEqual([9]);
    expect(latestState.initialError).toBeNull();
  });

  it("retains usable cards on refresh failure and replaces them after retry", async () => {
    mockedGetManagedDashboardShifts.mockResolvedValueOnce(page([shiftFixture(9)]));
    await renderHook();
    mockedGetManagedDashboardShifts
      .mockRejectedValueOnce(new Error("Refresh network failure"))
      .mockResolvedValueOnce(page([shiftFixture(8)]));

    await act(async () => {
      await expect(latestState.refresh()).rejects.toThrow("Refresh network failure");
    });
    expect(latestState.shifts.map((shift) => shift.id)).toEqual([9]);
    expect(latestState.initialError).toBeNull();
    expect(latestState.refreshError).toBe("Refresh network failure");

    await act(async () => {
      await latestState.refresh();
    });
    expect(latestState.shifts.map((shift) => shift.id)).toEqual([8]);
    expect(latestState.refreshError).toBeNull();
  });

  it("does not publish a stale response from an older auth generation", async () => {
    const oldRequest = deferred<ManagedShiftPageResponse>();
    const newRequest = deferred<ManagedShiftPageResponse>();
    mockedGetManagedDashboardShifts
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);
    await renderHook();

    const newerAuthenticatedRequest = jest.fn(
      (request: (token: string) => Promise<unknown>) => request("new-foreman-token")
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

    expect(mockedGetManagedDashboardShifts).toHaveBeenNthCalledWith(
      2,
      "new-foreman-token"
    );
    expect(latestState.shifts.map((shift) => shift.id)).toEqual([8]);
  });

  it("ignores completion after unmount", async () => {
    const pending = deferred<ManagedShiftPageResponse>();
    mockedGetManagedDashboardShifts.mockReturnValueOnce(pending.promise);
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
    expect(mockedGetManagedDashboardShifts).toHaveBeenCalledTimes(1);
  });

  it("does not request managed shifts outside the allowed context", async () => {
    await renderHook(false);

    expect(mockedGetManagedDashboardShifts).not.toHaveBeenCalled();
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
