import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer
} from "react-test-renderer";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../../api/errors";
import { joinShiftByCode } from "../../api/shifts";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Feedback } from "../../components/Feedback";
import { FormField } from "../../components/FormField";
import { Screen } from "../../components/Screen";
import { useAuth } from "../../context/AuthContext";
import { useWorkerShiftHistory } from "../../hooks/useWorkerShiftHistory";
import {
  clearSession,
  loadSession,
  saveSession
} from "../../storage/sessionStorage";
import type { User } from "../../types/auth";
import type { JoinShiftResponse } from "../../types/shifts";
import { theme } from "../../utils/theme";
import { JoinShiftScreen } from "../JoinShiftScreen";

jest.mock("@expo/vector-icons/Ionicons", () => {
  const actualReact = jest.requireActual<typeof import("react")>("react");
  const { Text: NativeText } = jest.requireActual<typeof import("react-native")>(
    "react-native"
  );
  const MockIonicons = (props: Record<string, unknown>) =>
    actualReact.createElement(
      NativeText,
      props as ComponentProps<typeof NativeText>
    );

  return { __esModule: true, default: MockIonicons };
});
jest.mock("../../api/shifts", () => ({ joinShiftByCode: jest.fn() }));
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../hooks/useWorkerShiftHistory", () => ({
  useWorkerShiftHistory: jest.fn()
}));
jest.mock("../../storage/sessionStorage", () => ({
  clearSession: jest.fn(),
  loadSession: jest.fn(),
  saveSession: jest.fn()
}));

const mockedJoinShiftByCode = jest.mocked(joinShiftByCode);
const mockedUseAuth = jest.mocked(useAuth);
const mockedUseWorkerShiftHistory = jest.mocked(useWorkerShiftHistory);

const worker: User = {
  company: {
    currencyLabel: "EUR",
    id: 41,
    name: "Acme Construction",
    timeZone: "Europe/Berlin"
  },
  email: "worker@example.com",
  firstName: "Avery",
  id: 7,
  lastName: "Builder",
  role: "WORKER"
};
const joinedShift: JoinShiftResponse = {
  attendanceId: 73,
  currencyLabel: "EUR",
  hourlyRate: 24,
  shiftId: 501,
  status: "JOINED",
  workerId: worker.id
};

type Deferred<TValue> = {
  promise: Promise<TValue>;
  reject: (reason?: unknown) => void;
  resolve: (value: TValue | PromiseLike<TValue>) => void;
};

const authenticatedRequest = jest.fn();
const refresh = jest.fn();
const goBack = jest.fn();
const navigate = jest.fn();
const popTo = jest.fn();
let rendered: ReactTestRenderer | null = null;

function deferred<TValue>(): Deferred<TValue> {
  let resolve!: Deferred<TValue>["resolve"];
  let reject!: Deferred<TValue>["reject"];
  const promise = new Promise<TValue>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

function findField(): ReactTestInstance {
  return rendered!.root.findByType(FormField);
}

function findJoinButton(): ReactTestInstance {
  return rendered!.root
    .findAllByType(Button)
    .find((node) => node.props.label === "Join shift")!;
}

function findBackButton(): ReactTestInstance {
  return rendered!.root
    .findAllByType(Button)
    .find((node) => node.props.label === "Back to dashboard")!;
}

function findFeedback(title: string): ReactTestInstance {
  const feedback = rendered!.root
    .findAllByType(Feedback)
    .find((node) => node.props.title === title);
  if (!feedback) {
    throw new Error(`Missing ${title} feedback`);
  }
  return feedback;
}

function findView(testID: string): ReactTestInstance {
  const view = rendered!.root
    .findAllByType(View)
    .find((node) => node.props.testID === testID);
  if (!view) {
    throw new Error(`Missing ${testID} view`);
  }
  return view;
}

function enterCode(value: string): void {
  act(() => {
    findField().props.onChangeText(value);
  });
}

async function pressJoin(): Promise<void> {
  await act(async () => {
    findJoinButton().props.onPress();
    await flushPromises();
  });
}

async function renderScreen(user: User | null = worker): Promise<void> {
  mockedUseAuth.mockReturnValue({
    authenticatedRequest,
    status: "authenticated",
    user
  } as unknown as ReturnType<typeof useAuth>);
  mockedUseWorkerShiftHistory.mockReturnValue({
    error: null,
    loading: false,
    refresh,
    shifts: []
  });

  await act(async () => {
    rendered = create(
      <JoinShiftScreen
        {...({
          navigation: { goBack, navigate, popTo },
          route: { key: "join-shift", name: "JoinShift" }
        } as unknown as ComponentProps<typeof JoinShiftScreen>)}
      />
    );
  });
}

function expectNoFixedOrClippingStyle(style: unknown): void {
  const flattened = StyleSheet.flatten(style as never) as ViewStyle | undefined;
  expect(flattened?.height).toBeUndefined();
  expect(flattened?.maxHeight).toBeUndefined();
  expect(flattened?.overflow).not.toBe("hidden");
}

describe("JoinShiftScreen", () => {
  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authenticatedRequest.mockImplementation(
      (request: (token: string) => Promise<unknown>) => request("worker-token")
    );
    mockedJoinShiftByCode.mockResolvedValue(joinedShift);
    refresh.mockResolvedValue([]);
  });

  afterEach(() => {
    if (rendered) {
      act(() => {
        rendered?.unmount();
      });
    }
    rendered = null;
    jest.restoreAllMocks();
  });

  it("renders the branded nested composition using only real worker and company context", async () => {
    await renderScreen({
      ...worker,
      company: {
        ...worker.company!,
        name: "A returned company name that remains readable on a narrow screen"
      }
    });

    expect(rendered!.root.findAllByType(Screen)).toHaveLength(1);
    expect(rendered!.root.findByType(Screen).props.scroll).toBe(true);
    expect(rendered!.root.findAllByProps({ testID: "join-shift-header" })).not.toHaveLength(
      0
    );
    expect(rendered!.root.findAllByType(Card)).toHaveLength(1);
    expect(rendered!.root.findByType(Card).props.subtle).toBeUndefined();
    expect(rendered!.root.findAllByType(FormField)).toHaveLength(1);
    expect(rendered!.root.findAllByType(Button)).toHaveLength(2);
    expect(rendered!.root.findAllByType(Feedback)).toHaveLength(0);
    expect(findField().props).toMatchObject({
      allowFontScaling: true,
      autoCapitalize: "characters",
      autoCorrect: false,
      label: "Join code",
      leadingIcon: "code",
      placeholder: "ABCD12",
      returnKeyType: "done",
      submitBehavior: "submit"
    });
    expect(findJoinButton().props).toMatchObject({
      label: "Join shift",
      leadingIcon: "join"
    });
    expect(
      rendered!.root.findByProps({
        children: "A returned company name that remains readable on a narrow screen"
      }).props
    ).toMatchObject({ allowFontScaling: true });
    expect(rendered!.root.findAllByType(Image)).toHaveLength(0);

    const output = JSON.stringify(rendered!.toJSON());
    expect(output).toContain("open or active shift");
    expect(output).not.toMatch(/hourly.?rate|join company|worker count|dashboard preview/iu);
  });

  it("keeps the semantic header, named controls, decorative icons, and complete feedback announcements", async () => {
    await renderScreen();

    const title = rendered!.root
      .findAllByType(Text)
      .find(
        (node) =>
          node.props.children === "Join shift" &&
          node.props.accessibilityRole === "header"
      )!;
    expect(title.props.accessibilityRole).toBe("header");

    const nativeInput = rendered!.root.findByType(TextInput);
    expect(nativeInput.props).toMatchObject({
      accessibilityHint: "Enter the shift code shared by your foreman.",
      accessibilityLabel: "Join code",
      accessibilityState: { disabled: false }
    });
    const namedButtons = rendered!.root.findAll(
      (node) =>
        typeof node.type === "string" &&
        node.props.accessibilityRole === "button" &&
        typeof node.props.accessibilityLabel === "string"
    );
    expect(namedButtons.map((node) => node.props.accessibilityLabel).sort()).toEqual([
      "Back to dashboard",
      "Join shift"
    ]);
    expect(
      namedButtons.find((node) => node.props.accessibilityLabel === "Join shift")!.props
        .accessibilityHint
    ).toBe("Joins the open or active shift using this code.");

    for (const icon of rendered!.root.findAllByType(Ionicons)) {
      expect(icon.props).toMatchObject({
        accessibilityElementsHidden: true,
        accessible: false,
        "aria-hidden": true,
        importantForAccessibility: "no-hide-descendants"
      });
    }

    enterCode("bad");
    mockedJoinShiftByCode.mockRejectedValueOnce(new Error("Network unavailable."));
    await pressJoin();
    const feedback = findFeedback("Could not join shift");
    const announcement = feedback.find(
      (node) => node.props.accessibilityRole === "alert"
    );
    expect(announcement.props).toMatchObject({
      accessibilityLabel: "Could not join shift. Network unavailable.",
      accessibilityLiveRegion: "assertive"
    });
  });

  it("uses canonical responsive styles and preserves manual keyboard-safe scrolling", async () => {
    await renderScreen();

    const scrollView = rendered!.root.findByType(ScrollView);
    expect(scrollView.props).toMatchObject({
      horizontal: false,
      keyboardShouldPersistTaps: "handled",
      scrollEnabled: true
    });
    expect(StyleSheet.flatten(scrollView.props.contentContainerStyle)).toMatchObject({
      flexGrow: 1
    });
    expect(
      StyleSheet.flatten(rendered!.root.findByType(SafeAreaView).props.style)
    ).toMatchObject({ backgroundColor: theme.colors.canvas, flex: 1 });

    const pageStyle = StyleSheet.flatten(findView("join-shift-content").props.style);
    const headerStyle = StyleSheet.flatten(findView("join-shift-header").props.style);
    const contextStyle = StyleSheet.flatten(
      findView("join-shift-company-context").props.style
    );
    const cardStyle = StyleSheet.flatten(findView("join-shift-card").props.style);
    const formStyle = StyleSheet.flatten(findView("join-shift-form").props.style);
    expect(pageStyle).toMatchObject({
      flexGrow: 1,
      gap: theme.gap.section,
      maxWidth: "100%",
      width: "100%"
    });
    expect(contextStyle).toMatchObject({
      flexDirection: "row",
      flexShrink: 1,
      flexWrap: "wrap",
      gap: theme.space[2],
      maxWidth: "100%"
    });
    expect(headerStyle).toMatchObject({
      flexShrink: 1,
      gap: theme.space[2],
      maxWidth: "100%",
      width: "100%"
    });
    expect(cardStyle).toMatchObject({
      ...theme.elevation.overlay,
      backgroundColor: theme.colors.surface.default,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      borderWidth: theme.border.default,
      padding: theme.padding.card
    });
    expect(formStyle).toMatchObject({
      flexShrink: 1,
      gap: theme.space[4],
      maxWidth: "100%"
    });
    for (const style of [pageStyle, headerStyle, contextStyle, cardStyle, formStyle]) {
      expectNoFixedOrClippingStyle(style);
    }
    for (const text of rendered!.root.findAllByType(Text)) {
      expect(text.props.allowFontScaling).not.toBe(false);
      expect(text.props.numberOfLines).toBeUndefined();
      expect(text.props.ellipsizeMode).toBeUndefined();
      expectNoFixedOrClippingStyle(text.props.style);
    }
  });

  it("provides one visible Back control that delegates to goBack", async () => {
    await renderScreen();

    expect(findBackButton().props).toMatchObject({
      accessibilityHint: "Returns to the worker dashboard.",
      disabled: false,
      label: "Back to dashboard",
      leadingIcon: "back",
      variant: "ghost"
    });
    act(() => {
      findBackButton().props.onPress();
    });
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(popTo).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("guards a missing company without exposing or submitting the join form", async () => {
    await renderScreen({ ...worker, company: null });

    expect(rendered!.root.findByProps({ children: "Worker" })).toBeTruthy();
    expect(rendered!.root.findByProps({ children: "Join shift" }).props).toMatchObject({
      accessibilityRole: "header"
    });
    expect(
      rendered!.root.findByProps({
        children: "A company is required before shifts can be joined."
      })
    ).toBeTruthy();
    expect(rendered!.root.findAllByType(FormField)).toHaveLength(0);
    expect(rendered!.root.findAllByType(Card)).toHaveLength(0);
    expect(rendered!.root.findAllByType(Button)).toHaveLength(1);
    expect(findFeedback("Company required").props).toMatchObject({
      message: "Join your company first, then enter the shift join code from your foreman.",
      mode: "screen",
      tone: "error"
    });
    expect(authenticatedRequest).not.toHaveBeenCalled();
    expect(mockedJoinShiftByCode).not.toHaveBeenCalled();

    act(() => {
      findBackButton().props.onPress();
    });
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it("validates blank input locally without a request", async () => {
    await renderScreen();
    enterCode("   \n  ");
    await pressJoin();

    expect(findField().props.error).toBe("Enter a join code.");
    expect(authenticatedRequest).not.toHaveBeenCalled();
    expect(mockedJoinShiftByCode).not.toHaveBeenCalled();
  });

  it("normalizes the visible code and sends only the exact trimmed-uppercase payload", async () => {
    await renderScreen();
    enterCode("  ab-c  ");
    expect(findField().props.value).toBe("  AB-C  ");

    await pressJoin();

    expect(authenticatedRequest).toHaveBeenCalledTimes(1);
    expect(mockedJoinShiftByCode).toHaveBeenCalledTimes(1);
    expect(mockedJoinShiftByCode).toHaveBeenCalledWith("worker-token", {
      joinCode: "AB-C"
    });
    expect(mockedJoinShiftByCode.mock.calls[0]![1]).not.toHaveProperty("hourlyRate");
    expect(findField().props.maxLength).toBeUndefined();
    expect(findField().props.pattern).toBeUndefined();
  });

  it.each([
    [
      "already-joined conflict",
      new ApiError("Worker already joined this shift.", 409),
      "Worker already joined this shift."
    ],
    [
      "other lifecycle conflict",
      new ApiError("Shift is closed.", 409),
      "This shift can no longer be joined."
    ],
    ["unknown shift", new ApiError("Shift not found.", 404), "Shift not found."],
    [
      "forbidden company",
      new ApiError("Worker belongs to another company.", 403),
      "Worker belongs to another company."
    ],
    ["generic network failure", new Error("Network unavailable."), "Network unavailable."]
  ])("shows the safe %s error", async (_label, failure, expectedMessage) => {
    mockedJoinShiftByCode.mockRejectedValueOnce(failure);
    await renderScreen();
    enterCode("open12");
    await pressJoin();

    expect(findFeedback("Could not join shift").props).toMatchObject({
      message: expectedMessage,
      tone: "error"
    });
    expect(findField().props.value).toBe("OPEN12");
    expect(findJoinButton().props.loading).toBe(false);
  });

  it("handles a synchronous request throw through the common finalizer and permits retry", async () => {
    authenticatedRequest.mockImplementationOnce(() => {
      throw new Error("Synchronous auth failure.");
    });
    await renderScreen();
    enterCode("retry1");
    await pressJoin();

    expect(findFeedback("Could not join shift").props.message).toBe(
      "Synchronous auth failure."
    );
    expect(findJoinButton().props.loading).toBe(false);

    authenticatedRequest.mockImplementation(
      (request: (token: string) => Promise<unknown>) => request("worker-token")
    );
    await pressJoin();
    expect(authenticatedRequest).toHaveBeenCalledTimes(2);
    expect(mockedJoinShiftByCode).toHaveBeenCalledTimes(1);
    expect(popTo).toHaveBeenCalledWith("WorkerTabs", {
      screen: "WorkerDashboard"
    });
  });

  it("handles asynchronous rejection, releases the lock, and retries once", async () => {
    mockedJoinShiftByCode
      .mockRejectedValueOnce(new Error("Temporary failure."))
      .mockResolvedValueOnce(joinedShift);
    await renderScreen();
    enterCode("retry2");
    await pressJoin();
    expect(findFeedback("Could not join shift").props.message).toBe(
      "Temporary failure."
    );

    await pressJoin();
    expect(mockedJoinShiftByCode).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(popTo).toHaveBeenCalledTimes(1);
  });

  it("locks duplicate button and Return submissions synchronously", async () => {
    const request = deferred<JoinShiftResponse>();
    mockedJoinShiftByCode.mockReturnValueOnce(request.promise);
    await renderScreen();
    enterCode("once12");

    await act(async () => {
      findJoinButton().props.onPress();
      findJoinButton().props.onPress();
      findField().props.onSubmitEditing();
      await flushPromises();
    });

    expect(authenticatedRequest).toHaveBeenCalledTimes(1);
    expect(mockedJoinShiftByCode).toHaveBeenCalledTimes(1);

    await act(async () => {
      request.resolve(joinedShift);
      await flushPromises();
    });
  });

  it("disables the field, Join action, and Back action with one busy spinner while pending", async () => {
    const request = deferred<JoinShiftResponse>();
    mockedJoinShiftByCode.mockReturnValueOnce(request.promise);
    await renderScreen();
    enterCode("wait12");

    await act(async () => {
      findJoinButton().props.onPress();
      await flushPromises();
    });

    expect(findField().props.editable).toBe(false);
    expect(findJoinButton().props).toMatchObject({ disabled: true, loading: true });
    expect(findBackButton().props).toMatchObject({ disabled: true });
    const nativeJoin = rendered!.root.findByProps({
      accessibilityLabel: "Join shift"
    });
    const nativeBack = rendered!.root.findByProps({
      accessibilityLabel: "Back to dashboard"
    });
    expect(nativeJoin.props.accessibilityState).toEqual({
      busy: true,
      disabled: true
    });
    expect(nativeBack.props.accessibilityState).toEqual({
      busy: false,
      disabled: true
    });
    expect(nativeJoin.props.onPress).toBeUndefined();
    expect(nativeBack.props.onPress).toBeUndefined();
    expect(rendered!.root.findAllByType(ActivityIndicator)).toHaveLength(1);

    await act(async () => {
      request.resolve(joinedShift);
      await flushPromises();
    });
  });

  it("clears the code, refreshes history, and pops to the shell exactly once after success", async () => {
    await renderScreen();
    enterCode("success1");
    await pressJoin();

    expect(findField().props.value).toBe("");
    expect(findFeedback("Shift joined").props).toMatchObject({
      message: "Joined shift 501. Waiting for foreman approval.",
      tone: "success"
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(popTo).toHaveBeenCalledTimes(1);
    expect(popTo).toHaveBeenCalledWith("WorkerTabs", {
      screen: "WorkerDashboard"
    });
    expect(goBack).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each(["reject", "throw"] as const)(
    "keeps successful navigation handled when history refresh will %s",
    async (refreshFailure) => {
      if (refreshFailure === "reject") {
        refresh.mockRejectedValueOnce(new Error("History refresh failed."));
      } else {
        refresh.mockImplementationOnce(() => {
          throw new Error("History refresh failed synchronously.");
        });
      }
      await renderScreen();
      enterCode("success2");
      await pressJoin();

      expect(refresh).toHaveBeenCalledTimes(1);
      expect(popTo).toHaveBeenCalledTimes(1);
      expect(findFeedback("Shift joined").props.message).toContain("501");
      expect(rendered!.root.findAllByProps({ testID: "join-shift-error" })).toHaveLength(
        0
      );
    }
  );

  it("starts refresh once before a navigation-triggered unmount", async () => {
    popTo.mockImplementationOnce(() => {
      rendered?.unmount();
      rendered = null;
    });
    await renderScreen();
    enterCode("route1");

    await act(async () => {
      findJoinButton().props.onPress();
      await flushPromises();
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(popTo).toHaveBeenCalledTimes(1);
    expect(popTo).toHaveBeenCalledWith("WorkerTabs", {
      screen: "WorkerDashboard"
    });
  });

  it("does not map a delayed rejection after unmount", async () => {
    const request = deferred<JoinShiftResponse>();
    const readMessage = jest.fn(() => "Late backend failure.");
    const lateError = new ApiError("placeholder", 409);
    Object.defineProperty(lateError, "message", {
      configurable: true,
      get: readMessage
    });
    mockedJoinShiftByCode.mockReturnValueOnce(request.promise);
    await renderScreen();
    enterCode("late1");

    await act(async () => {
      findJoinButton().props.onPress();
      await flushPromises();
    });
    act(() => {
      rendered?.unmount();
      rendered = null;
    });
    await act(async () => {
      request.reject(lateError);
      await flushPromises();
    });

    expect(readMessage).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(popTo).not.toHaveBeenCalled();
  });

  it("does not inspect or act on a delayed successful response after unmount", async () => {
    const request = deferred<JoinShiftResponse>();
    const readShiftId = jest.fn(() => 902);
    const lateResponse = {
      ...joinedShift,
      get shiftId() {
        return readShiftId();
      }
    };
    readShiftId.mockClear();
    mockedJoinShiftByCode.mockReturnValueOnce(request.promise);
    await renderScreen();
    enterCode("late2");

    await act(async () => {
      findJoinButton().props.onPress();
      await flushPromises();
    });
    act(() => {
      rendered?.unmount();
      rendered = null;
    });
    await act(async () => {
      request.resolve(lateResponse);
      await flushPromises();
    });

    expect(readShiftId).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(popTo).not.toHaveBeenCalled();
  });

  it("clears stale field, backend, and success feedback when the code is edited", async () => {
    await renderScreen();
    enterCode("   ");
    await pressJoin();
    expect(findField().props.error).toBe("Enter a join code.");
    enterCode("first");
    expect(findField().props.error).toBeUndefined();

    mockedJoinShiftByCode.mockRejectedValueOnce(new Error("Stale failure."));
    await pressJoin();
    expect(findFeedback("Could not join shift")).toBeTruthy();
    enterCode("second");
    expect(rendered!.root.findAllByProps({ testID: "join-shift-error" })).toHaveLength(
      0
    );

    await pressJoin();
    expect(findFeedback("Shift joined")).toBeTruthy();
    enterCode("third");
    expect(rendered!.root.findAllByProps({ testID: "join-shift-success" })).toHaveLength(
      0
    );
  });

  it("does not perform direct storage or session work", async () => {
    await renderScreen();
    enterCode("clean1");
    await pressJoin();

    expect(loadSession).not.toHaveBeenCalled();
    expect(saveSession).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();
    expect(mockedUseWorkerShiftHistory).toHaveBeenCalledWith({
      loadOnFocus: false
    });
  });
});
