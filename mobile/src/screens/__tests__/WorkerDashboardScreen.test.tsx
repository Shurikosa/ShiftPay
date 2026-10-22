import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  type ViewStyle
} from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Screen } from "../../components/Screen";
import { WorkerShiftCard } from "../../components/WorkerShiftCard";
import { useAuth } from "../../context/AuthContext";
import { useWorkerShiftHistory } from "../../hooks/useWorkerShiftHistory";
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
jest.mock("../../hooks/useWorkerShiftHistory", () => ({
  useWorkerShiftHistory: jest.fn()
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedUseWorkerShiftHistory = jest.mocked(useWorkerShiftHistory);

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

function shiftFixture(index = 1): WorkerShiftHistoryItem {
  return {
    shiftId: 100 + index,
    attendanceId: 500 + index,
    companyId: 10,
    companyName: "Acme Construction",
    currencyLabel: "EUR",
    title: `Backend shift ${index}`,
    location: `Location ${index}`,
    status: index === 1 ? "ACTIVE" : "CLOSED",
    actualStartTime: "2026-07-05T22:00:00Z",
    actualEndTime: index === 1 ? null : "2026-07-05T23:00:00Z",
    attendanceStatus: "APPROVED",
    paymentStatus: index === 1 ? null : "UNPAID",
    hourlyRate: 20,
    breakMinutes: 0,
    pauseMinutes: 0,
    workedMinutes: index === 1 ? null : 60,
    calculatedSalary: index === 1 ? null : 20,
    pauseState: {
      allPaused: false,
      allPauseStartedAt: null,
      personallyPaused: false,
      personalPauseStartedAt: null,
      effectivePauseMinutes: 0
    }
  };
}

type HistoryValue = ReturnType<typeof useWorkerShiftHistory>;

const renderedViews: ReactTestRenderer[] = [];

async function renderDashboard({
  history,
  user = defaultUser
}: {
  history?: Partial<HistoryValue>;
  user?: User | null;
} = {}) {
  const signOut = jest.fn().mockResolvedValue(undefined);
  const refresh = jest.fn().mockResolvedValue([]);
  const navigation = {
    navigate: jest.fn()
  };
  mockedUseAuth.mockReturnValue({
    signOut,
    user
  } as unknown as ReturnType<typeof useAuth>);
  mockedUseWorkerShiftHistory.mockReturnValue({
    error: null,
    loading: false,
    refresh,
    shifts: [shiftFixture()],
    ...history
  } as HistoryValue);

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
  return { navigation, refresh, signOut, view };
}

function buttonByTestID(view: ReactTestRenderer, testID: string) {
  return view.root.find(
    (node) =>
      node.props.testID === testID &&
      node.props.accessibilityRole === "button" &&
      typeof node.props.style === "function"
  );
}

function hasButtonTestID(view: ReactTestRenderer, testID: string): boolean {
  return view.root.findAll(
    (node) =>
      node.props.testID === testID &&
      node.props.accessibilityRole === "button" &&
      typeof node.props.style === "function"
  ).length > 0;
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

  it("renders the branded worker identity and only real returned company context", async () => {
    const longUser = {
      ...defaultUser,
      firstName: "Avery-With-A-Very-Long-Returned-First-Name",
      lastName: "Builder-With-A-Very-Long-Returned-Last-Name",
      company: {
        ...defaultUser.company!,
        name: "A very long returned company name that wraps on narrow screens"
      }
    };
    const { view } = await renderDashboard({ user: longUser });
    const output = JSON.stringify(view.toJSON());
    const fullName = `${longUser.firstName} ${longUser.lastName}`;

    expect(view.root.findByProps({ children: "ShiftPay" }).type).toBe(Text);
    expect(view.root.findByProps({ children: "Worker" }).type).toBe(Text);
    expect(view.root.findByProps({ children: fullName }).props).toMatchObject({
      accessibilityRole: "header",
      allowFontScaling: true
    });
    expect(
      view.root.findByProps({ children: longUser.company.name }).props.numberOfLines
    ).toBeUndefined();
    expect(output).toContain("Join shifts and review your attendance history.");
    expect(output).toContain(longUser.company.name);
    expect(output).not.toContain("PRIVATE-CODE");
    expect(output).not.toContain("worker count");
    expect(output).not.toContain("hourly rate");
    expect(output).toContain("Settings");
    expect(output).not.toContain("fake activity");
  });

  it("keeps one prominent join action and accessible History/Payroll tile navigation", async () => {
    const { navigation, view } = await renderDashboard();
    const join = buttonByTestID(view, "worker-join-shift");
    const history = buttonByTestID(view, "worker-history-tile");
    const payroll = buttonByTestID(view, "worker-payroll-tile");

    expect(join.props.accessibilityLabel).toBe("Join shift");
    expect(history.props.accessibilityLabel).toBe(
      "My shift history. Review joined shifts and attendance."
    );
    expect(payroll.props.accessibilityLabel).toBe(
      "Payroll. Review payable work and payout requests."
    );
    expect(history.props.accessibilityRole).toBe("button");
    expect(payroll.props.accessibilityRole).toBe("button");

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

  it("delegates Log out exactly once", async () => {
    const { signOut, view } = await renderDashboard();

    await act(async () => {
      buttonByTestID(view, "worker-logout").props.onPress();
      await Promise.resolve();
    });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("shows a retryable logout error without leaving the worker dashboard", async () => {
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
    expect(JSON.stringify(view.toJSON())).toContain("Your session is still active");
    expect(buttonByTestID(view, "worker-logout").props.accessibilityState).toEqual({
      busy: false,
      disabled: false
    });

    await act(async () => {
      buttonByTestID(view, "worker-logout").props.onPress();
      await Promise.resolve();
    });
    expect(signOut).toHaveBeenCalledTimes(2);
  });

  it("shows intentional busy loading feedback with one spinner", async () => {
    const { view } = await renderDashboard({
      history: { loading: true, shifts: [] }
    });
    const feedback = view.root.findByProps({ testID: "worker-shifts-loading" });
    const announcement = feedback.find(
      (node) => node.props.accessibilityState?.busy === true
    );

    expect(view.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(announcement.props.accessibilityLabel).toContain("Loading shifts");
    expect(announcement.props.accessibilityLabel).toContain(
      "Fetching your worker history."
    );
    expect(announcement.props.accessibilityLiveRegion).toBe("polite");
  });

  it("shows the real error and retries once while handling rejection", async () => {
    const refresh = jest.fn().mockRejectedValue(new Error("still offline"));
    const { view } = await renderDashboard({
      history: {
        error: "Backend is temporarily unavailable.",
        refresh,
        shifts: []
      }
    });
    const feedback = view.root.findByProps({ testID: "worker-shifts-error" });
    const announcement = feedback.find(
      (node) => node.props.accessibilityRole === "alert"
    );

    expect(announcement.props.accessibilityLabel).toContain(
      "Backend is temporarily unavailable."
    );
    await act(async () => {
      buttonByTestID(view, "worker-shifts-retry").props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state with the real Join shift recovery action", async () => {
    const { navigation, view } = await renderDashboard({
      history: { shifts: [] }
    });
    const output = JSON.stringify(view.toJSON());

    expect(output).toContain("No shifts joined");
    expect(output).toContain("Join a shift with the code from your foreman.");
    act(() => {
      buttonByTestID(view, "worker-empty-join-shift").props.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith("JoinShift");
  });

  it.each([
    [1, 1, false],
    [3, 3, false],
    [4, 3, true]
  ])(
    "renders %i backend items as %i recent cards with View all=%s",
    async (total, visible, hasViewAll) => {
      const shifts = Array.from({ length: total }, (_, index) => shiftFixture(index + 1));
      const { view } = await renderDashboard({ history: { shifts } });
      const cards = view.root.findAllByType(WorkerShiftCard);

      expect(cards).toHaveLength(visible);
      expect(cards.map((card) => card.props.shift)).toEqual(shifts.slice(0, 3));
      expect(hasButtonTestID(view, "worker-view-all")).toBe(hasViewAll);
    }
  );

  it("navigates from a shift card with the exact returned object", async () => {
    const shift = shiftFixture(8);
    const { navigation, view } = await renderDashboard({
      history: { shifts: [shift] }
    });

    act(() => {
      buttonByTestID(view, `worker-shift-card-${shift.attendanceId}`).props.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith("WorkerShiftDetails", {
      shift
    });
  });

  it("opens all history only when more than three shifts exist", async () => {
    const shifts = [1, 2, 3, 4].map(shiftFixture);
    const { navigation, view } = await renderDashboard({ history: { shifts } });

    act(() => {
      buttonByTestID(view, "worker-view-all").props.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith("MyShiftHistory");
  });

  it("keeps the defensive no-company state local and disables company-dependent actions", async () => {
    const { navigation, view } = await renderDashboard({
      history: { shifts: [] },
      user: { ...defaultUser, company: null }
    });
    const join = buttonByTestID(view, "worker-join-shift");
    const emptyJoin = buttonByTestID(view, "worker-empty-join-shift");
    const payroll = buttonByTestID(view, "worker-payroll-tile");
    const history = buttonByTestID(view, "worker-history-tile");

    expect(view.root.findByProps({ testID: "worker-company-required" })).toBeTruthy();
    for (const action of [join, emptyJoin, payroll]) {
      expect(action.props.accessibilityState.disabled).toBe(true);
      expect(action.props.onPress).toBeUndefined();
    }
    expect(history.props.accessibilityState.disabled).toBe(false);
    act(() => {
      history.props.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith("MyShiftHistory");
    expect(navigation.navigate).not.toHaveBeenCalledWith("JoinCompany");
  });

  it("uses the Worker fallback when no usable returned name exists", async () => {
    const { view } = await renderDashboard({
      user: { ...defaultUser, firstName: " ", lastName: "" }
    });
    const workerCopies = view.root.findAllByProps({ children: "Worker" });

    expect(workerCopies.length).toBeGreaterThanOrEqual(2);
    expect(workerCopies.some((node) => node.props.accessibilityRole === "header")).toBe(
      true
    );
  });

  it("preserves scroll reachability, canonical tokens, wrapping, and named actions", async () => {
    const { view } = await renderDashboard();
    expect(view.root.findAllByType(Screen)).toHaveLength(1);
    expect(view.root.findByType(Screen).props.scroll).toBe(true);
    expect(view.root.findByType(ScrollView).props).toMatchObject({
      horizontal: false,
      keyboardShouldPersistTaps: "handled",
      scrollEnabled: true
    });

    const brand = view.root.findByProps({ children: "ShiftPay" });
    const title = view.root.findByProps({ children: "Avery Builder" });
    const section = view.root.findByProps({ children: "Current and recent shifts" });
    expect(StyleSheet.flatten(brand.props.style)).toMatchObject({
      color: theme.colors.brand.primary,
      fontSize: theme.typography.screenTitle.fontSize
    });
    expect(StyleSheet.flatten(title.props.style)).toMatchObject({
      color: theme.colors.ink.primary,
      fontSize: theme.typography.display.fontSize,
      flexShrink: 1
    });
    expect(StyleSheet.flatten(section.props.style)).toMatchObject({
      color: theme.colors.ink.primary,
      flexShrink: 1
    });

    for (const copy of [brand, title, section]) {
      const style = StyleSheet.flatten(copy.props.style) as TextStyle;
      expect(copy.props.allowFontScaling).toBe(true);
      expect(copy.props.numberOfLines).toBeUndefined();
      expect(copy.props.ellipsizeMode).toBeUndefined();
      expect(style.height).toBeUndefined();
      expect(style.maxHeight).toBeUndefined();
      expect(style.overflow).not.toBe("hidden");
    }

    const actions = view.root.findAll(
      (node) =>
        node.props.accessibilityRole === "button" &&
        typeof node.props.style === "function"
    );
    const names = actions.map((action) => action.props.accessibilityLabel);
    expect(actions.length).toBeGreaterThan(0);
    expect(names.every((name) => typeof name === "string" && name.trim().length > 0)).toBe(
      true
    );
    expect(new Set(names).size).toBe(names.length);

    const companyIcon = view.root
      .findAllByType(Ionicons)
      .find((icon) => icon.props.name === "business-outline")!;
    expect(companyIcon.props.accessible).toBe(false);
    expect(companyIcon.props.accessibilityElementsHidden).toBe(true);

    const content = view.root.findByProps({ testID: "worker-dashboard-content" });
    const contentStyle = StyleSheet.flatten(content.props.style) as ViewStyle;
    expect(contentStyle).toMatchObject({
      flexGrow: 1,
      flexShrink: 1,
      gap: theme.gap.section,
      maxWidth: "100%",
      width: "100%"
    });
    expect(contentStyle.height).toBeUndefined();
    expect(contentStyle.maxHeight).toBeUndefined();
    expect(contentStyle.overflow).not.toBe("hidden");
  });
});
