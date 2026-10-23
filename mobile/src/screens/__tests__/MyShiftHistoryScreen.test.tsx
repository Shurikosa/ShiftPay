import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { RefreshControl, Text } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getMyShiftHistoryPage } from "../../api/shifts";
import { Button } from "../../components/Button";
import { StatusBadge } from "../../components/StatusBadge";
import { WorkerShiftHistoryCard } from "../../components/WorkerShiftHistoryCard";
import { useAuth } from "../../context/AuthContext";
import type {
  WorkerShiftHistoryItem,
  WorkerShiftHistoryPageResponse
} from "../../types/shifts";
import { formatDateTime } from "../../utils/format";
import { MyShiftHistoryScreen } from "../MyShiftHistoryScreen";

jest.mock("@expo/vector-icons/Ionicons", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text: NativeText } = jest.requireActual<typeof import("react-native")>(
    "react-native"
  );
  const MockIonicons = (props: Record<string, unknown>) =>
    React.createElement(NativeText, props as ComponentProps<typeof NativeText>);
  return { __esModule: true, default: MockIonicons };
});

jest.mock("../../api/shifts", () => ({
  getMyShiftHistoryPage: jest.fn()
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: jest.fn()
}));

const mockedGetMyShiftHistoryPage = jest.mocked(getMyShiftHistoryPage);
const mockedUseAuth = jest.mocked(useAuth);
const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const props = {
  navigation,
  route: { key: "worker-shifts", name: "MyShiftHistory" }
} as unknown as ComponentProps<typeof MyShiftHistoryScreen>;

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

function shiftFixture(
  attendanceId: number,
  overrides: Partial<WorkerShiftHistoryItem> = {}
): WorkerShiftHistoryItem {
  return {
    shiftId: attendanceId + 1000,
    attendanceId,
    companyId: 10,
    companyName: "Acme Construction",
    currencyLabel: "EUR",
    title: `Worker shift ${attendanceId}`,
    location: "Cologne",
    status: "CLOSED",
    actualStartTime: "2026-07-05T08:00:00Z",
    actualEndTime: "2026-07-05T16:00:00Z",
    attendanceStatus: "APPROVED",
    paymentStatus: "UNPAID",
    hourlyRate: 20,
    breakMinutes: 30,
    payableStartTime: "2026-07-05T08:05:00Z",
    pauseMinutes: 5,
    workedMinutes: 445,
    calculatedSalary: 148.33,
    payCalculation: {
      snapshotStatus: "COMPLETE",
      totalRawSeconds: 26700,
      totalRawMinutesExact: 445,
      totalBaseAmount: 148.33333333,
      totalPremiumAmount: 0,
      totalAmount: 148.33333333,
      segments: []
    },
    pauseState: {
      allPaused: false,
      allPauseStartedAt: null,
      personallyPaused: false,
      personalPauseStartedAt: null,
      effectivePauseMinutes: 5
    },
    ...overrides
  };
}

function page(
  items: WorkerShiftHistoryItem[],
  nextCursor: string | null
): WorkerShiftHistoryPageResponse {
  return { items, nextCursor, hasMore: nextCursor !== null };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function findButton(view: ReactTestRenderer, label: string) {
  const button = view.root
    .findAllByType(Button)
    .find((candidate) => candidate.props.label === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function renderedIds(view: ReactTestRenderer): number[] {
  return view.root
    .findAllByType(WorkerShiftHistoryCard)
    .map((card) => card.props.shift.attendanceId as number);
}

function renderedText(view: ReactTestRenderer): string {
  return view.root
    .findAllByType(Text)
    .flatMap((node) => node.props.children)
    .filter((value): value is string | number =>
      typeof value === "string" || typeof value === "number"
    )
    .join(" ");
}

function historyCard(view: ReactTestRenderer, attendanceId: number) {
  const card = view.root
    .findAllByType(WorkerShiftHistoryCard)
    .find((candidate) => candidate.props.shift.attendanceId === attendanceId);
  if (!card) throw new Error(`History card not found: ${attendanceId}`);
  return card;
}

describe("MyShiftHistoryScreen paged WORKER history", () => {
  let view: ReactTestRenderer | null = null;
  let authenticatedRequest: jest.Mock;

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    expect(Ionicons).toBeDefined();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetMyShiftHistoryPage.mockReset();
    authenticatedRequest = jest.fn(
      (request: (token: string) => Promise<unknown>) => request("worker-token")
    );
    mockedUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: "worker@example.com",
        firstName: "Wendy",
        lastName: "Worker",
        role: "WORKER",
        company: { id: 10, name: "Acme Construction" }
      },
      authenticatedRequest
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    if (view) {
      act(() => view?.unmount());
      view = null;
    }
  });

  async function renderScreen() {
    act(() => {
      view = create(<MyShiftHistoryScreen {...props} />);
    });
    await act(async () => {
      await flushPromises();
    });
    return view!;
  }

  it("shows an initial loading state while the first page is pending", async () => {
    const initial = deferred<WorkerShiftHistoryPageResponse>();
    mockedGetMyShiftHistoryPage.mockReturnValueOnce(initial.promise);
    const renderer = await renderScreen();

    expect(renderedText(renderer)).toContain("Loading history");
    expect(renderedText(renderer)).toContain("Fetching your joined shifts");

    await act(async () => {
      initial.resolve(page([], null));
      await flushPromises();
    });
  });

  it("keeps first-page backend order and first attendance occurrence", async () => {
    mockedGetMyShiftHistoryPage.mockResolvedValueOnce(
      page([
        shiftFixture(9, { title: "First attendance nine" }),
        shiftFixture(9, { title: "Duplicate attendance nine" }),
        shiftFixture(7)
      ], "cursor-one")
    );
    const renderer = await renderScreen();

    expect(mockedGetMyShiftHistoryPage).toHaveBeenCalledWith("worker-token");
    expect(renderedIds(renderer)).toEqual([9, 7]);
    expect(renderedText(renderer)).toContain("First attendance nine");
    expect(renderedText(renderer)).not.toContain("Duplicate attendance nine");
    expect(new Set(renderedIds(renderer)).size).toBe(renderedIds(renderer).length);
    expect(findButton(renderer, "Load more")).toBeDefined();
  });

  it("appends next and last pages once while dropping internal and overlapping duplicates", async () => {
    const nextPage = deferred<WorkerShiftHistoryPageResponse>();
    mockedGetMyShiftHistoryPage
      .mockResolvedValueOnce(page([shiftFixture(9), shiftFixture(7)], "opaque+/=one"))
      .mockReturnValueOnce(nextPage.promise);
    const renderer = await renderScreen();

    act(() => {
      findButton(renderer, "Load more").props.onPress();
      findButton(renderer, "Load more").props.onPress();
    });
    expect(mockedGetMyShiftHistoryPage).toHaveBeenCalledTimes(2);
    expect(mockedGetMyShiftHistoryPage).toHaveBeenNthCalledWith(
      2,
      "worker-token",
      "opaque+/=one"
    );

    await act(async () => {
      nextPage.resolve(page([
        shiftFixture(5, { title: "First attendance five" }),
        shiftFixture(5, { title: "Duplicate attendance five" }),
        shiftFixture(7)
      ], null));
      await flushPromises();
    });

    expect(renderedIds(renderer)).toEqual([9, 7, 5]);
    expect(renderedText(renderer)).toContain("First attendance five");
    expect(renderedText(renderer)).not.toContain("Duplicate attendance five");
    expect(new Set(renderedIds(renderer)).size).toBe(renderedIds(renderer).length);
    expect(
      renderer.root.findAllByType(Button).some((button) => button.props.label === "Load more")
    ).toBe(false);
  });

  it("uses authoritative cursor state after a fully replayed page", async () => {
    mockedGetMyShiftHistoryPage
      .mockResolvedValueOnce(page([shiftFixture(9), shiftFixture(7)], "cursor-one"))
      .mockResolvedValueOnce(page([
        shiftFixture(9),
        shiftFixture(7),
        shiftFixture(7)
      ], "cursor-two"))
      .mockResolvedValueOnce(page([shiftFixture(5)], null));
    const renderer = await renderScreen();

    await act(async () => {
      findButton(renderer, "Load more").props.onPress();
      await flushPromises();
    });
    expect(renderedIds(renderer)).toEqual([9, 7]);

    await act(async () => {
      findButton(renderer, "Load more").props.onPress();
      await flushPromises();
    });
    expect(mockedGetMyShiftHistoryPage).toHaveBeenNthCalledWith(
      3,
      "worker-token",
      "cursor-two"
    );
    expect(renderedIds(renderer)).toEqual([9, 7, 5]);
  });

  it("preserves rows and retries the exact failed continuation cursor", async () => {
    mockedGetMyShiftHistoryPage
      .mockResolvedValueOnce(page([shiftFixture(9), shiftFixture(8)], "retry-cursor"))
      .mockRejectedValueOnce(new Error("temporary continuation failure"))
      .mockResolvedValueOnce(page([shiftFixture(7)], null));
    const renderer = await renderScreen();

    await act(async () => {
      findButton(renderer, "Load more").props.onPress();
      await flushPromises();
    });
    expect(renderedIds(renderer)).toEqual([9, 8]);
    expect(renderedText(renderer)).toContain("temporary continuation failure");

    await act(async () => {
      findButton(renderer, "Retry load more").props.onPress();
      await flushPromises();
    });
    expect(mockedGetMyShiftHistoryPage).toHaveBeenNthCalledWith(
      2,
      "worker-token",
      "retry-cursor"
    );
    expect(mockedGetMyShiftHistoryPage).toHaveBeenNthCalledWith(
      3,
      "worker-token",
      "retry-cursor"
    );
    expect(renderedIds(renderer)).toEqual([9, 8, 7]);
  });

  it("keeps the prior cursor after refresh failure and blocks continuation while refreshing", async () => {
    const failedRefresh = deferred<WorkerShiftHistoryPageResponse>();
    mockedGetMyShiftHistoryPage
      .mockResolvedValueOnce(page([shiftFixture(9), shiftFixture(8)], "old-cursor"))
      .mockReturnValueOnce(failedRefresh.promise)
      .mockResolvedValueOnce(page([shiftFixture(7)], null));
    const renderer = await renderScreen();

    act(() => {
      findButton(renderer, "Refresh").props.onPress();
      findButton(renderer, "Refresh").props.onPress();
      findButton(renderer, "Load more").props.onPress();
    });
    expect(mockedGetMyShiftHistoryPage).toHaveBeenCalledTimes(2);
    expect(findButton(renderer, "Load more").props.disabled).toBe(true);

    await act(async () => {
      failedRefresh.reject(new Error("refresh network failure"));
      await flushPromises();
    });

    expect(renderedIds(renderer)).toEqual([9, 8]);
    expect(renderedText(renderer)).toContain("refresh network failure");
    expect(findButton(renderer, "Load more").props.disabled).toBe(false);

    await act(async () => {
      findButton(renderer, "Load more").props.onPress();
      await flushPromises();
    });
    expect(mockedGetMyShiftHistoryPage).toHaveBeenNthCalledWith(
      3,
      "worker-token",
      "old-cursor"
    );
    expect(renderedIds(renderer)).toEqual([9, 8, 7]);
  });

  it("preserves an exact failed continuation retry across a failed refresh", async () => {
    mockedGetMyShiftHistoryPage
      .mockResolvedValueOnce(page([shiftFixture(9)], "failed-cursor"))
      .mockRejectedValueOnce(new Error("continuation failed"))
      .mockRejectedValueOnce(new Error("refresh also failed"))
      .mockResolvedValueOnce(page([shiftFixture(8)], null));
    const renderer = await renderScreen();

    await act(async () => {
      findButton(renderer, "Load more").props.onPress();
      await flushPromises();
    });
    expect(findButton(renderer, "Retry load more")).toBeDefined();

    await act(async () => {
      findButton(renderer, "Refresh").props.onPress();
      await flushPromises();
    });
    expect(renderedIds(renderer)).toEqual([9]);
    expect(renderedText(renderer)).toContain("refresh also failed");
    expect(findButton(renderer, "Retry load more")).toBeDefined();

    await act(async () => {
      findButton(renderer, "Retry load more").props.onPress();
      await flushPromises();
    });
    expect(mockedGetMyShiftHistoryPage).toHaveBeenNthCalledWith(
      2,
      "worker-token",
      "failed-cursor"
    );
    expect(mockedGetMyShiftHistoryPage).toHaveBeenNthCalledWith(
      4,
      "worker-token",
      "failed-cursor"
    );
    expect(renderedIds(renderer)).toEqual([9, 8]);
  });

  it("atomically replaces pagination on refresh success and ignores the older continuation", async () => {
    const staleContinuation = deferred<WorkerShiftHistoryPageResponse>();
    mockedGetMyShiftHistoryPage
      .mockResolvedValueOnce(page([shiftFixture(9)], "old-cursor"))
      .mockReturnValueOnce(staleContinuation.promise)
      .mockResolvedValueOnce(page([shiftFixture(12)], "new-cursor"))
      .mockResolvedValueOnce(page([shiftFixture(11)], null));
    const renderer = await renderScreen();

    act(() => {
      findButton(renderer, "Load more").props.onPress();
    });
    await act(async () => {
      findButton(renderer, "Refresh").props.onPress();
      await flushPromises();
    });
    expect(mockedGetMyShiftHistoryPage).toHaveBeenCalledTimes(3);
    expect(renderedIds(renderer)).toEqual([12]);

    await act(async () => {
      staleContinuation.resolve(page([shiftFixture(8)], null));
      await flushPromises();
    });
    expect(renderedIds(renderer)).toEqual([12]);

    await act(async () => {
      findButton(renderer, "Load more").props.onPress();
      await flushPromises();
    });
    expect(mockedGetMyShiftHistoryPage).toHaveBeenNthCalledWith(
      4,
      "worker-token",
      "new-cursor"
    );
    expect(renderedIds(renderer)).toEqual([12, 11]);
  });

  it("ignores a late first page after unmount", async () => {
    const initial = deferred<WorkerShiftHistoryPageResponse>();
    mockedGetMyShiftHistoryPage.mockReturnValueOnce(initial.promise);
    const renderer = await renderScreen();

    act(() => {
      renderer.unmount();
      view = null;
    });
    await act(async () => {
      initial.resolve(page([shiftFixture(1)], null));
      await flushPromises();
    });
    expect(mockedGetMyShiftHistoryPage).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["FOREMAN", { id: 10, name: "Acme Construction" }],
    ["WORKER", null]
  ] as const)(
    "does not request personal history outside WORKER/company context %s/%s",
    async (role, company) => {
      mockedUseAuth.mockReturnValue({
        user: { role, company },
        authenticatedRequest
      } as unknown as ReturnType<typeof useAuth>);
      const renderer = await renderScreen();

      expect(mockedGetMyShiftHistoryPage).not.toHaveBeenCalled();
      expect(renderedText(renderer)).toContain("Worker company required");
    }
  );

  it("keeps shift, attendance, payment, pause, and calculation states separate", async () => {
    mockedGetMyShiftHistoryPage.mockResolvedValueOnce(
      page([
        shiftFixture(1, {
          status: "ACTIVE",
          actualEndTime: null,
          paymentStatus: null,
          payCalculation: undefined,
          calculatedSalary: null,
          workedMinutes: null,
          pauseState: {
            allPaused: true,
            allPauseStartedAt: "2026-07-05T10:00:00Z",
            personallyPaused: true,
            personalPauseStartedAt: "2026-07-05T09:55:00Z",
            effectivePauseMinutes: 5
          }
        }),
        shiftFixture(2)
      ], null)
    );
    const renderer = await renderScreen();

    expect(
      historyCard(renderer, 1).findAllByType(StatusBadge).map((badge) => badge.props.label)
    ).toEqual([
      "Active",
      "Attendance approved",
      "Personal pause active",
      "Crew pause active"
    ]);
    expect(
      historyCard(renderer, 2).findAllByType(StatusBadge).map((badge) => badge.props.label)
    ).toEqual([
      "Closed",
      "Attendance approved",
      "Unpaid",
      "Breakdown available"
    ]);
  });

  it("presents every attendance and payment status only when returned", async () => {
    mockedGetMyShiftHistoryPage.mockResolvedValueOnce(
      page([
        shiftFixture(21, {
          status: "OPEN",
          attendanceStatus: "JOINED",
          paymentStatus: null,
          payCalculation: undefined
        }),
        shiftFixture(22, {
          attendanceStatus: "REJECTED",
          paymentStatus: null,
          payCalculation: undefined
        }),
        shiftFixture(23, {
          status: "CANCELLED",
          attendanceStatus: "CANCELLED",
          paymentStatus: null,
          payCalculation: undefined
        }),
        shiftFixture(24, { paymentStatus: "PAYMENT_REQUESTED" }),
        shiftFixture(25, { paymentStatus: "PAID" }),
        shiftFixture(26, {
          payCalculation: {
            snapshotStatus: "UNAVAILABLE",
            totalRawSeconds: 1,
            totalRawMinutesExact: 1,
            totalBaseAmount: 1,
            totalPremiumAmount: 0,
            totalAmount: 1,
            segments: []
          }
        })
      ], null)
    );
    const renderer = await renderScreen();

    expect(
      historyCard(renderer, 21).findAllByType(StatusBadge).map((badge) => badge.props.label)
    ).toEqual(["Open", "Waiting for approval"]);
    expect(
      historyCard(renderer, 22).findAllByType(StatusBadge).map((badge) => badge.props.label)
    ).toEqual(["Closed", "Attendance rejected"]);
    expect(
      historyCard(renderer, 23).findAllByType(StatusBadge).map((badge) => badge.props.label)
    ).toEqual(["Cancelled", "Attendance cancelled"]);
    expect(
      historyCard(renderer, 24).findAllByType(StatusBadge).map((badge) => badge.props.label)
    ).toContain("Payment requested");
    expect(
      historyCard(renderer, 25).findAllByType(StatusBadge).map((badge) => badge.props.label)
    ).toContain("Paid");
    expect(
      historyCard(renderer, 26).findAllByType(StatusBadge).map((badge) => badge.props.label)
    ).toContain("Breakdown unavailable");
  });

  it("keeps defensive CREATED and returned pay-breakdown internals out of inline details", async () => {
    mockedGetMyShiftHistoryPage.mockResolvedValueOnce(
      page([shiftFixture(30, { status: "CREATED", title: "Defensive history row" })], null)
    );
    const renderer = await renderScreen();

    expect(renderedText(renderer)).not.toContain("CREATED");
    act(() => {
      renderer.root.findByProps({ testID: "worker-shift-expand-30" }).props.onPress();
    });
    const text = renderedText(renderer);
    expect(text).not.toContain("CREATED");
    expect(text).not.toContain("Total base amount");
    expect(text).not.toContain("148.33333333");
    expect(text).not.toContain("segments");
    expect(text).toContain("Breakdown available");
  });

  it("expands returned nullable fields without inventing missing values", async () => {
    mockedGetMyShiftHistoryPage.mockResolvedValueOnce(
      page([
        shiftFixture(3, {
          title: "Nullable history shift",
          location: null,
          currencyLabel: null,
          actualStartTime: null,
          actualEndTime: null,
          payableStartTime: null,
          pauseMinutes: null,
          workedMinutes: null,
          calculatedSalary: null,
          paymentStatus: null,
          payCalculation: undefined,
          pauseState: undefined,
          status: "OPEN",
          attendanceStatus: "JOINED"
        })
      ], null)
    );
    const renderer = await renderScreen();
    const collapsedChevron = renderer.root.findByProps({
      testID: "worker-shift-expand-3"
    });
    const nullableFullView = historyCard(renderer, 3)
      .findAllByType(Button)
      .find((button) => button.props.label === "Full view");
    if (!nullableFullView) throw new Error("Full view button not found");

    expect(collapsedChevron.props.accessibilityLabel).toContain(
      "Expand details"
    );
    expect(collapsedChevron.props.accessibilityLabel).toContain(
      "Nullable history shift"
    );
    expect(collapsedChevron.props.accessibilityLabel).toContain(
      "Acme Construction"
    );
    expect(collapsedChevron.props.accessibilityLabel).toContain("Open");
    expect(collapsedChevron.props.accessibilityLabel).not.toContain("shift 1003");
    expect(collapsedChevron.props.accessibilityLabel).not.toContain("attendance 3");
    expect(nullableFullView.props.accessibilityLabel).toContain("Open");
    expect(nullableFullView.props.accessibilityLabel).not.toContain("shift 1003");
    expect(nullableFullView.props.accessibilityLabel).not.toContain("attendance 3");

    act(() => {
      collapsedChevron.props.onPress();
    });
    expect(
      renderer.root.findByProps({ testID: "worker-shift-expand-3" }).props
        .accessibilityLabel
    ).toContain("Collapse details");
    const text = renderedText(renderer);
    expect(text).toContain("Acme Construction");
    expect(text).toContain("Open");
    expect(text).toContain("Waiting for approval");
    expect(text).toContain("20.00 (currency unavailable)");
    expect(text).toContain("Unavailable");
    expect(text).not.toContain("Location");
    expect(text).not.toContain("Actual start");
    expect(text).not.toContain("Actual end");
    expect(text).not.toContain("Payable start");
    expect(text).not.toContain("Pause time");
    expect(text).not.toContain("Worked time");
    expect(text).not.toContain("Calculated salary");
    expect(text).not.toContain("Night premium");

    act(() => {
      renderer.root.findByProps({ testID: "worker-shift-expand-3" }).props.onPress();
    });
    expect(renderer.root.findAllByProps({ testID: "worker-shift-details-3" })).toHaveLength(0);
  });

  it.each(["CANCELLED", "DISCARDED"] as const)(
    "shows %s as non-payable without stale pay facts",
    async (status) => {
      mockedGetMyShiftHistoryPage.mockResolvedValueOnce(
        page([
          shiftFixture(4, {
            status,
            calculatedSalary: 999,
            paymentStatus: "PAID",
            workedMinutes: 999,
            payCalculation: {
              snapshotStatus: "COMPLETE",
              totalRawSeconds: 1,
              totalRawMinutesExact: 1,
              totalBaseAmount: 999,
              totalPremiumAmount: 999,
              totalAmount: 999,
              segments: []
            }
          })
        ], null)
      );
      const renderer = await renderScreen();

      act(() => {
        renderer.root.findByProps({ testID: "worker-shift-expand-4" }).props.onPress();
      });
      const text = renderedText(renderer);
      expect(text).toContain(status === "CANCELLED" ? "Cancelled" : "Discarded");
      expect(text).toContain("Not payable");
      expect(text).not.toContain("Paid");
      expect(text).not.toContain("Calculated salary");
      expect(text).not.toContain("Worked time");
      expect(text).not.toContain("Breakdown available");
    }
  );

  it("gives duplicate-title cards two contextual actions and navigates only from Full view", async () => {
    const firstShift = shiftFixture(41, {
      shiftId: 2041,
      title: "Shared shift title",
      actualStartTime: "2026-07-05T08:00:00Z"
    });
    const secondShift = shiftFixture(42, {
      shiftId: 2042,
      title: "Shared shift title",
      actualStartTime: "2026-07-06T08:00:00Z"
    });
    mockedGetMyShiftHistoryPage.mockResolvedValueOnce(
      page([firstShift, secondShift], null)
    );
    const renderer = await renderScreen();
    const firstCard = historyCard(renderer, 41);
    const secondCard = historyCard(renderer, 42);
    const firstChevron = firstCard.findByProps({
      testID: "worker-shift-expand-41"
    });
    const secondChevron = secondCard.findByProps({
      testID: "worker-shift-expand-42"
    });
    const firstFullView = firstCard
      .findAllByType(Button)
      .find((button) => button.props.label === "Full view");
    const secondFullView = secondCard
      .findAllByType(Button)
      .find((button) => button.props.label === "Full view");
    if (!firstFullView || !secondFullView) {
      throw new Error("Full view button not found");
    }

    expect(firstChevron.props).toMatchObject({
      accessibilityLabel: expect.stringContaining("Expand details"),
      accessibilityRole: "button",
      accessibilityState: { expanded: false }
    });
    expect(firstChevron.props.accessibilityLabel).toContain(firstShift.title);
    expect(firstChevron.props.accessibilityLabel).toContain(
      formatDateTime(firstShift.actualStartTime!)
    );
    expect(firstChevron.props.accessibilityLabel).toContain("Acme Construction");
    expect(firstChevron.props.accessibilityLabel).toContain("Cologne");
    expect(secondChevron.props.accessibilityLabel).toContain(
      formatDateTime(secondShift.actualStartTime!)
    );
    expect(firstChevron.props.accessibilityLabel).not.toBe(
      secondChevron.props.accessibilityLabel
    );
    expect(firstFullView.props.accessibilityLabel).toContain("Full view");
    expect(firstFullView.props.accessibilityLabel).not.toBe(
      secondFullView.props.accessibilityLabel
    );
    for (const label of [
      firstChevron.props.accessibilityLabel,
      secondChevron.props.accessibilityLabel,
      firstFullView.props.accessibilityLabel,
      secondFullView.props.accessibilityLabel
    ]) {
      expect(label).not.toContain("attendance");
      expect(label).not.toContain("2041");
      expect(label).not.toContain("2042");
      expect(label).not.toMatch(/\b(?:41|42)\b/u);
    }

    for (const [card, attendanceId] of [
      [firstCard, 41],
      [secondCard, 42]
    ] as const) {
      expect(card.findAllByType(Button)).toHaveLength(1);
      expect(
        card.findAll(
          (node) =>
            node.props.testID === `worker-shift-expand-${attendanceId}` &&
            node.props.accessibilityRole === "button" &&
            typeof node.props.onPress === "function"
        )
      ).toHaveLength(1);
      expect(
        card.findAllByType(Ionicons).every(
          (icon) =>
            icon.props.accessible === false &&
            icon.props.accessibilityRole === undefined
        )
      ).toBe(true);
    }

    act(() => {
      firstChevron.props.onPress();
    });
    const expandedChevron = renderer.root.findByProps({
      testID: "worker-shift-expand-41"
    });
    expect(expandedChevron.props).toMatchObject({
      accessibilityLabel: expect.stringContaining("Collapse details"),
      accessibilityRole: "button",
      accessibilityState: { expanded: true }
    });
    expect(navigation.navigate).not.toHaveBeenCalled();

    act(() => {
      void secondFullView.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith("WorkerShiftDetails", {
      shift: expect.objectContaining({ shiftId: 2042, attendanceId: 42 })
    });
    expect(navigation.navigate).toHaveBeenCalledWith("WorkerShiftDetails", {
      shift: secondShift
    });
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
  });

  it("recovers an initial error, exposes the empty join action, and refreshes", async () => {
    mockedGetMyShiftHistoryPage
      .mockRejectedValueOnce(new Error("initial network failure"))
      .mockResolvedValueOnce(page([], null))
      .mockResolvedValueOnce(page([shiftFixture(6)], null));
    const renderer = await renderScreen();
    expect(renderedText(renderer)).toContain("initial network failure");

    await act(async () => {
      findButton(renderer, "Retry").props.onPress();
      await flushPromises();
    });
    expect(renderedText(renderer)).toContain("No shifts joined");

    act(() => {
      findButton(renderer, "Join shift").props.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith("JoinShift");

    await act(async () => {
      renderer.root.findByType(RefreshControl).props.onRefresh();
      await flushPromises();
    });
    expect(renderedIds(renderer)).toEqual([6]);
  });

  it("selects the worker Dashboard tab from the explicit Back to dashboard action", async () => {
    mockedGetMyShiftHistoryPage.mockResolvedValueOnce(page([], null));
    const renderer = await renderScreen();

    act(() => {
      findButton(renderer, "Back to dashboard").props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith("WorkerDashboard");
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
