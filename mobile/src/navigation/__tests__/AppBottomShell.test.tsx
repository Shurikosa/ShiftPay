import Ionicons from "@expo/vector-icons/Ionicons";
import {
  CommonActions,
  createNavigationContainerRef,
  type InitialState,
  type ParamListBase
} from "@react-navigation/native";
import type React from "react";
import type { ComponentProps } from "react";
import { View } from "react-native";
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer
} from "react-test-renderer";
import {
  getManagedPayoutRequests,
  getMyPayoutRequests,
  getPayableAttendances
} from "../../api/payroll";
import { joinShiftByCode } from "../../api/shifts";
import { Button } from "../../components/Button";
import { FormField } from "../../components/FormField";
import { useAuth } from "../../context/AuthContext";
import { useForemanManagedShiftPages } from "../../hooks/useForemanManagedShiftPages";
import { useWorkerShiftHistory } from "../../hooks/useWorkerShiftHistory";
import { useWorkerShiftHistoryPages } from "../../hooks/useWorkerShiftHistoryPages";
import { theme } from "../../utils/theme";
import { AppNavigator } from "../AppNavigator";

jest.mock("@expo/vector-icons/Ionicons", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  const MockIonicons = (props: Record<string, unknown>) =>
    React.createElement(Text, props as ComponentProps<typeof Text>);
  return { __esModule: true, default: MockIonicons };
});
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../context/WorkerShiftHistoryContext", () => ({
  WorkerShiftHistoryProvider: ({ children }: { children: React.ReactNode }) => children
}));
jest.mock("../../context/ForemanManagedShiftsContext", () => ({
  ForemanManagedShiftsProvider: ({ children }: { children: React.ReactNode }) =>
    children
}));
jest.mock("../../hooks/useWorkerShiftHistory", () => ({
  useWorkerShiftHistory: jest.fn()
}));
jest.mock("../../hooks/useWorkerShiftHistoryPages", () => ({
  useWorkerShiftHistoryPages: jest.fn()
}));
jest.mock("../../hooks/useForemanManagedShiftPages", () => ({
  useForemanManagedShiftPages: jest.fn()
}));
jest.mock("../../api/shifts", () => ({ joinShiftByCode: jest.fn() }));
jest.mock("../../api/payroll", () => ({
  approveManagedPayoutRequest: jest.fn(),
  createPayoutRequest: jest.fn(),
  getManagedPayoutRequests: jest.fn(),
  getMyPayoutRequests: jest.fn(),
  getPayableAttendances: jest.fn(),
  previewPayoutRequest: jest.fn()
}));

function mockSimpleScreen(testID: string) {
  return function SimpleScreen() {
    return <View testID={testID} />;
  };
}

jest.mock("../../screens/WorkerDashboardScreen", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Pressable, View: NativeView } = jest.requireActual<
    typeof import("react-native")
  >("react-native");
  return {
    WorkerDashboardScreen: ({
      navigation
    }: {
      navigation: { navigate: (name: string) => void };
    }) =>
      React.createElement(
        NativeView,
        { testID: "worker-dashboard-stub" },
        React.createElement(Pressable, {
          accessibilityLabel: "Settings",
          accessibilityRole: "button",
          onPress: () => navigation.navigate("OwnSettings"),
          testID: "worker-open-settings"
        })
      )
  };
});
jest.mock("../../screens/ForemanDashboardScreen", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View: NativeView } = jest.requireActual<typeof import("react-native")>(
    "react-native"
  );
  return {
    ForemanDashboardScreen: () =>
      React.createElement(NativeView, { testID: "foreman-dashboard-stub" })
  };
});
jest.mock("../../screens/WorkerShiftDetailsScreen", () => ({
  WorkerShiftDetailsScreen: mockSimpleScreen("worker-detail-stub")
}));
jest.mock("../../screens/ForemanShiftDetailsScreen", () => ({
  ForemanShiftDetailsScreen: mockSimpleScreen("foreman-detail-stub")
}));
jest.mock("../../screens/OwnSettingsScreen", () => ({
  OwnSettingsScreen: mockSimpleScreen("settings-stub")
}));
jest.mock("../../screens/LoginScreen", () => ({
  LoginScreen: mockSimpleScreen("login-stub")
}));
jest.mock("../../screens/RegisterScreen", () => ({
  RegisterScreen: mockSimpleScreen("register-stub")
}));
jest.mock("../../screens/RestoreSessionScreen", () => ({
  RestoreSessionScreen: mockSimpleScreen("restore-stub")
}));
jest.mock("../../screens/UnsupportedRoleScreen", () => ({
  UnsupportedRoleScreen: mockSimpleScreen("unsupported-stub")
}));
jest.mock("../../screens/JoinCompanyScreen", () => ({
  JoinCompanyScreen: mockSimpleScreen("join-company-stub")
}));
jest.mock("../../screens/CreateCompanyScreen", () => ({
  CreateCompanyScreen: mockSimpleScreen("create-company-stub")
}));
jest.mock("../../screens/CreateShiftScreen", () => ({
  CreateShiftScreen: mockSimpleScreen("create-shift-stub")
}));
jest.mock("../../screens/ForemanCompanySettingsScreen", () => ({
  ForemanCompanySettingsScreen: mockSimpleScreen("company-settings-stub")
}));
jest.mock("../../screens/ForemanPayRulesScreen", () => ({
  ForemanPayRulesScreen: mockSimpleScreen("pay-rules-stub")
}));
jest.mock("../../screens/ShiftSummaryScreen", () => ({
  ShiftSummaryScreen: mockSimpleScreen("shift-summary-stub")
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedJoinShiftByCode = jest.mocked(joinShiftByCode);
const mockedGetManagedPayoutRequests = jest.mocked(getManagedPayoutRequests);
const mockedGetMyPayoutRequests = jest.mocked(getMyPayoutRequests);
const mockedGetPayableAttendances = jest.mocked(getPayableAttendances);
const mockedUseForemanPages = jest.mocked(useForemanManagedShiftPages);
const mockedUseWorkerHistory = jest.mocked(useWorkerShiftHistory);
const mockedUseWorkerPages = jest.mocked(useWorkerShiftHistoryPages);
const authenticatedRequest = jest.fn(
  (request: (token: string) => Promise<unknown>) => request("test-token")
);
const refreshHistory = jest.fn();
let mountedView: ReactTestRenderer | null = null;

const emptyPages = {
  continuationError: null,
  continuationLoading: false,
  hasMore: false,
  initialError: null,
  initialLoading: false,
  loadMore: jest.fn().mockResolvedValue(undefined),
  nextCursor: null,
  refresh: jest.fn().mockResolvedValue(undefined),
  refreshError: null,
  refreshing: false,
  retryContinuation: jest.fn().mockResolvedValue(undefined),
  shifts: []
};

function authState(
  role: "WORKER" | "FOREMAN" | "ADMIN",
  id: number,
  company: { id: number; name: string } | null = { id: 10, name: "Acme" }
) {
  return {
    authenticatedRequest,
    status: "authenticated",
    user: { company, id, role }
  } as unknown as ReturnType<typeof useAuth>;
}

async function settleNavigation() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 50));
}

async function renderApp(initialState?: InitialState) {
  const navigationRef = createNavigationContainerRef<ParamListBase>();
  let view!: ReactTestRenderer;
  await act(async () => {
    view = create(
      <AppNavigator initialState={initialState} navigationRef={navigationRef} />
    );
    await settleNavigation();
  });
  mountedView = view;
  return { navigationRef, view };
}

async function updateApp(
  view: ReactTestRenderer,
  navigationRef: ReturnType<typeof createNavigationContainerRef<ParamListBase>>
) {
  await act(async () => {
    view.update(<AppNavigator navigationRef={navigationRef} />);
    await settleNavigation();
  });
}

async function unmountApp(view: ReactTestRenderer) {
  await act(async () => {
    view.unmount();
    await settleNavigation();
  });
  if (mountedView === view) {
    mountedView = null;
  }
}

async function dispatchNavigate(
  navigationRef: ReturnType<typeof createNavigationContainerRef<ParamListBase>>,
  name: string,
  params?: object
) {
  await act(async () => {
    navigationRef.dispatch(CommonActions.navigate(name, params));
    await settleNavigation();
  });
}

async function goBack(
  navigationRef: ReturnType<typeof createNavigationContainerRef<ParamListBase>>
) {
  await act(async () => {
    navigationRef.goBack();
    await settleNavigation();
  });
}

async function press(node: ReactTestInstance) {
  await act(async () => {
    (node.props.onPress as () => void)();
    await settleNavigation();
  });
}

function findButton(view: ReactTestRenderer, label: string) {
  const button = view.root
    .findAllByType(Button)
    .find((candidate) => candidate.props.label === label);
  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }
  return button;
}

function findButtonByTestID(view: ReactTestRenderer, testID: string) {
  const button = view.root
    .findAllByType(Button)
    .find((candidate) => candidate.props.testID === testID);
  if (!button) {
    throw new Error(`Button not found: ${testID}`);
  }
  return button;
}

function shellRoute(
  navigationRef: ReturnType<typeof createNavigationContainerRef<ParamListBase>>,
  name: "WorkerTabs" | "ForemanTabs"
) {
  const route = rootState(navigationRef).routes.find(
    (candidate) => candidate.name === name
  );
  if (!route?.state) {
    throw new Error(`${name} state not found`);
  }
  return route;
}

function rootState(
  navigationRef: ReturnType<typeof createNavigationContainerRef<ParamListBase>>
) {
  const state = navigationRef.getRootState();
  if (!state) {
    throw new Error("Root navigation state not found");
  }
  return state;
}

function rootRouteNames(
  navigationRef: ReturnType<typeof createNavigationContainerRef<ParamListBase>>
) {
  return rootState(navigationRef).routes.map((route) => route.name);
}

function shellTabNames(
  navigationRef: ReturnType<typeof createNavigationContainerRef<ParamListBase>>,
  name: "WorkerTabs" | "ForemanTabs"
) {
  return shellRoute(navigationRef, name).state!.routes.map((route) => route.name);
}

function accessibleTab(view: ReactTestRenderer, testID: string) {
  const tab = view.root.findAllByProps({ testID }).find(
    (candidate) =>
      candidate.props.accessibilityLabel !== undefined &&
      candidate.props.accessibilityState?.selected !== undefined
  );
  if (!tab) {
    throw new Error(`Accessible tab not found: ${testID}`);
  }
  return tab;
}

describe("AppNavigator real shared bottom shell", () => {
  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authenticatedRequest.mockImplementation(
      (request: (token: string) => Promise<unknown>) => request("test-token")
    );
    refreshHistory.mockResolvedValue(undefined);
    mockedUseWorkerHistory.mockReturnValue({
      error: null,
      loading: false,
      refresh: refreshHistory,
      shifts: []
    });
    mockedUseWorkerPages.mockReturnValue(emptyPages);
    mockedUseForemanPages.mockReturnValue(emptyPages);
    mockedGetPayableAttendances.mockResolvedValue([]);
    mockedGetMyPayoutRequests.mockResolvedValue([]);
    mockedGetManagedPayoutRequests.mockResolvedValue([]);
    mockedJoinShiftByCode.mockResolvedValue({
      attendanceId: 73,
      currencyLabel: "EUR",
      hourlyRate: 24,
      shiftId: 501,
      status: "JOINED",
      workerId: 1
    });
  });

  afterEach(async () => {
    if (mountedView) {
      await unmountApp(mountedView);
    }
  });

  it("uses real worker tabs, tab-history Back, explicit Dashboard selection, and detail pop", async () => {
    mockedUseAuth.mockReturnValue(authState("WORKER", 1));
    const { navigationRef, view } = await renderApp();

    expect(shellTabNames(navigationRef, "WorkerTabs")).toEqual([
      "WorkerDashboard",
      "MyShiftHistory",
      "WorkerPayroll",
      "More"
    ]);
    expect(accessibleTab(view, "worker-tab-dashboard").props).toMatchObject({
      accessibilityLabel: "Dashboard tab",
      accessibilityState: expect.objectContaining({ selected: true })
    });
    const icons = view.root.findAllByType(Ionicons);
    expect(
      icons.some(
        (icon) =>
          icon.props.name === "grid-outline" &&
          icon.props.color === theme.colors.brand.primary
      )
    ).toBe(true);
    expect(icons.every((icon) => icon.props.accessible === false)).toBe(true);

    await dispatchNavigate(navigationRef, "WorkerTabs", { screen: "WorkerPayroll" });
    await dispatchNavigate(navigationRef, "WorkerTabs", { screen: "MyShiftHistory" });
    expect(navigationRef.getCurrentRoute()?.name).toBe("MyShiftHistory");

    await goBack(navigationRef);
    expect(navigationRef.getCurrentRoute()?.name).toBe("WorkerPayroll");
    await press(findButtonByTestID(view, "worker-payroll-back-dashboard"));
    expect(navigationRef.getCurrentRoute()?.name).toBe("WorkerDashboard");

    await dispatchNavigate(navigationRef, "WorkerTabs", { screen: "WorkerPayroll" });
    await dispatchNavigate(navigationRef, "WorkerTabs", { screen: "MyShiftHistory" });
    await press(findButtonByTestID(view, "worker-shifts-back-dashboard"));
    expect(navigationRef.getCurrentRoute()?.name).toBe("WorkerDashboard");

    await dispatchNavigate(navigationRef, "WorkerTabs", { screen: "MyShiftHistory" });
    await dispatchNavigate(navigationRef, "WorkerShiftDetails", {
      shift: { attendanceId: 41, shiftId: 2041 }
    });
    expect(navigationRef.getCurrentRoute()?.name).toBe("WorkerShiftDetails");
    expect(
      view.root.findAllByProps({ testID: "worker-detail-stub" }).length
    ).toBeGreaterThan(0);
    await goBack(navigationRef);
    expect(navigationRef.getCurrentRoute()?.name).toBe("MyShiftHistory");
  });

  it("uses real foreman tabs and explicit Back to dashboard ignores non-Dashboard history", async () => {
    mockedUseAuth.mockReturnValue(authState("FOREMAN", 2));
    const { navigationRef, view } = await renderApp();

    expect(shellTabNames(navigationRef, "ForemanTabs")).toEqual([
      "ForemanDashboard",
      "ForemanShifts",
      "ForemanPayrollRequests",
      "More"
    ]);
    await dispatchNavigate(navigationRef, "ForemanTabs", {
      screen: "ForemanPayrollRequests"
    });
    await dispatchNavigate(navigationRef, "ForemanTabs", { screen: "ForemanShifts" });
    await goBack(navigationRef);
    expect(navigationRef.getCurrentRoute()?.name).toBe("ForemanPayrollRequests");
    await press(findButtonByTestID(view, "foreman-payroll-back-dashboard"));
    expect(navigationRef.getCurrentRoute()?.name).toBe("ForemanDashboard");

    await dispatchNavigate(navigationRef, "ForemanTabs", {
      screen: "ForemanPayrollRequests"
    });
    await dispatchNavigate(navigationRef, "ForemanTabs", { screen: "ForemanShifts" });
    await press(findButtonByTestID(view, "foreman-shifts-back-dashboard"));
    expect(navigationRef.getCurrentRoute()?.name).toBe("ForemanDashboard");
  });

  it.each([
    [
      "WORKER" as const,
      "WorkerTabs",
      ["WorkerDashboard", "MyShiftHistory", "WorkerPayroll", "More"],
      "WorkerPayroll",
      "worker-payroll-back-dashboard",
      "WorkerDashboard"
    ],
    [
      "FOREMAN" as const,
      "ForemanTabs",
      ["ForemanDashboard", "ForemanShifts", "ForemanPayrollRequests", "More"],
      "ForemanPayrollRequests",
      "foreman-payroll-back-dashboard",
      "ForemanDashboard"
    ]
  ])(
    "selects %s Dashboard from a directly restored Payroll tab without history",
    async (role, shellName, routeNames, payrollName, buttonTestID, dashboardName) => {
      mockedUseAuth.mockReturnValue(authState(role, role === "WORKER" ? 1 : 2));
      const { navigationRef, view } = await renderApp({
        routes: [
          {
            name: shellName,
            state: {
              index: 2,
              routes: routeNames.map((name) => ({ name }))
            }
          }
        ]
      });
      expect(navigationRef.getCurrentRoute()?.name).toBe(payrollName);

      await press(findButtonByTestID(view, buttonTestID));

      expect(navigationRef.getCurrentRoute()?.name).toBe(dashboardName);
    }
  );

  it("pops JoinShift success to one existing shell and cannot reveal an older shell", async () => {
    mockedUseAuth.mockReturnValue(authState("WORKER", 1));
    const { navigationRef, view } = await renderApp();
    await dispatchNavigate(navigationRef, "JoinShift");
    expect(rootRouteNames(navigationRef)).toEqual([
      "WorkerTabs",
      "JoinShift"
    ]);

    act(() => {
      view.root.findByType(FormField).props.onChangeText("join12");
    });
    await press(findButton(view, "Join shift"));

    expect(refreshHistory).toHaveBeenCalledTimes(1);
    expect(rootRouteNames(navigationRef)).toEqual([
      "WorkerTabs"
    ]);
    expect(navigationRef.getCurrentRoute()?.name).toBe("WorkerDashboard");
    expect(navigationRef.canGoBack()).toBe(false);
  });

  it("uses popTo fallback to create exactly one shell when restored directly at JoinShift", async () => {
    mockedUseAuth.mockReturnValue(authState("WORKER", 1));
    const { navigationRef, view } = await renderApp({
      routes: [{ name: "JoinShift" }]
    });
    expect(navigationRef.getCurrentRoute()?.name).toBe("JoinShift");

    act(() => {
      view.root.findByType(FormField).props.onChangeText("join34");
    });
    await press(findButton(view, "Join shift"));

    expect(rootRouteNames(navigationRef)).toEqual([
      "WorkerTabs"
    ]);
    expect(navigationRef.getCurrentRoute()?.name).toBe("WorkerDashboard");
  });

  it("restores a selected tab and resets it after account, role, restore, and logout transitions", async () => {
    mockedUseAuth.mockReturnValue(authState("WORKER", 1));
    const first = await renderApp();
    await dispatchNavigate(first.navigationRef, "WorkerTabs", {
      screen: "MyShiftHistory"
    });
    const restoredState = first.navigationRef.getRootState() as InitialState;
    await unmountApp(first.view);

    const restoredRef = createNavigationContainerRef<ParamListBase>();
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <AppNavigator initialState={restoredState} navigationRef={restoredRef} />
      );
      await settleNavigation();
    });
    mountedView = view;
    expect(restoredRef.getCurrentRoute()?.name).toBe("MyShiftHistory");
    await press(findButtonByTestID(view, "worker-shifts-back-dashboard"));
    expect(restoredRef.getCurrentRoute()?.name).toBe("WorkerDashboard");
    await dispatchNavigate(restoredRef, "WorkerTabs", { screen: "MyShiftHistory" });

    mockedUseAuth.mockReturnValue(authState("WORKER", 9, { id: 11, name: "Other" }));
    await updateApp(view, restoredRef);
    expect(restoredRef.getCurrentRoute()?.name).toBe("WorkerDashboard");

    mockedUseAuth.mockReturnValue({
      status: "restoring",
      user: null
    } as ReturnType<typeof useAuth>);
    await updateApp(view, restoredRef);
    expect(
      view.root.findAllByProps({ testID: "restore-stub" }).length
    ).toBeGreaterThan(0);

    mockedUseAuth.mockReturnValue(authState("FOREMAN", 12));
    await updateApp(view, restoredRef);
    expect(restoredRef.getCurrentRoute()?.name).toBe("ForemanDashboard");

    mockedUseAuth.mockReturnValue({
      status: "unauthenticated",
      user: null
    } as ReturnType<typeof useAuth>);
    await updateApp(view, restoredRef);
    expect(restoredRef.getCurrentRoute()?.name).toBe("Login");
    expect(
      view.root.findAll((node) => String(node.props.testID ?? "").includes("-tab-"))
    ).toHaveLength(0);
  });

  it.each([
    [authState("WORKER", 1, null), "join-company-stub"],
    [authState("FOREMAN", 2, null), "create-company-stub"],
    [authState("ADMIN", 3, null), "unsupported-stub"]
  ])("does not mount a shell outside joined role flows", async (state, gateTestID) => {
    mockedUseAuth.mockReturnValue(state);
    const { view } = await renderApp();

    expect(view.root.findAllByProps({ testID: gateTestID }).length).toBeGreaterThan(0);
    expect(
      view.root.findAll((node) => String(node.props.testID ?? "").includes("-tab-"))
    ).toHaveLength(0);
  });
});
