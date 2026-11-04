import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  type ViewStyle
} from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { ActionTile } from "../../components/ActionTile";
import { Button } from "../../components/Button";
import { ManagedShiftHistoryCard } from "../../components/ManagedShiftHistoryCard";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useForemanDashboardShifts } from "../../hooks/useForemanDashboardShifts";
import type { User } from "../../types/auth";
import type { ManagedShift } from "../../types/shifts";
import { theme } from "../../utils/theme";
import { ForemanDashboardScreen } from "../ForemanDashboardScreen";

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
jest.mock("../../hooks/useForemanDashboardShifts", () => ({
  useForemanDashboardShifts: jest.fn()
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedUseForemanDashboardShifts = jest.mocked(useForemanDashboardShifts);

const defaultUser: User = {
  id: 5,
  email: "foreman@example.com",
  firstName: "Frank",
  lastName: "Foreman",
  role: "FOREMAN",
  company: {
    id: 10,
    name: "Acme Construction",
    joinCode: "ACME42",
    currencyLabel: "EUR",
    timeZone: "Europe/Berlin"
  }
};

function shiftFixture(
  id = 100,
  overrides: Partial<ManagedShift> = {}
): ManagedShift {
  return {
    id,
    companyId: 10,
    companyName: "Acme Construction",
    currencyLabel: "EUR",
    title: `Backend shift ${id}`,
    location: `Location ${id}`,
    status: "CLOSED",
    joinCode: `CODE${id}`,
    actualStartTime: "2026-07-05T08:00:00Z",
    actualEndTime: "2026-07-05T16:00:00Z",
    defaultBreakMinutes: 30,
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

type DashboardValue = ReturnType<typeof useForemanDashboardShifts>;

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
  mockedUseForemanDashboardShifts.mockReturnValue({
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
      <ForemanDashboardScreen
        {...({
          navigation,
          route: { key: "foreman-dashboard", name: "ForemanDashboard" }
        } as unknown as ComponentProps<typeof ForemanDashboardScreen>)}
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
  return view.root.findAllByType(ManagedShiftHistoryCard);
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

describe("ForemanDashboardScreen", () => {
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

  it("shows returned identity, role, company and join code with separate Settings", async () => {
    const longUser: User = {
      ...defaultUser,
      firstName: "Francis-With-A-Very-Long-Returned-First-Name",
      lastName: "Foreman-With-A-Very-Long-Returned-Last-Name",
      company: {
        ...defaultUser.company!,
        name: "A very long returned company name that wraps on narrow screens",
        joinCode: "RETURNED-CODE"
      }
    };
    const { navigation, view } = await renderDashboard({ user: longUser });
    const output = renderedText(view);
    const fullName = `${longUser.firstName} ${longUser.lastName}`;

    expect(view.root.findByType(ScrollView).props).toMatchObject({
      horizontal: false,
      scrollEnabled: true,
      testID: "foreman-dashboard-scroll"
    });
    expect(view.root.findByProps({ children: "ShiftPay" }).type).toBe(Text);
    expect(view.root.findByProps({ children: "Foreman" }).type).toBe(Text);
    expect(view.root.findByProps({ children: fullName }).props).toMatchObject({
      accessibilityRole: "header",
      allowFontScaling: true
    });
    expect(output).toContain(longUser.company!.name);
    expect(output).toContain("RETURNED-CODE");
    expect(output).not.toContain("Europe/Berlin");
    expect(output).not.toContain("Company settings");
    expect(output).not.toContain("Pay rules");

    act(() => {
      void buttonByTestID(view, "foreman-settings").props.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith("OwnSettings");
  });

  it("renders one ordered row of three near-square tiles with green Create shift", async () => {
    const { navigation, view } = await renderDashboard();
    const group = view.root.findByProps({ testID: "foreman-dashboard-actions" });
    const tiles = group.findAllByType(ActionTile);

    expect(tiles.map((tile) => tile.props.label)).toEqual([
      "Create shift",
      "My shift history",
      "Payroll"
    ]);
    expect(tiles[0]?.props.tone).toBe("primary");
    expect(StyleSheet.flatten(group.props.style)).toMatchObject({
      alignItems: "stretch",
      flexDirection: "row"
    });

    const createShift = buttonByTestID(view, "foreman-create-shift");
    const history = buttonByTestID(view, "foreman-history-tile");
    const payroll = buttonByTestID(view, "foreman-payroll-tile");
    for (const action of [createShift, history, payroll]) {
      expect(action.props.accessibilityRole).toBe("button");
      const style = StyleSheet.flatten(
        action.props.style({ pressed: false })
      ) as ViewStyle;
      expect(style).toMatchObject({ flex: 1, minHeight: 104, minWidth: 0 });
    }

    const primarySurfaceNode = createShift.find(
      (node) =>
        Array.isArray(node.props.style) &&
        StyleSheet.flatten(node.props.style)?.backgroundColor ===
          theme.colors.brand.primary
    );
    expect(StyleSheet.flatten(primarySurfaceNode.props.style)).toMatchObject({
      backgroundColor: theme.colors.brand.primary,
      borderColor: theme.colors.brand.primary
    });

    act(() => {
      createShift.props.onPress();
      history.props.onPress();
      payroll.props.onPress();
    });
    expect(navigation.navigate.mock.calls).toEqual([
      ["CreateShift"],
      ["ForemanShifts"],
      ["ForemanPayrollRequests"]
    ]);
  });

  it("keeps backend order, shows at most five cards, and View all opens the existing Shifts tab", async () => {
    const shifts = [9, 7, 6, 4, 3, 2].map((id) => shiftFixture(id));
    const { navigation, view } = await renderDashboard({ dashboard: { shifts } });
    const cards = renderedCards(view);

    expect(cards.map((card) => card.props.shift)).toEqual(shifts.slice(0, 5));
    expect(cards.map((card) => card.props.shift.id)).toEqual([9, 7, 6, 4, 3]);
    act(() => {
      void buttonByTestID(view, "foreman-view-all").props.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith("ForemanShifts");
  });

  it("expands returned fields without navigating and Full view sends exact detail params", async () => {
    const shift = shiftFixture(508, {
      status: "ACTIVE",
      pauseState: {
        allPaused: true,
        allPauseStartedAt: "2026-07-05T10:30:00Z",
        personallyPaused: true,
        personalPauseStartedAt: "2026-07-05T10:35:00Z",
        effectivePauseMinutes: 5
      }
    });
    const { navigation, view } = await renderDashboard({ dashboard: { shifts: [shift] } });
    const chevron = buttonByTestID(view, `managed-shift-expand-${shift.id}`);

    expect(chevron.props.accessibilityState).toEqual({ expanded: false });
    act(() => {
      void chevron.props.onPress();
    });
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(
      buttonByTestID(view, `managed-shift-expand-${shift.id}`).props
        .accessibilityState
    ).toEqual({ expanded: true });
    const output = renderedText(view);
    expect(output).toContain(shift.companyName);
    expect(output).toContain(shift.location!);
    expect(output).toContain(shift.joinCode);
    expect(output).toContain("Personal pause");
    expect(output).toContain("Crew pause");

    act(() => {
      void buttonByLabel(view, "Full view").props.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith("ForemanShiftDetails", {
      shiftId: shift.id,
      initialShift: shift
    });
  });

  it.each([
    ["OPEN", "Open"],
    ["ACTIVE", "Active"],
    ["CLOSED", "Closed"],
    ["CANCELLED", "Cancelled"],
    ["DISCARDED", "Discarded"]
  ] as const)("renders canonical %s status copy", async (status, label) => {
    const { view } = await renderDashboard({
      dashboard: { shifts: [shiftFixture(600, { status })] }
    });
    expect(view.root.findAllByType(StatusBadge).map((badge) => badge.props.label)).toContain(label);
  });

  it("never advertises defensive CREATED as a returned product status", async () => {
    const { view } = await renderDashboard({
      dashboard: { shifts: [shiftFixture(601, { status: "CREATED" })] }
    });
    expect(renderedText(view)).not.toContain("CREATED");
    expect(renderedText(view)).not.toContain("Created");
    expect(view.root.findAllByType(StatusBadge)).toHaveLength(0);
  });

  it("omits nullable details and missing join code instead of inventing values", async () => {
    const shift = shiftFixture(509, {
      location: null,
      actualStartTime: null,
      actualEndTime: null,
      foremanHourlyRate: undefined,
      pauseState: undefined
    });
    const user = {
      ...defaultUser,
      company: { ...defaultUser.company!, joinCode: undefined }
    };
    const { view } = await renderDashboard({ dashboard: { shifts: [shift] }, user });

    act(() => {
      void buttonByTestID(
        view,
        `managed-shift-expand-${shift.id}`
      ).props.onPress();
    });
    const output = renderedText(view);
    expect(output).not.toContain("Worker join code");
    expect(output).not.toContain("Location 509");
    expect(output).not.toContain("Actual start");
    expect(output).not.toContain("Actual end");
    expect(output).not.toContain("Foreman rate");
    expect(output).not.toContain("Personal pause");
    expect(output).not.toContain("Crew pause");
  });

  it("shows initial loading, initial error retry, and empty recovery", async () => {
    const loading = await renderDashboard({
      dashboard: { initialLoading: true, shifts: [] }
    });
    expect(loading.view.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(loading.view.root.findByProps({ testID: "foreman-shifts-loading" })).toBeDefined();

    const initialError = await renderDashboard({
      dashboard: { initialError: "Backend unavailable.", shifts: [] }
    });
    await act(async () => {
      buttonByTestID(initialError.view, "foreman-shifts-retry").props.onPress();
      await Promise.resolve();
    });
    expect(initialError.refresh).toHaveBeenCalledTimes(1);
    expect(renderedText(initialError.view)).toContain("Backend unavailable.");

    const empty = await renderDashboard({ dashboard: { shifts: [] } });
    act(() => {
      void buttonByTestID(
        empty.view,
        "foreman-empty-create-shift"
      ).props.onPress();
    });
    expect(empty.navigation.navigate).toHaveBeenCalledWith("CreateShift");
  });

  it("supports pull-to-refresh and retains cards with retry after refresh failure", async () => {
    const shift = shiftFixture(510);
    const { refresh, view } = await renderDashboard({
      dashboard: { shifts: [shift], refreshError: "Refresh timed out." }
    });
    const refreshControl = view.root.findByType(RefreshControl);

    await act(async () => {
      refreshControl.props.onRefresh();
      buttonByTestID(view, "foreman-shifts-refresh-retry").props.onPress();
      await Promise.resolve();
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(renderedCards(view).map((card) => card.props.shift)).toEqual([shift]);
    expect(view.root.findByProps({ testID: "foreman-shifts-refresh-error" })).toBeDefined();
  });

  it("refreshes after returning from a nested flow", async () => {
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
      { ...defaultUser, role: "WORKER" as const }
    ]) {
      const { navigation, view } = await renderDashboard({
        dashboard: { shifts: [] },
        user
      });
      expect(mockedUseForemanDashboardShifts).toHaveBeenLastCalledWith(false);
      expect(view.root.findByProps({ testID: "foreman-company-required" })).toBeDefined();
      expect(buttonByTestID(view, "foreman-settings")).toBeDefined();
      expect(view.root.findAllByProps({ testID: "foreman-view-all" })).toHaveLength(0);

      for (const testID of [
        "foreman-create-shift",
        "foreman-history-tile",
        "foreman-payroll-tile",
        "foreman-empty-create-shift"
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
      buttonByTestID(view, "foreman-logout").props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(view.root.findByProps({ testID: "foreman-logout-error" })).toBeDefined();
    expect(renderedText(view)).toContain("Your session is still active");

    await act(async () => {
      buttonByTestID(view, "foreman-logout").props.onPress();
      await Promise.resolve();
    });
    expect(signOut).toHaveBeenCalledTimes(2);
  });

  it("keeps dashboard icons decorative and text scalable", async () => {
    const { view } = await renderDashboard();
    const icons = view.root.findAllByType(Ionicons);
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.props).toMatchObject({
        accessibilityElementsHidden: true,
        accessible: false,
        "aria-hidden": true,
        importantForAccessibility: "no-hide-descendants"
      });
    }
    const fixedOrClippedText = view.root.findAllByType(Text).filter((node) => {
      const style = StyleSheet.flatten(node.props.style) as ViewStyle | undefined;
      return style?.height !== undefined ||
        style?.maxHeight !== undefined ||
        style?.overflow === "hidden";
    });
    expect(fixedOrClippedText).toHaveLength(0);
  });
});
