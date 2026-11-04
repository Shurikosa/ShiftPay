import Ionicons from "@expo/vector-icons/Ionicons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  createNavigationContainerRef,
  NavigationContainer
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { ComponentProps } from "react";
import { RefreshControl, Text, View } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getMyShiftHistoryPage, joinShiftByCode } from "../../api/shifts";
import { FormField } from "../../components/FormField";
import { WorkerShiftHistoryPagesProvider } from "../../context/WorkerShiftHistoryPagesContext";
import { useAuth } from "../../context/AuthContext";
import { JoinShiftScreen } from "../../screens/JoinShiftScreen";
import { MyShiftHistoryScreen } from "../../screens/MyShiftHistoryScreen";
import type { User } from "../../types/auth";
import type {
  WorkerShiftHistoryItem,
  WorkerShiftHistoryPageResponse
} from "../../types/shifts";
import type {
  WorkerStackParamList,
  WorkerTabParamList
} from "../../types/navigation";

jest.mock("@expo/vector-icons/Ionicons", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text: NativeText } = jest.requireActual<typeof import("react-native")>(
    "react-native"
  );
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      React.createElement(NativeText, props as ComponentProps<typeof NativeText>)
  };
});

jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../api/shifts", () => ({
  getMyShiftHistoryPage: jest.fn(),
  joinShiftByCode: jest.fn()
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedGetMyShiftHistoryPage = jest.mocked(getMyShiftHistoryPage);
const mockedJoinShiftByCode = jest.mocked(joinShiftByCode);
const Stack = createNativeStackNavigator<WorkerStackParamList>();
const Tabs = createBottomTabNavigator<WorkerTabParamList>();

const worker: User = {
  company: {
    currencyLabel: "EUR",
    id: 10,
    name: "Acme Construction",
    timeZone: "Europe/Berlin"
  },
  email: "worker@example.com",
  firstName: "Wendy",
  id: 1,
  lastName: "Worker",
  role: "WORKER"
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function shiftFixture(
  attendanceId: number,
  title: string
): WorkerShiftHistoryItem {
  return {
    shiftId: attendanceId + 1000,
    attendanceId,
    companyId: 10,
    companyName: "Acme Construction",
    currencyLabel: "EUR",
    title,
    location: "Cologne",
    status: "OPEN",
    actualStartTime: null,
    actualEndTime: null,
    attendanceStatus: "JOINED",
    paymentStatus: null,
    hourlyRate: 20,
    breakMinutes: 0,
    workedMinutes: null,
    calculatedSalary: null
  };
}

function page(items: WorkerShiftHistoryItem[]): WorkerShiftHistoryPageResponse {
  return { items, hasMore: false, nextCursor: null };
}

function DashboardStub() {
  return <View testID="worker-dashboard-stub" />;
}

function PayrollStub() {
  return <View testID="worker-payroll-stub" />;
}

function MoreStub() {
  return <View testID="worker-more-stub" />;
}

function DetailStub() {
  return <View testID="worker-detail-stub" />;
}

function SettingsStub() {
  return <View testID="worker-settings-stub" />;
}

function WorkerTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }}>
      <Tabs.Screen component={DashboardStub} name="WorkerDashboard" />
      <Tabs.Screen component={MyShiftHistoryScreen} name="MyShiftHistory" />
      <Tabs.Screen component={PayrollStub} name="WorkerPayroll" />
      <Tabs.Screen component={MoreStub} name="More" />
    </Tabs.Navigator>
  );
}

function TestNavigator({
  navigationRef
}: {
  navigationRef: ReturnType<
    typeof createNavigationContainerRef<WorkerStackParamList>
  >;
}) {
  return (
    <NavigationContainer ref={navigationRef}>
      <WorkerShiftHistoryPagesProvider>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen component={WorkerTabs} name="WorkerTabs" />
          <Stack.Screen component={JoinShiftScreen} name="JoinShift" />
          <Stack.Screen component={DetailStub} name="WorkerShiftDetails" />
          <Stack.Screen component={SettingsStub} name="OwnSettings" />
        </Stack.Navigator>
      </WorkerShiftHistoryPagesProvider>
    </NavigationContainer>
  );
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 25));
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

describe("Join Shift paged-history integration", () => {
  let view: ReactTestRenderer | null = null;

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    expect(Ionicons).toBeDefined();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      authenticatedRequest: (request: (token: string) => Promise<unknown>) =>
        request("worker-token"),
      status: "authenticated",
      user: worker
    } as unknown as ReturnType<typeof useAuth>);
    mockedJoinShiftByCode.mockResolvedValue({
      attendanceId: 22,
      currencyLabel: "EUR",
      hourlyRate: 20,
      shiftId: 1022,
      status: "JOINED",
      workerId: worker.id
    });
  });

  afterEach(() => {
    if (view) {
      act(() => view?.unmount());
      view = null;
    }
  });

  it("refreshes the already-mounted canonical Shifts state before returning to the shell", async () => {
    const oldShift = shiftFixture(11, "Previously loaded shift");
    const newShift = shiftFixture(22, "Newly joined shift");
    const staleShift = shiftFixture(33, "Stale pre-join refresh");
    const preJoinRefresh = deferred<WorkerShiftHistoryPageResponse>();
    const postJoinRefresh = deferred<WorkerShiftHistoryPageResponse>();
    mockedGetMyShiftHistoryPage
      .mockResolvedValueOnce(page([oldShift]))
      .mockReturnValueOnce(preJoinRefresh.promise)
      .mockReturnValueOnce(postJoinRefresh.promise);
    const navigationRef = createNavigationContainerRef<WorkerStackParamList>();

    await act(async () => {
      view = create(<TestNavigator navigationRef={navigationRef} />);
      await settle();
    });
    await act(async () => {
      navigationRef.navigate("WorkerTabs", { screen: "MyShiftHistory" });
      await settle();
    });
    expect(navigationRef.getCurrentRoute()?.name).toBe("MyShiftHistory");
    expect(renderedText(view!)).toContain("Previously loaded shift");

    act(() => {
      view!.root.findByType(RefreshControl).props.onRefresh();
    });
    expect(mockedGetMyShiftHistoryPage).toHaveBeenCalledTimes(2);

    await act(async () => {
      navigationRef.navigate("WorkerTabs", { screen: "WorkerDashboard" });
      navigationRef.navigate("JoinShift");
      await settle();
    });
    const stateChanged = jest.fn();
    const unsubscribe = navigationRef.addListener("state", stateChanged);
    act(() => {
      view!.root.findByType(FormField).props.onChangeText("join22");
    });
    await act(async () => {
      view!.root
        .findAll((node) => node.props.testID === "join-shift-submit")
        .find((node) => typeof node.props.onPress === "function")!
        .props.onPress();
      await settle();
    });

    expect(mockedJoinShiftByCode).toHaveBeenCalledWith("worker-token", {
      joinCode: "JOIN22"
    });
    expect(mockedGetMyShiftHistoryPage).toHaveBeenCalledTimes(3);
    expect(mockedGetMyShiftHistoryPage).toHaveBeenNthCalledWith(3, "worker-token");
    expect(mockedGetMyShiftHistoryPage.mock.invocationCallOrder[2]).toBeLessThan(
      stateChanged.mock.invocationCallOrder[0]!
    );
    expect(navigationRef.getRootState()!.routes.map((route) => route.name)).toEqual([
      "WorkerTabs"
    ]);
    expect(navigationRef.getCurrentRoute()?.name).toBe("WorkerDashboard");

    await act(async () => {
      postJoinRefresh.resolve(page([newShift, oldShift]));
      await settle();
      navigationRef.navigate("WorkerTabs", { screen: "MyShiftHistory" });
      await settle();
    });
    unsubscribe();

    expect(navigationRef.getCurrentRoute()?.name).toBe("MyShiftHistory");
    expect(renderedText(view!)).toContain("Newly joined shift");
    expect(renderedText(view!)).toContain("Previously loaded shift");
    expect(mockedGetMyShiftHistoryPage).toHaveBeenCalledTimes(3);

    await act(async () => {
      preJoinRefresh.resolve(page([staleShift, oldShift]));
      await settle();
    });
    expect(renderedText(view!)).toContain("Newly joined shift");
    expect(renderedText(view!)).not.toContain("Stale pre-join refresh");
  });
});
