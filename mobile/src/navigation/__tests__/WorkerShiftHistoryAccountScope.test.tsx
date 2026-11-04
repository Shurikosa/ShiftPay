import Ionicons from "@expo/vector-icons/Ionicons";
import {
  createNavigationContainerRef,
  type ParamListBase
} from "@react-navigation/native";
import type { ComponentProps } from "react";
import { RefreshControl, Text } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getMyShiftHistoryPage } from "../../api/shifts";
import { Button } from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import type { User } from "../../types/auth";
import type {
  WorkerShiftHistoryItem,
  WorkerShiftHistoryPageResponse
} from "../../types/shifts";
import { AppNavigator } from "../AppNavigator";

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
  ...jest.requireActual<typeof import("../../api/shifts")>("../../api/shifts"),
  getMyShiftHistoryPage: jest.fn()
}));
jest.mock("../../screens/WorkerDashboardScreen", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View: NativeView } = jest.requireActual<
    typeof import("react-native")
  >("react-native");
  return {
    WorkerDashboardScreen: () =>
      React.createElement(NativeView, { testID: "worker-dashboard-stub" })
  };
});

const mockedUseAuth = jest.mocked(useAuth);
const mockedGetMyShiftHistoryPage = jest.mocked(getMyShiftHistoryPage);

const workerA: User = {
  company: {
    currencyLabel: "EUR",
    id: 10,
    name: "Company A",
    timeZone: "Europe/Berlin"
  },
  email: "worker-a@example.com",
  firstName: "Worker",
  id: 101,
  lastName: "A",
  role: "WORKER"
};

const workerB: User = {
  company: {
    currencyLabel: "USD",
    id: 20,
    name: "Company B",
    timeZone: "America/New_York"
  },
  email: "worker-b@example.com",
  firstName: "Worker",
  id: 202,
  lastName: "B",
  role: "WORKER"
};

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    reject = promiseReject;
    resolve = promiseResolve;
  });
  return { promise, reject, resolve };
}

function shiftFixture(
  attendanceId: number,
  title: string,
  companyId: number,
  companyName: string
): WorkerShiftHistoryItem {
  return {
    actualEndTime: null,
    actualStartTime: null,
    attendanceId,
    attendanceStatus: "JOINED",
    breakMinutes: 0,
    calculatedSalary: null,
    companyId,
    companyName,
    currencyLabel: companyId === 10 ? "EUR" : "USD",
    hourlyRate: 20,
    location: null,
    paymentStatus: null,
    shiftId: attendanceId + 1000,
    status: "OPEN",
    title,
    workedMinutes: null
  };
}

function page(
  items: WorkerShiftHistoryItem[],
  nextCursor: string | null = null
): WorkerShiftHistoryPageResponse {
  return { hasMore: nextCursor !== null, items, nextCursor };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 30));
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

function findButton(view: ReactTestRenderer, label: string) {
  const button = view.root
    .findAllByType(Button)
    .find((candidate) => candidate.props.label === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

describe("WORKER paged-history account scope", () => {
  let activeToken = "token-a";
  let activeUser: User = workerA;
  let authenticatedRequest: jest.Mock;
  let view: ReactTestRenderer | null = null;

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    expect(Ionicons).toBeDefined();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetMyShiftHistoryPage.mockReset();
    activeToken = "token-a";
    activeUser = workerA;
    authenticatedRequest = jest.fn(
      (request: (token: string) => Promise<unknown>) => request(activeToken)
    );
    mockedUseAuth.mockImplementation(
      () =>
        ({
          authenticatedRequest,
          status: "authenticated",
          user: activeUser
        }) as unknown as ReturnType<typeof useAuth>
    );
  });

  afterEach(() => {
    if (view) {
      act(() => view?.unmount());
      view = null;
    }
  });

  it.each(["success", "failure"] as const)(
    "remounts paged history for direct account changes and ignores late A %s",
    async (lateAResult) => {
      const loadedA = shiftFixture(11, "Loaded shift for A", 10, "Company A");
      const lateA = shiftFixture(12, "Late shift for A", 10, "Company A");
      const freshA = shiftFixture(13, "Fresh shift for returning A", 10, "Company A");
      const pendingA = deferred<WorkerShiftHistoryPageResponse>();
      const pendingB = deferred<WorkerShiftHistoryPageResponse>();
      mockedGetMyShiftHistoryPage
        .mockResolvedValueOnce(page([loadedA], "a-next-cursor"))
        .mockRejectedValueOnce(new Error("A continuation failed"))
        .mockReturnValueOnce(pendingA.promise)
        .mockReturnValueOnce(pendingB.promise)
        .mockResolvedValueOnce(page([freshA]));

      const navigationRef = createNavigationContainerRef<ParamListBase>();
      await act(async () => {
        view = create(<AppNavigator navigationRef={navigationRef} />);
        await settle();
      });
      await act(async () => {
        navigationRef.navigate("WorkerTabs", { screen: "MyShiftHistory" });
        await settle();
      });

      expect(renderedText(view!)).toContain("Loaded shift for A");
      expect(mockedGetMyShiftHistoryPage).toHaveBeenNthCalledWith(1, "token-a");

      await act(async () => {
        findButton(view!, "Load more").props.onPress();
        await settle();
      });
      expect(renderedText(view!)).toContain("A continuation failed");
      expect(mockedGetMyShiftHistoryPage).toHaveBeenNthCalledWith(
        2,
        "token-a",
        "a-next-cursor"
      );

      act(() => {
        view!.root.findByType(RefreshControl).props.onRefresh();
      });
      expect(mockedGetMyShiftHistoryPage).toHaveBeenCalledTimes(3);

      activeUser = workerB;
      activeToken = "token-b";
      await act(async () => {
        view!.update(<AppNavigator navigationRef={navigationRef} />);
        await settle();
      });
      expect(renderedText(view!)).not.toContain("Loaded shift for A");
      expect(renderedText(view!)).not.toContain("A continuation failed");

      await act(async () => {
        navigationRef.navigate("WorkerTabs", { screen: "MyShiftHistory" });
        await settle();
      });
      expect(mockedGetMyShiftHistoryPage).toHaveBeenNthCalledWith(4, "token-b");
      expect(renderedText(view!)).not.toContain("Loaded shift for A");
      expect(renderedText(view!)).not.toContain("A continuation failed");
      expect(
        view!.root
          .findAllByType(Button)
          .some((button) =>
            ["Load more", "Retry load more"].includes(button.props.label)
          )
      ).toBe(false);

      await act(async () => {
        pendingB.reject(new Error("B first-page refresh failed"));
        await settle();
      });
      expect(renderedText(view!)).toContain("B first-page refresh failed");
      expect(renderedText(view!)).not.toContain("Loaded shift for A");

      await act(async () => {
        if (lateAResult === "success") {
          pendingA.resolve(page([lateA]));
        } else {
          pendingA.reject(new Error("Late A refresh failed"));
        }
        await settle();
      });
      expect(renderedText(view!)).toContain("B first-page refresh failed");
      expect(renderedText(view!)).not.toContain("Late shift for A");
      expect(renderedText(view!)).not.toContain("Late A refresh failed");

      activeUser = workerA;
      activeToken = "token-a-returned";
      await act(async () => {
        view!.update(<AppNavigator navigationRef={navigationRef} />);
        await settle();
      });
      await act(async () => {
        navigationRef.navigate("WorkerTabs", { screen: "MyShiftHistory" });
        await settle();
      });

      expect(mockedGetMyShiftHistoryPage).toHaveBeenNthCalledWith(
        5,
        "token-a-returned"
      );
      expect(renderedText(view!)).toContain("Fresh shift for returning A");
      expect(renderedText(view!)).not.toContain("Loaded shift for A");
      expect(renderedText(view!)).not.toContain("B first-page refresh failed");
    }
  );
});
