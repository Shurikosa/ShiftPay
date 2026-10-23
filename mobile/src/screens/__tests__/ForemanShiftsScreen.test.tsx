import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { RefreshControl, Text } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getManagedShiftsPage } from "../../api/shifts";
import { Button } from "../../components/Button";
import { ManagedShiftHistoryCard } from "../../components/ManagedShiftHistoryCard";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import type { ManagedShift, ManagedShiftPageResponse } from "../../types/shifts";
import { ForemanShiftsScreen } from "../ForemanShiftsScreen";

jest.mock("@expo/vector-icons/Ionicons", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  const MockIonicons = (props: Record<string, unknown>) =>
    React.createElement(Text, props as ComponentProps<typeof Text>);
  return { __esModule: true, default: MockIonicons };
});

jest.mock("../../api/shifts", () => ({
  getManagedShiftsPage: jest.fn()
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: jest.fn()
}));

const mockedGetManagedShiftsPage = jest.mocked(getManagedShiftsPage);
const mockedUseAuth = jest.mocked(useAuth);
const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const props = {
  navigation,
  route: { key: "foreman-shifts", name: "ForemanShifts" }
} as unknown as ComponentProps<typeof ForemanShiftsScreen>;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function shiftFixture(
  id: number,
  overrides: Partial<ManagedShift> = {}
): ManagedShift {
  return {
    id,
    companyId: 10,
    companyName: "Acme Construction",
    currencyLabel: "EUR",
    title: `Managed shift ${id}`,
    location: "Cologne",
    status: "OPEN",
    joinCode: `CODE${id}`,
    actualStartTime: null,
    actualEndTime: null,
    defaultBreakMinutes: 15,
    defaultHourlyRate: 20,
    foremanHourlyRate: 30,
    pauseState: {
      allPaused: false,
      allPauseStartedAt: null,
      personallyPaused: false,
      personalPauseStartedAt: null,
      effectivePauseMinutes: 0
    },
    createdBy: 5,
    ...overrides
  };
}

function page(
  items: ManagedShift[],
  nextCursor: string | null
): ManagedShiftPageResponse {
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
    .findAllByType(ManagedShiftHistoryCard)
    .map((card) => card.props.shift.id as number);
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

describe("ForemanShiftsScreen", () => {
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
    mockedGetManagedShiftsPage.mockReset();
    authenticatedRequest = jest.fn(
      (request: (token: string) => Promise<unknown>) => request("foreman-token")
    );
    mockedUseAuth.mockReturnValue({
      user: {
        id: 5,
        email: "foreman@example.com",
        firstName: "Frank",
        lastName: "Foreman",
        role: "FOREMAN",
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
      view = create(<ForemanShiftsScreen {...props} />);
    });
    await act(async () => {
      await flushPromises();
    });
    return view!;
  }

  it("keeps the first occurrence of duplicate IDs on the initial page", async () => {
    mockedGetManagedShiftsPage.mockResolvedValueOnce(
      page([
        shiftFixture(9, { title: "First shift nine" }),
        shiftFixture(9, { title: "Duplicate shift nine" }),
        shiftFixture(7)
      ], null)
    );
    const renderer = await renderScreen();

    expect(renderedIds(renderer)).toEqual([9, 7]);
    expect(renderedText(renderer)).toContain("First shift nine");
    expect(renderedText(renderer)).not.toContain("Duplicate shift nine");
    expect(new Set(renderedIds(renderer)).size).toBe(renderedIds(renderer).length);
  });

  it("deduplicates a refreshed first page without changing backend order", async () => {
    mockedGetManagedShiftsPage
      .mockResolvedValueOnce(page([shiftFixture(9)], null))
      .mockResolvedValueOnce(page([
        shiftFixture(12, { title: "First refreshed twelve" }),
        shiftFixture(12, { title: "Duplicate refreshed twelve" }),
        shiftFixture(11)
      ], null));
    const renderer = await renderScreen();

    await act(async () => {
      findButton(renderer, "Refresh").props.onPress();
      await flushPromises();
    });

    expect(renderedIds(renderer)).toEqual([12, 11]);
    expect(renderedText(renderer)).toContain("First refreshed twelve");
    expect(renderedText(renderer)).not.toContain("Duplicate refreshed twelve");
    expect(new Set(renderedIds(renderer)).size).toBe(renderedIds(renderer).length);
  });

  it("keeps backend order across opaque pages and blocks duplicate taps/appends", async () => {
    const nextPage = deferred<ManagedShiftPageResponse>();
    mockedGetManagedShiftsPage
      .mockResolvedValueOnce(page([shiftFixture(9), shiftFixture(7)], "opaque+/=one"))
      .mockReturnValueOnce(nextPage.promise);
    const renderer = await renderScreen();

    expect(renderedIds(renderer)).toEqual([9, 7]);
    expect(mockedGetManagedShiftsPage).toHaveBeenNthCalledWith(
      1,
      "foreman-token"
    );

    act(() => {
      findButton(renderer, "Load more").props.onPress();
      findButton(renderer, "Load more").props.onPress();
    });
    expect(mockedGetManagedShiftsPage).toHaveBeenCalledTimes(2);
    expect(mockedGetManagedShiftsPage).toHaveBeenNthCalledWith(
      2,
      "foreman-token",
      "opaque+/=one"
    );

    await act(async () => {
      nextPage.resolve(page([
        shiftFixture(5, { title: "First shift five" }),
        shiftFixture(5, { title: "Duplicate shift five" }),
        shiftFixture(7)
      ], null));
      await flushPromises();
    });

    expect(renderedIds(renderer)).toEqual([9, 7, 5]);
    expect(renderedIds(renderer).filter((id) => id === 7)).toHaveLength(1);
    expect(renderedIds(renderer).filter((id) => id === 5)).toHaveLength(1);
    expect(renderedText(renderer)).toContain("First shift five");
    expect(renderedText(renderer)).not.toContain("Duplicate shift five");
    expect(new Set(renderedIds(renderer)).size).toBe(renderedIds(renderer).length);
    expect(
      renderer.root.findAllByType(Button).some((button) => button.props.label === "Load more")
    ).toBe(false);
  });

  it("advances the opaque cursor after a fully replayed page", async () => {
    mockedGetManagedShiftsPage
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
    expect(findButton(renderer, "Load more")).toBeDefined();

    await act(async () => {
      findButton(renderer, "Load more").props.onPress();
      await flushPromises();
    });
    expect(mockedGetManagedShiftsPage).toHaveBeenNthCalledWith(
      3,
      "foreman-token",
      "cursor-two"
    );
    expect(renderedIds(renderer)).toEqual([9, 7, 5]);
  });

  it("preserves loaded rows and retries the exact failed continuation", async () => {
    mockedGetManagedShiftsPage
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
    expect(mockedGetManagedShiftsPage).toHaveBeenNthCalledWith(
      2,
      "foreman-token",
      "retry-cursor"
    );
    expect(mockedGetManagedShiftsPage).toHaveBeenNthCalledWith(
      3,
      "foreman-token",
      "retry-cursor"
    );
    expect(renderedIds(renderer)).toEqual([9, 8, 7]);
  });

  it("invalidates an older page when refresh starts and publishes only refreshed rows", async () => {
    const staleContinuation = deferred<ManagedShiftPageResponse>();
    const refreshResult = deferred<ManagedShiftPageResponse>();
    mockedGetManagedShiftsPage
      .mockResolvedValueOnce(page([shiftFixture(9)], "old-cursor"))
      .mockReturnValueOnce(staleContinuation.promise)
      .mockReturnValueOnce(refreshResult.promise);
    const renderer = await renderScreen();

    act(() => {
      findButton(renderer, "Load more").props.onPress();
    });
    act(() => {
      findButton(renderer, "Refresh").props.onPress();
    });
    expect(mockedGetManagedShiftsPage).toHaveBeenCalledTimes(3);

    await act(async () => {
      staleContinuation.resolve(page([shiftFixture(8)], null));
      await flushPromises();
    });
    expect(renderedIds(renderer)).toEqual([9]);

    await act(async () => {
      refreshResult.resolve(page([shiftFixture(12), shiftFixture(11)], null));
      await flushPromises();
    });
    expect(renderedIds(renderer)).toEqual([12, 11]);
  });

  it("ignores a late initial response after unmount", async () => {
    const initial = deferred<ManagedShiftPageResponse>();
    mockedGetManagedShiftsPage.mockReturnValueOnce(initial.promise);
    const renderer = await renderScreen();

    act(() => {
      renderer.unmount();
      view = null;
    });
    await act(async () => {
      initial.resolve(page([shiftFixture(1)], null));
      await flushPromises();
    });
    expect(mockedGetManagedShiftsPage).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["WORKER", { id: 10, name: "Acme Construction" }],
    ["FOREMAN", null]
  ] as const)(
    "does not request managed history for role/company context %s/%s",
    async (role, company) => {
      mockedUseAuth.mockReturnValue({
        user: { role, company },
        authenticatedRequest
      } as unknown as ReturnType<typeof useAuth>);
      const renderer = await renderScreen();

      expect(mockedGetManagedShiftsPage).not.toHaveBeenCalled();
      expect(renderedText(renderer)).toContain("Foreman company required");
    }
  );

  it("shows every canonical status and expands only returned nullable details", async () => {
    const statuses = ["OPEN", "ACTIVE", "CLOSED", "CANCELLED", "DISCARDED"] as const;
    mockedGetManagedShiftsPage.mockResolvedValueOnce(
      page(
        statuses.map((status, index) =>
          shiftFixture(index + 1, {
            status,
            ...(index === 0
              ? {
                  location: null,
                  currencyLabel: null,
                  actualStartTime: null,
                  actualEndTime: null,
                  foremanHourlyRate: undefined,
                  pauseState: undefined
                }
              : {})
          })
        ),
        null
      )
    );
    const renderer = await renderScreen();

    expect(renderer.root.findAllByType(StatusBadge).map((badge) => badge.props.label)).toEqual([
      "Open",
      "Active",
      "Closed",
      "Cancelled",
      "Discarded"
    ]);

    act(() => {
      renderer.root.findByProps({ testID: "managed-shift-expand-1" }).props.onPress();
    });
    renderer.root.findByProps({ testID: "managed-shift-details-1" });
    const text = renderedText(renderer);
    expect(text).toContain("Acme Construction");
    expect(text).toContain("CODE1");
    expect(text).toContain("currency unavailable");
    expect(text).not.toContain("Location");
    expect(text).not.toContain("Actual start");
    expect(text).not.toContain("Actual end");
    expect(text).not.toContain("Foreman rate");
    expect(text).not.toContain("Salary");
    expect(text).not.toContain("Total");

    act(() => {
      renderer.root.findByProps({ testID: "managed-shift-expand-1" }).props.onPress();
    });
    expect(renderer.root.findAllByProps({ testID: "managed-shift-details-1" })).toHaveLength(0);
  });

  it("does not present defensive CREATED as a product status when collapsed or expanded", async () => {
    mockedGetManagedShiftsPage.mockResolvedValueOnce(
      page([shiftFixture(99, { status: "CREATED", title: "Defensive shift" })], null)
    );
    const renderer = await renderScreen();

    expect(renderer.root.findAllByType(StatusBadge)).toHaveLength(0);
    expect(renderedText(renderer)).not.toContain("CREATED");
    expect(renderedText(renderer)).not.toContain("Status");

    act(() => {
      renderer.root.findByProps({ testID: "managed-shift-expand-99" }).props.onPress();
    });

    expect(renderer.root.findAllByType(StatusBadge)).toHaveLength(0);
    expect(renderedText(renderer)).not.toContain("CREATED");
    expect(renderedText(renderer)).not.toContain("Status");
    expect(renderedText(renderer)).toContain("Defensive shift");
    expect(renderedText(renderer)).toContain("CODE99");
  });

  it("keeps Full view separate and opens the existing foreman detail route", async () => {
    const shift = shiftFixture(42);
    mockedGetManagedShiftsPage.mockResolvedValueOnce(page([shift], null));
    const renderer = await renderScreen();
    const card = renderer.root
      .findAllByType(ManagedShiftHistoryCard)
      .find((candidate) => candidate.props.shift.id === 42);
    if (!card) throw new Error("Managed shift card not found");
    const fullView = card.findAllByType(Button).find((button) => button.props.label === "Full view");
    if (!fullView) throw new Error("Full view button not found");

    act(() => {
      void fullView.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith("ForemanShiftDetails", {
      shiftId: 42,
      initialShift: shift
    });
    expect(renderer.root.findAllByProps({ testID: "managed-shift-details-42" })).toHaveLength(0);
  });

  it("recovers an initial error, renders empty, and supports pull-to-refresh", async () => {
    mockedGetManagedShiftsPage
      .mockRejectedValueOnce(new Error("initial network failure"))
      .mockResolvedValueOnce(page([], null))
      .mockResolvedValueOnce(page([shiftFixture(3)], null));
    const renderer = await renderScreen();
    expect(renderedText(renderer)).toContain("initial network failure");

    await act(async () => {
      findButton(renderer, "Retry").props.onPress();
      await flushPromises();
    });
    expect(renderedText(renderer)).toContain("No managed shifts");

    await act(async () => {
      renderer.root.findByType(RefreshControl).props.onRefresh();
      await flushPromises();
    });
    expect(renderedIds(renderer)).toEqual([3]);
  });

  it("selects the foreman Dashboard tab from the explicit Back to dashboard action", async () => {
    mockedGetManagedShiftsPage.mockResolvedValueOnce(page([], null));
    const renderer = await renderScreen();

    act(() => {
      findButton(renderer, "Back to dashboard").props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith("ForemanDashboard");
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
