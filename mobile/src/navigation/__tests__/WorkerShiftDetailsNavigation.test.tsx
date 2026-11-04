import Ionicons from "@expo/vector-icons/Ionicons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  createNavigationContainerRef,
  NavigationContainer
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { ComponentProps } from "react";
import { Text, View } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import {
  endMyPause,
  getMyShiftHistory,
  getMyShiftHistoryPage,
  startMyPause
} from "../../api/shifts";
import { WorkerShiftHistoryPagesProvider } from "../../context/WorkerShiftHistoryPagesContext";
import { WorkerShiftHistoryProvider } from "../../context/WorkerShiftHistoryContext";
import { useAuth } from "../../context/AuthContext";
import { MyShiftHistoryScreen } from "../../screens/MyShiftHistoryScreen";
import { WorkerShiftDetailsScreen } from "../../screens/WorkerShiftDetailsScreen";
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
  endMyPause: jest.fn(),
  getMyShiftHistory: jest.fn(),
  getMyShiftHistoryPage: jest.fn(),
  startMyPause: jest.fn()
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedGetMyShiftHistory = jest.mocked(getMyShiftHistory);
const mockedGetMyShiftHistoryPage = jest.mocked(getMyShiftHistoryPage);
const mockedStartMyPause = jest.mocked(startMyPause);
const mockedEndMyPause = jest.mocked(endMyPause);
const Stack = createNativeStackNavigator<WorkerStackParamList>();
const Tabs = createBottomTabNavigator<WorkerTabParamList>();

const worker: User = {
  company: {
    currencyLabel: "EUR",
    id: 5,
    name: "QA Berlin Company",
    timeZone: "Europe/Berlin"
  },
  email: "worker@example.com",
  firstName: "QA",
  id: 9,
  lastName: "Worker",
  role: "WORKER"
};

function activeShift(
  overrides: Partial<WorkerShiftHistoryItem> = {}
): WorkerShiftHistoryItem {
  return {
    shiftId: 16,
    attendanceId: 12,
    companyId: 5,
    companyName: "QA Berlin Company",
    currencyLabel: "EUR",
    title: "QA Site 16 current page item",
    location: "Berlin",
    status: "ACTIVE",
    actualStartTime: "2026-10-27T19:11:00Z",
    actualEndTime: null,
    attendanceStatus: "APPROVED",
    paymentStatus: "UNPAID",
    hourlyRate: 20,
    breakMinutes: 0,
    payableStartTime: "2026-10-27T19:11:00Z",
    pauseMinutes: null,
    workedMinutes: null,
    calculatedSalary: null,
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

function staleLegacyShift(): WorkerShiftHistoryItem {
  return activeShift({
    title: "QA Site 16 stale legacy item",
    status: "OPEN",
    actualStartTime: null,
    attendanceStatus: "JOINED",
    payableStartTime: null,
    pauseState: undefined
  });
}

function page(items: WorkerShiftHistoryItem[]): WorkerShiftHistoryPageResponse {
  return { items, hasMore: false, nextCursor: null };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
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

function WorkerTabs() {
  return (
    <Tabs.Navigator initialRouteName="MyShiftHistory" screenOptions={{ headerShown: false }}>
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
    <WorkerShiftHistoryProvider>
      <NavigationContainer ref={navigationRef}>
        <WorkerShiftHistoryPagesProvider>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen component={WorkerTabs} name="WorkerTabs" />
            <Stack.Screen
              component={WorkerShiftDetailsScreen}
              getId={({ params }) =>
                `${params.shift.shiftId}:${params.shift.attendanceId}`
              }
              name="WorkerShiftDetails"
            />
          </Stack.Navigator>
        </WorkerShiftHistoryPagesProvider>
      </NavigationContainer>
    </WorkerShiftHistoryProvider>
  );
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 25));
}

function flattenText(value: unknown): string[] {
  if (typeof value === "string" || typeof value === "number") {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap(flattenText);
  }
  return [];
}

function output(view: ReactTestRenderer): string {
  return view.root
    .findAllByType(Text)
    .flatMap((node) => flattenText(node.props.children))
    .join(" ");
}

describe("Worker Shift Details native-stack navigation", () => {
  let view: ReactTestRenderer | null = null;

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    expect(Ionicons).toBeDefined();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    const authenticatedRequest = <T,>(
      request: (token: string) => Promise<T>
    ): Promise<T> => request("worker-token");
    mockedUseAuth.mockReturnValue({
      authenticatedRequest,
      status: "authenticated",
      user: worker
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    if (view) {
      act(() => view?.unmount());
      view = null;
    }
  });

  it("opens the exact page snapshot and rejects a later stale legacy publication on same-pair params update", async () => {
    const requestOrder: string[] = [];
    const pageShift = activeShift();
    const legacyResponse = deferred<WorkerShiftHistoryItem[]>();
    mockedGetMyShiftHistoryPage.mockImplementation(async () => {
      requestOrder.push("page:16/12:ACTIVE/APPROVED");
      return page([pageShift]);
    });
    mockedGetMyShiftHistory.mockImplementation(() => {
      requestOrder.push("legacy:16/12:OPEN/JOINED");
      return legacyResponse.promise;
    });
    const navigationRef = createNavigationContainerRef<WorkerStackParamList>();

    await act(async () => {
      view = create(<TestNavigator navigationRef={navigationRef} />);
      await settle();
    });

    const fullView = view!.root.find(
      (node) =>
        typeof node.props.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.startsWith("Full view.") &&
        typeof node.props.onPress === "function"
    );
    await act(async () => {
      fullView.props.onPress();
      await settle();
    });

    const initialDetailsRoute = navigationRef.getCurrentRoute();
    expect(initialDetailsRoute?.name).toBe("WorkerShiftDetails");
    expect(initialDetailsRoute?.params).toEqual({ shift: pageShift });
    expect(navigationRef.getRootState()!.routes).toHaveLength(2);
    expect(output(view!)).toContain("QA Site 16 current page item");
    expect(output(view!)).toContain("Active");
    expect(output(view!)).toContain("Attendance approved");
    expect(output(view!)).toContain("Pause my work");
    expect(mockedGetMyShiftHistory).not.toHaveBeenCalled();
    expect(requestOrder).toEqual(["page:16/12:ACTIVE/APPROVED"]);

    act(() => {
      view!.root.findByProps({ testID: "worker-shift-refresh-action" }).props.onPress();
    });
    expect(requestOrder).toEqual([
      "page:16/12:ACTIVE/APPROVED",
      "legacy:16/12:OPEN/JOINED"
    ]);

    const updatedPageShift = activeShift({
      title: "QA Site 16 updated page snapshot"
    });
    await act(async () => {
      navigationRef.navigate("WorkerShiftDetails", { shift: updatedPageShift });
      await settle();
    });

    expect(navigationRef.getRootState()!.routes).toHaveLength(2);
    expect(navigationRef.getCurrentRoute()?.key).toBe(initialDetailsRoute?.key);
    expect(navigationRef.getCurrentRoute()?.params).toEqual({ shift: updatedPageShift });
    expect(output(view!)).toContain("QA Site 16 updated page snapshot");

    await act(async () => {
      legacyResponse.resolve([staleLegacyShift()]);
      await settle();
    });

    expect(output(view!)).toContain("QA Site 16 updated page snapshot");
    expect(output(view!)).not.toContain("QA Site 16 stale legacy item");
    expect(output(view!)).toContain("Active");
    expect(output(view!)).toContain("Attendance approved");
    expect(output(view!)).toContain("Pause my work");
    expect(mockedStartMyPause).not.toHaveBeenCalled();
    expect(mockedEndMyPause).not.toHaveBeenCalled();
  });
});
