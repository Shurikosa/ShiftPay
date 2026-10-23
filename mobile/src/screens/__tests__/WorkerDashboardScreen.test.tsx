import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  type ViewStyle
} from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { ActionTile } from "../../components/ActionTile";
import { Button } from "../../components/Button";
import { Screen } from "../../components/Screen";
import { StatusBadge } from "../../components/StatusBadge";
import { WorkerShiftHistoryCard } from "../../components/WorkerShiftHistoryCard";
import { useAuth } from "../../context/AuthContext";
import { useWorkerDashboardShifts } from "../../hooks/useWorkerDashboardShifts";
import type { User } from "../../types/auth";
import type { WorkerShiftHistoryItem } from "../../types/shifts";
import { theme } from "../../utils/theme";
import { WorkerDashboardScreen } from "../WorkerDashboardScreen";

jest.mock("@expo/vector-icons/Ionicons", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text: NativeText } = jest.requireActual<typeof import("react-native")>(
    "react-native"
  );
  const MockIonicons = (props: Record<string, unknown>) =>
    React.createElement(NativeText, props as ComponentProps<typeof NativeText>);
  return { __esModule: true, default: MockIonicons };
});

jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../hooks/useWorkerDashboardShifts", () => ({
  useWorkerDashboardShifts: jest.fn()
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedUseWorkerDashboardShifts = jest.mocked(useWorkerDashboardShifts);

const defaultUser: User = {
  id: 7,
  email: "worker@example.com",
  firstName: "Avery",
  lastName: "Builder",
  role: "WORKER",
  company: {
    id: 10,
    name: "Acme Construction",
    joinCode: "PRIVATE-CODE",
    currencyLabel: "EUR",
    timeZone: "Europe/Berlin"
  }
};

function shiftFixture(
  attendanceId = 501,
  overrides: Partial<WorkerShiftHistoryItem> = {}
): WorkerShiftHistoryItem {
  return {
    shiftId: attendanceId + 1000,
    attendanceId,
    companyId: 10,
    companyName: "Acme Construction",
    currencyLabel: "EUR",
    title: `Backend shift ${attendanceId}`,
    location: `Location ${attendanceId}`,
    status: "CLOSED",
    actualStartTime: "2026-07-05T22:00:00Z",
    actualEndTime: "2026-07-05T23:00:00Z",
    attendanceStatus: "APPROVED",
    paymentStatus: "UNPAID",
    hourlyRate: 20,
    breakMinutes: 0,
    pauseMinutes: 0,
    workedMinutes: 60,
    calculatedSalary: 20,
    pauseState: {
      allPaused: false,
      allPauseStartedAt: null,
      personallyPaused: false,
      personalPauseStartedAt: null,
      effectivePauseMinutes: 0
    },
    ...overrides
  };
}

type DashboardValue = ReturnType<typeof useWorkerDashboardShifts>;

const renderedViews: ReactTestRenderer[] = [];

async function renderDashboard({
  dashboard,
  user = defaultUser
}: {
  dashboard?: Partial<DashboardValue>;
  user?: User | null;
} = {}) {
  const signOut = jest.fn().mockResolvedValue(undefined);
  const refresh = jest.fn().mockResolvedValue(undefined);
  let focusListener: (() => void) | undefined;
  const navigation = {
    addListener: jest.fn((event: string, listener: () => void) => {
      if (event === "focus") focusListener = listener;
      return jest.fn();
    }),
    navigate: jest.fn()
  };
  mockedUseAuth.mockReturnValue({
    signOut,
    user
  } as unknown as ReturnType<typeof useAuth>);
  mockedUseWorkerDashboardShifts.mockReturnValue({
    shifts: [shiftFixture()],
    initialLoading: false,
    refreshing: false,
    initialError: null,
    refreshError: null,
    refresh,
    ...dashboard
  } as DashboardValue);

  let view!: ReactTestRenderer;
  await act(async () => {
    view = create(
      <WorkerDashboardScreen
        {...({
          navigation,
          route: { key: "worker-dashboard", name: "WorkerDashboard" }
        } as unknown as ComponentProps<typeof WorkerDashboardScreen>)}
      />
    );
  });
  renderedViews.push(view);
  return {
    focus: () => focusListener?.(),
    navigation,
    refresh,
    signOut,
    view
  };
}

function buttonByTestID(view: ReactTestRenderer, testID: string) {
  return view.root.find(
    (node) =>
      node.props.testID === testID &&
      node.props.accessibilityRole === "button" &&
      typeof node.props.style === "function"
  );
}

function buttonByLabel(view: ReactTestRenderer, label: string) {
  const button = view.root
    .findAllByType(Button)
    .find((candidate) => candidate.props.label === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function renderedCards(view: ReactTestRenderer) {
  return view.root.findAllByType(WorkerShiftHistoryCard);
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

describe("WorkerDashboardScreen", () => {
  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    for (const view of renderedViews.splice(0)) {
      act(() => view.unmount());
    }
  });

  it("shows returned worker identity, company, and separate Settings without timezone", async () => {
    const longUser = {
      ...defaultUser,
      firstName: "Avery-With-A-Very-Long-Returned-First-Name",
      lastName: "Builder-With-A-Very-Long-Returned-Last-Name",
      company: {
        ...defaultUser.company!,
        name: "A very long returned company name that wraps on narrow screens"
      }
    };
    const { navigation, view } = await renderDashboard({ user: longUser });
    const output = renderedText(view);
    const fullName = `${longUser.firstName} ${longUser.lastName}`;

    expect(view.root.findByProps({ children: "ShiftPay" }).type).toBe(Text);
    expect(view.root.findByProps({ children: "Worker" }).type).toBe(Text);
    expect(view.root.findByProps({ children: fullName }).props).toMatchObject({
      accessibilityRole: "header",
      allowFontScaling: true
    });
    expect(output).toContain(longUser.company.name);
    expect(output).not.toContain("PRIVATE-CODE");
    expect(output).not.toContain("Europe/Berlin");

    act(() => {
      buttonByTestID(view, "worker-settings").props.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith("OwnSettings");
  });

  it("renders one ordered row of three near-square tiles with a green Join shift tile", async () => {
    const { navigation, view } = await renderDashboard();
    const group = view.root.findByProps({ testID: "worker-dashboard-actions" });
    const tiles = group.findAllByType(ActionTile);

    expect(tiles.map((tile) => tile.props.label)).toEqual([
      "Join shift",
      "My shift history",
      "Payroll"
    ]);
    expect(tiles[0]?.props.tone).toBe("primary");
    expect(StyleSheet.flatten(group.props.style)).toMatchObject({
      alignItems: "stretch",
      flexDirection: "row"
    });

    const join = buttonByTestID(view, "worker-join-shift");
    const history = buttonByTestID(view, "worker-history-tile");
    const payroll = buttonByTestID(view, "worker-payroll-tile");
    expect(join.props.accessibilityLabel).toBe("Join shift");
    expect(history.props.accessibilityLabel).toBe("My shift history");
    expect(payroll.props.accessibilityLabel).toBe("Payroll");
    for (const action of [join, history, payroll]) {
      expect(action.props.accessibilityRole).toBe("button");
      const style = StyleSheet.flatten(action.props.style({ pressed: false })) as ViewStyle;
      expect(style).toMatchObject({ flex: 1, minHeight: 104, minWidth: 0 });
    }

    const joinSurfaceNode = join.find(
      (node) =>
        Array.isArray(node.props.style) &&
        StyleSheet.flatten(node.props.style)?.backgroundColor ===
          theme.colors.brand.primary
    );
    const joinSurface = StyleSheet.flatten(joinSurfaceNode.props.style) as ViewStyle;
    expect(joinSurface).toMatchObject({
      backgroundColor: theme.colors.brand.primary,
      borderColor: theme.colors.brand.primary
    });

    act(() => {
      join.props.onPress();
      history.props.onPress();
      payroll.props.onPress();
    });
    expect(navigation.navigate.mock.calls).toEqual([
      ["JoinShift"],
      ["MyShiftHistory"],
      ["WorkerPayroll"]
    ]);
  });

  it("keeps backend order, shows at most five cards, and always exposes View all", async () => {
    const shifts = [9, 7, 6, 4, 3, 2].map((attendanceId) =>
      shiftFixture(attendanceId)
    );
    const { navigation, view } = await renderDashboard({ dashboard: { shifts } });
    const cards = renderedCards(view);
    const renderedAttendanceIds = cards.map(
      (card) => card.props.shift.attendanceId as number
    );

    expect(cards.map((card) => card.props.shift)).toEqual(shifts.slice(0, 5));
    expect(renderedAttendanceIds).toEqual([9, 7, 6, 4, 3]);
    expect(new Set(renderedAttendanceIds).size).toBe(renderedAttendanceIds.length);
    for (const attendanceId of renderedAttendanceIds) {
      expect(
        view.root.findByProps({
          testID: `worker-shift-history-card-${attendanceId}`
        })
      ).toBeDefined();
    }
    act(() => {
      buttonByTestID(view, "worker-view-all").props.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith("MyShiftHistory");
  });

  it("expands returned fields without navigating and Full view sends the exact object", async () => {
    const shift = shiftFixture(508, {
      status: "ACTIVE",
      attendanceStatus: "JOINED",
      paymentStatus: "PAYMENT_REQUESTED",
      pauseState: {
        allPaused: true,
        allPauseStartedAt: "2026-07-05T22:30:00Z",
        personallyPaused: true,
        personalPauseStartedAt: "2026-07-05T22:35:00Z",
        effectivePauseMinutes: 5
      }
    });
    const { navigation, view } = await renderDashboard({ dashboard: { shifts: [shift] } });
    const chevron = buttonByTestID(view, `worker-shift-expand-${shift.attendanceId}`);

    expect(chevron.props.accessibilityState).toEqual({ expanded: false });
    act(() => {
      chevron.props.onPress();
    });
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(
      buttonByTestID(view, `worker-shift-expand-${shift.attendanceId}`).props
        .accessibilityState
    ).toEqual({ expanded: true });
    const badges = view.root.findAllByType(StatusBadge).map((badge) => badge.props.label);
    expect(badges).toEqual(
      expect.arrayContaining([
        "Active",
        "Waiting for approval",
        "Payment requested",
        "Personal pause active",
        "Crew pause active"
      ])
    );

    act(() => {
      buttonByLabel(view, "Full view").props.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith("WorkerShiftDetails", { shift });
  });

  it("omits nullable returned details instead of inventing dashboard values", async () => {
    const shift = shiftFixture(509, {
      location: null,
      actualStartTime: null,
      actualEndTime: null,
      paymentStatus: null,
      pauseMinutes: null,
      workedMinutes: null,
      calculatedSalary: null,
      pauseState: undefined
    });
    const { view } = await renderDashboard({ dashboard: { shifts: [shift] } });

    act(() => {
      buttonByTestID(
        view,
        `worker-shift-expand-${shift.attendanceId}`
      ).props.onPress();
    });
    const output = renderedText(view);
    expect(output).not.toContain("Location 509");
    expect(output).not.toContain("Actual start");
    expect(output).not.toContain("Actual end");
    expect(output).not.toContain("Payment status");
    expect(output).not.toContain("Worked time");
    expect(output).not.toContain("Calculated salary");
    expect(output).not.toContain("Personal pause");
  });

  it("shows initial loading, initial error retry, and empty recovery states", async () => {
    const loading = await renderDashboard({
      dashboard: { initialLoading: true, shifts: [] }
    });
    expect(loading.view.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(loading.view.root.findByProps({ testID: "worker-shifts-loading" })).toBeDefined();

    const initialError = await renderDashboard({
      dashboard: { initialError: "Backend unavailable.", shifts: [] }
    });
    await act(async () => {
      buttonByTestID(initialError.view, "worker-shifts-retry").props.onPress();
      await Promise.resolve();
    });
    expect(initialError.refresh).toHaveBeenCalledTimes(1);
    expect(renderedText(initialError.view)).toContain("Backend unavailable.");

    const empty = await renderDashboard({ dashboard: { shifts: [] } });
    act(() => {
      buttonByTestID(empty.view, "worker-empty-join-shift").props.onPress();
    });
    expect(empty.navigation.navigate).toHaveBeenCalledWith("JoinShift");
  });

  it("supports pull-to-refresh and retains cards with a retry after refresh failure", async () => {
    const shift = shiftFixture(510);
    const { refresh, view } = await renderDashboard({
      dashboard: {
        shifts: [shift],
        refreshError: "Refresh timed out."
      }
    });
    const refreshControl = view.root.findByType(RefreshControl);

    await act(async () => {
      refreshControl.props.onRefresh();
      buttonByTestID(view, "worker-shifts-refresh-retry").props.onPress();
      await Promise.resolve();
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(renderedCards(view).map((card) => card.props.shift)).toEqual([shift]);
    expect(view.root.findByProps({ testID: "worker-shifts-refresh-error" })).toBeDefined();
  });

  it("refreshes the dashboard when it regains focus after a nested flow", async () => {
    const { focus, refresh } = await renderDashboard();

    await act(async () => {
      focus();
      await Promise.resolve();
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("fails closed for companyless and wrong-role contexts without hiding Settings", async () => {
    for (const user of [
      { ...defaultUser, company: null },
      { ...defaultUser, role: "FOREMAN" as const }
    ]) {
      const { navigation, view } = await renderDashboard({
        dashboard: { shifts: [] },
        user
      });
      expect(mockedUseWorkerDashboardShifts).toHaveBeenLastCalledWith(false);
      expect(view.root.findByProps({ testID: "worker-company-required" })).toBeDefined();
      expect(buttonByTestID(view, "worker-settings")).toBeDefined();
      expect(view.root.findAllByProps({ testID: "worker-view-all" })).toHaveLength(0);

      for (const testID of [
        "worker-join-shift",
        "worker-history-tile",
        "worker-payroll-tile",
        "worker-empty-join-shift"
      ]) {
        const action = buttonByTestID(view, testID);
        expect(action.props.accessibilityState.disabled).toBe(true);
        expect(action.props.onPress).toBeUndefined();
      }
      expect(navigation.navigate).not.toHaveBeenCalled();
    }
  });

  it("delegates logout and exposes a retryable logout failure", async () => {
    const { signOut, view } = await renderDashboard();
    signOut
      .mockRejectedValueOnce(new Error("marker write failed"))
      .mockResolvedValueOnce(undefined);

    await act(async () => {
      buttonByTestID(view, "worker-logout").props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(view.root.findByProps({ testID: "worker-logout-error" })).toBeDefined();
    expect(renderedText(view)).toContain("Your session is still active");

    await act(async () => {
      buttonByTestID(view, "worker-logout").props.onPress();
      await Promise.resolve();
    });
    expect(signOut).toHaveBeenCalledTimes(2);
  });

  it("keeps scrolling, wrapping, canonical tokens, and decorative tile icons", async () => {
    const { view } = await renderDashboard();
    expect(view.root.findByType(Screen).props.scroll).toBe(true);
    expect(view.root.findByType(ScrollView).props).toMatchObject({
      horizontal: false,
      keyboardShouldPersistTaps: "handled",
      scrollEnabled: true,
      testID: "worker-dashboard-scroll"
    });

    for (const copy of ["ShiftPay", "Avery Builder", "Current and recent shifts"]) {
      const node = view.root.findByProps({ children: copy });
      const style = StyleSheet.flatten(node.props.style) as TextStyle;
      expect(node.props.allowFontScaling).toBe(true);
      expect(node.props.numberOfLines).toBeUndefined();
      expect(style.height).toBeUndefined();
      expect(style.maxHeight).toBeUndefined();
      expect(style.overflow).not.toBe("hidden");
    }

    const tileIcons = view.root
      .findByProps({ testID: "worker-dashboard-actions" })
      .findAllByType(Ionicons);
    expect(tileIcons.map((icon) => icon.props.name)).toEqual([
      "enter-outline",
      "calendar-outline",
      "wallet-outline"
    ]);
    expect(tileIcons.every((icon) => icon.props.accessible === false)).toBe(true);
  });
});
