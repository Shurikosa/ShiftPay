import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { ComponentProps } from "react";
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer
} from "react-test-renderer";
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCurrentUser, loginUser, registerUser } from "../../api/auth";
import { joinCompany } from "../../api/companies";
import { ApiError } from "../../api/errors";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Feedback } from "../../components/Feedback";
import { FormField } from "../../components/FormField";
import { Screen } from "../../components/Screen";
import { useAuth } from "../../context/AuthContext";
import {
  clearSession,
  loadSession,
  saveSession
} from "../../storage/sessionStorage";
import type { Company, User } from "../../types/auth";
import { theme } from "../../utils/theme";
import { JoinCompanyScreen } from "../JoinCompanyScreen";

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
jest.mock("../../api/auth", () => ({
  getCurrentUser: jest.fn(),
  loginUser: jest.fn(),
  registerUser: jest.fn()
}));
jest.mock("../../api/companies", () => ({ joinCompany: jest.fn() }));
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../storage/sessionStorage", () => ({
  clearSession: jest.fn(),
  loadSession: jest.fn(),
  saveSession: jest.fn()
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: jest.fn()
}));

const mockedJoinCompany = jest.mocked(joinCompany);
const mockedUseAuth = jest.mocked(useAuth);
const initialWindowDimensions = Dimensions.get("window");
const initialScreenDimensions = Dimensions.get("screen");
const joinedCompany: Company = {
  currencyLabel: "EUR",
  id: 41,
  name: "Acme Construction",
  timeZone: "Europe/Berlin"
};
const workerAfterJoin: User = {
  company: joinedCompany,
  email: "worker@example.com",
  firstName: "John",
  id: 7,
  lastName: "Worker",
  role: "WORKER"
};

type Deferred<TValue> = {
  promise: Promise<TValue>;
  reject: (reason?: unknown) => void;
  resolve: (value: TValue | PromiseLike<TValue>) => void;
};

const applyCompany = jest.fn();
const authenticatedRequest = jest.fn();
const refreshCurrentUser = jest.fn();
const signOut = jest.fn();
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

function setTestDimensions(
  width: number,
  height: number,
  fontScale: number
): void {
  const window = {
    fontScale,
    height,
    scale: initialWindowDimensions.scale,
    width
  };

  Dimensions.set({ screen: window, window });
}

function findViewByTestID(testID: string): ReactTestInstance {
  const result = rendered!.root
    .findAllByType(View)
    .find((node) => node.props.testID === testID);
  if (!result) {
    throw new Error(`Missing ${testID} view`);
  }
  return result;
}

function findField(): ReactTestInstance {
  return rendered!.root.findByType(FormField);
}

function findButton(label: "Join company" | "Log out" | "Settings"): ReactTestInstance {
  const result = rendered!.root
    .findAllByType(Button)
    .find((node) => node.props.label === label);
  if (!result) {
    throw new Error(`Missing ${label} button`);
  }
  return result;
}

function findNativeButton(label: "Join company" | "Log out" | "Settings"): ReactTestInstance {
  const result = rendered!.root.findAll(
    (node) =>
      typeof node.type === "string" &&
      node.props.accessible === true &&
      node.props.accessibilityRole === "button" &&
      node.props.accessibilityLabel === label
  )[0];
  if (!result) {
    throw new Error(`Missing native ${label} button`);
  }
  return result;
}

function findFeedback(title: string): ReactTestInstance {
  const result = rendered!.root
    .findAllByType(Feedback)
    .find((node) => node.props.title === title);
  if (!result) {
    throw new Error(`Missing ${title} feedback`);
  }
  return result;
}

function enterJoinCode(value: string): void {
  act(() => {
    findField().props.onChangeText(value);
  });
}

async function submitJoin(): Promise<void> {
  await act(async () => {
    findButton("Join company").props.onPress();
    await flushPromises();
  });
}

async function renderJoinCompany(onOpenSettings?: () => void): Promise<ReactTestRenderer> {
  mockedUseAuth.mockReturnValue({
    applyCompany,
    authenticatedRequest,
    refreshCurrentUser,
    signOut,
    status: "authenticated",
    user: { ...workerAfterJoin, company: null }
  } as unknown as ReturnType<typeof useAuth>);

  await act(async () => {
    rendered = create(<JoinCompanyScreen onOpenSettings={onOpenSettings} />);
  });
  return rendered!;
}

describe("JoinCompanyScreen", () => {
  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setTestDimensions(411, 891, 1);
    authenticatedRequest.mockImplementation(
      (request: (token: string) => Promise<unknown>) => request("worker-token")
    );
    applyCompany.mockResolvedValue(workerAfterJoin);
    refreshCurrentUser.mockResolvedValue(workerAfterJoin);
    signOut.mockResolvedValue(undefined);
    mockedJoinCompany.mockResolvedValue(joinedCompany);
  });

  it("opens Settings without clearing the in-progress join code", async () => {
    const onOpenSettings = jest.fn();
    await renderJoinCompany(onOpenSettings);
    enterJoinCode("keep12");

    act(() => void findButton("Settings").props.onPress());

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(findField().props.value).toBe("KEEP12");
  });

  afterEach(() => {
    act(() => {
      rendered?.unmount();
    });
    rendered = null;
    jest.restoreAllMocks();
  });

  afterAll(() => {
    Dimensions.set({
      screen: initialScreenDimensions,
      window: initialWindowDimensions
    });
  });

  it("renders the ordered branded worker onboarding composition without unrelated workflows", async () => {
    await renderJoinCompany();

    expect(rendered!.root.findAllByType(Screen)).toHaveLength(1);
    expect(rendered!.root.findByType(Screen).props.scroll).toBe(true);
    expect(rendered!.root.findAllByType(Card)).toHaveLength(1);
    expect(rendered!.root.findByType(Card).props.subtle).toBeUndefined();
    expect(rendered!.root.findAllByType(FormField)).toHaveLength(1);
    expect(rendered!.root.findAllByType(Feedback)).toHaveLength(0);
    expect(rendered!.root.findAllByType(Button)).toHaveLength(2);
    expect(
      rendered!.root
        .findAllByType(Text)
        .map((node) => node.props.children)
        .filter((children) => typeof children === "string")
    ).toEqual([
      "ShiftPay",
      "Worker setup",
      "Join company",
      "Enter the company join code shared by your foreman.",
      "Company join code",
      "Join company",
      "Log out"
    ]);
    expect(findField().props).toMatchObject({
      autoCapitalize: "characters",
      autoCorrect: false,
      label: "Company join code",
      leadingIcon: "company",
      placeholder: "CMP123",
      returnKeyType: "done",
      submitBehavior: "submit"
    });
    expect(findButton("Join company").props.leadingIcon).toBe("join");
    expect(findButton("Join company").props.variant).toBeUndefined();
    expect(findButton("Log out").props).toMatchObject({
      leadingIcon: "logout",
      variant: "ghost"
    });
    expect(rendered!.root.findAllByType(Image)).toHaveLength(0);
    expect(
      rendered!.root
        .findAllByType(Text)
        .some((node) =>
          /join shift|company search|scan|hourly rate|currency|company name|back|log in/iu.test(
            String(node.props.children)
          )
        )
    ).toBe(false);
  });

  it("uses canonical elevated tokens and keeps normal manual scrolling at narrow font scale 1.5", async () => {
    setTestDimensions(280, 568, 1.5);
    await renderJoinCompany();
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

    const pageStyle = StyleSheet.flatten(
      findViewByTestID("join-company-content").props.style
    ) as ViewStyle;
    const headerStyle = StyleSheet.flatten(
      findViewByTestID("join-company-header").props.style
    ) as ViewStyle;
    const cardStyle = StyleSheet.flatten(
      findViewByTestID("join-company-card").props.style
    ) as ViewStyle;
    const formStyle = StyleSheet.flatten(
      findViewByTestID("join-company-form").props.style
    ) as ViewStyle;
    const recoveryStyle = StyleSheet.flatten(
      findViewByTestID("join-company-recovery").props.style
    ) as ViewStyle;

    expect(pageStyle).toMatchObject({
      flexGrow: 1,
      gap: theme.gap.section,
      justifyContent: "center",
      maxWidth: "100%",
      width: "100%"
    });
    expect(headerStyle).toMatchObject({
      flexShrink: 1,
      gap: theme.space[2],
      maxWidth: "100%"
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
    expect(recoveryStyle).toMatchObject({
      alignSelf: "stretch",
      flexShrink: 1,
      maxWidth: "100%"
    });

    for (const style of [pageStyle, headerStyle, cardStyle, formStyle, recoveryStyle]) {
      expect(style).not.toHaveProperty("height");
      expect(style).not.toHaveProperty("maxHeight");
      expect(style.overflow).not.toBe("hidden");
    }
    expect(findNativeButton("Log out")).toBeDefined();
  });

  it("provides one named field, two named buttons, wrapping copy, and decorative icons", async () => {
    await renderJoinCompany();
    const input = rendered!.root.findByType(TextInput);
    const namedButtons = rendered!.root.findAll(
      (node) =>
        typeof node.type === "string" &&
        node.props.accessible === true &&
        node.props.accessibilityRole === "button"
    );

    expect(rendered!.root.findAllByType(TextInput)).toHaveLength(1);
    expect(input.props).toMatchObject({
      accessibilityHint: "Enter the code shared by your foreman.",
      accessibilityLabel: "Company join code",
      accessibilityState: { disabled: false },
      allowFontScaling: true
    });
    expect(namedButtons).toHaveLength(2);
    expect(namedButtons.map((node) => node.props.accessibilityLabel)).toEqual([
      "Join company",
      "Log out"
    ]);
    expect(findNativeButton("Join company").props.accessibilityHint).toBe(
      "Joins the company using this code."
    );
    expect(findNativeButton("Log out").props.accessibilityHint).toBe(
      "Signs out of this account and returns to the sign-in flow."
    );
    expect(
      rendered!.root.findAll(
        (node) =>
          typeof node.type === "string" &&
          (node.props.accessibilityRole === "button" ||
            node.props.accessibilityRole === "link") &&
          (typeof node.props.accessibilityLabel !== "string" ||
            node.props.accessibilityLabel.trim().length === 0)
      )
    ).toHaveLength(0);

    expect(rendered!.root.findAllByType(Ionicons)).toHaveLength(3);
    for (const icon of rendered!.root.findAllByType(Ionicons)) {
      expect(icon.props).toMatchObject({
        accessible: false,
        accessibilityElementsHidden: true,
        "aria-hidden": true,
        importantForAccessibility: "no-hide-descendants"
      });
    }

    const visibleText = rendered!.root
      .findAllByType(Text)
      .filter((node) => typeof node.props.children === "string");
    for (const text of visibleText) {
      expect(text.props.allowFontScaling).not.toBe(false);
      expect(text.props.numberOfLines).toBeUndefined();
      expect(text.props.ellipsizeMode).toBeUndefined();
      const style = StyleSheet.flatten(text.props.style) as ViewStyle;
      expect(style).not.toHaveProperty("height");
      expect(style).not.toHaveProperty("maxHeight");
      expect(style.overflow).not.toBe("hidden");
    }
    expect(
      rendered!.root
        .findAllByType(Text)
        .find(
          (node) =>
            node.props.children === "Join company" &&
            node.props.accessibilityRole === "header"
        )?.props.accessibilityRole
    ).toBe("header");
  });

  it("uppercases visible input and submits the exact trimmed-uppercase payload", async () => {
    await renderJoinCompany();
    enterJoinCode("  cmp-123 mixed  ");

    expect(findField().props.value).toBe("  CMP-123 MIXED  ");
    await submitJoin();

    expect(authenticatedRequest).toHaveBeenCalledTimes(1);
    expect(mockedJoinCompany).toHaveBeenCalledTimes(1);
    expect(mockedJoinCompany).toHaveBeenCalledWith("worker-token", {
      joinCode: "CMP-123 MIXED"
    });
    expect(applyCompany).toHaveBeenCalledWith(joinedCompany);
    expect(refreshCurrentUser).toHaveBeenCalledTimes(1);
    expect(applyCompany.mock.invocationCallOrder[0]!).toBeLessThan(
      refreshCurrentUser.mock.invocationCallOrder[0]!
    );
    expect(findFeedback("Company joined").props).toMatchObject({
      message: "Joined Acme Construction.",
      tone: "success"
    });
    const successAnnouncement = findViewByTestID("join-company-success").find(
      (node) =>
        node.props.accessible === true &&
        node.props.accessibilityRole === "text"
    );
    expect(successAnnouncement.props).toMatchObject({
      accessibilityLiveRegion: "polite",
      accessibilityState: { busy: false }
    });
    expect(successAnnouncement.props.accessibilityLabel).toContain(
      "Company joined"
    );
    expect(successAnnouncement.props.accessibilityLabel).toContain(
      "Joined Acme Construction."
    );
    expect(findField().props.value).toBe("  CMP-123 MIXED  ");
    expect(useNavigation).not.toHaveBeenCalled();
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it.each(["", " ", "\t\n  "])(
    "rejects blank join code %p locally without making a request",
    async (value) => {
      await renderJoinCompany();
      enterJoinCode(value);

      await submitJoin();

      expect(findField().props.error).toBe("Enter a company join code.");
      expect(authenticatedRequest).not.toHaveBeenCalled();
      expect(mockedJoinCompany).not.toHaveBeenCalled();
      expect(applyCompany).not.toHaveBeenCalled();
      expect(refreshCurrentUser).not.toHaveBeenCalled();
    }
  );

  it("retains the code and announces a safe backend rejection", async () => {
    mockedJoinCompany.mockRejectedValueOnce(
      new ApiError("Company not found", 404)
    );
    await renderJoinCompany();
    enterJoinCode("missing");

    await submitJoin();

    expect(findField().props.value).toBe("MISSING");
    expect(findFeedback("Could not join company").props).toMatchObject({
      message: "Company not found",
      tone: "error"
    });
    const announcement = findViewByTestID("join-company-error").find(
      (node) =>
        node.props.accessible === true &&
        node.props.accessibilityRole === "alert"
    );
    expect(announcement.props).toMatchObject({
      accessibilityLiveRegion: "assertive",
      accessibilityState: { busy: false }
    });
    expect(announcement.props.accessibilityLabel).toContain(
      "Could not join company"
    );
    expect(announcement.props.accessibilityLabel).toContain("Company not found");
    expect(findNativeButton("Join company").props.accessibilityState).toEqual({
      busy: false,
      disabled: false
    });
  });

  it("clears stale field, backend, and success feedback whenever the code is edited", async () => {
    await renderJoinCompany();
    await submitJoin();
    expect(findField().props.error).toBe("Enter a company join code.");

    enterJoinCode("bad");
    expect(findField().props.error).toBeUndefined();
    mockedJoinCompany.mockRejectedValueOnce(new ApiError("Bad join code", 400));
    await submitJoin();
    expect(findFeedback("Could not join company").props.message).toBe(
      "Bad join code"
    );

    enterJoinCode("good");
    expect(rendered!.root.findAllByType(Feedback)).toHaveLength(0);
    mockedJoinCompany.mockResolvedValueOnce(joinedCompany);
    await submitJoin();
    expect(findFeedback("Company joined").props.message).toBe(
      "Joined Acme Construction."
    );

    enterJoinCode("another");
    expect(rendered!.root.findAllByType(Feedback)).toHaveLength(0);
  });

  it("warns on refresh failure without converting a successful join into failure", async () => {
    const refreshError = new Error("refresh unavailable");
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    refreshCurrentUser.mockRejectedValueOnce(refreshError);
    await renderJoinCompany();
    enterJoinCode("cmp123");

    await submitJoin();

    expect(applyCompany).toHaveBeenCalledWith(joinedCompany);
    expect(refreshCurrentUser).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(
      "Failed to refresh user after company join.",
      refreshError
    );
    expect(findFeedback("Company joined").props.message).toBe(
      "Joined Acme Construction."
    );
    expect(
      rendered!.root
        .findAllByType(Feedback)
        .some((feedback) => feedback.props.tone === "error")
    ).toBe(false);
    expect(useNavigation).not.toHaveBeenCalled();
  });

  it("locks duplicate tap and return submissions and suppresses logout while pending", async () => {
    const request = deferred<Company>();
    mockedJoinCompany.mockReturnValueOnce(request.promise);
    await renderJoinCompany();
    enterJoinCode("cmp123");
    const submit = findButton("Join company").props.onPress;
    const submitFromKeyboard = findField().props.onSubmitEditing;

    await act(async () => {
      submit();
      submitFromKeyboard();
      submit();
      await Promise.resolve();
    });

    expect(authenticatedRequest).toHaveBeenCalledTimes(1);
    expect(mockedJoinCompany).toHaveBeenCalledTimes(1);
    expect(findField().props.editable).toBe(false);
    expect(rendered!.root.findByType(TextInput).props).toMatchObject({
      accessibilityState: { disabled: true },
      editable: false
    });
    expect(findButton("Join company").props).toMatchObject({
      disabled: true,
      loading: true
    });
    expect(findNativeButton("Join company").props).toMatchObject({
      accessibilityState: { busy: true, disabled: true },
      focusable: false,
      pointerEvents: "none"
    });
    expect(findNativeButton("Join company").props.onPress).toBeUndefined();
    expect(findButton("Log out").props.disabled).toBe(true);
    expect(findNativeButton("Log out").props).toMatchObject({
      accessibilityState: { busy: false, disabled: true },
      focusable: false,
      pointerEvents: "none"
    });
    expect(findNativeButton("Log out").props.onPress).toBeUndefined();

    act(() => {
      findButton("Log out").props.onPress();
    });
    expect(signOut).not.toHaveBeenCalled();

    await act(async () => {
      request.resolve(joinedCompany);
      await flushPromises();
    });
    expect(findField().props.editable).toBe(true);
    expect(findNativeButton("Join company").props.accessibilityState).toEqual({
      busy: false,
      disabled: false
    });
    expect(findNativeButton("Log out").props.accessibilityState).toEqual({
      busy: false,
      disabled: false
    });
  });

  it("delegates one enabled logout tap only to signOut", async () => {
    await renderJoinCompany();

    await act(async () => {
      findButton("Log out").props.onPress();
      await flushPromises();
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(authenticatedRequest).not.toHaveBeenCalled();
    expect(mockedJoinCompany).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();
    expect(loadSession).not.toHaveBeenCalled();
    expect(saveSession).not.toHaveBeenCalled();
    expect(useNavigation).not.toHaveBeenCalled();
    expect(loginUser).not.toHaveBeenCalled();
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("shows safe logout failure and keeps Log out available for retry", async () => {
    signOut
      .mockRejectedValueOnce(new Error("marker write failed"))
      .mockResolvedValueOnce(undefined);
    await renderJoinCompany();

    await act(async () => {
      findButton("Log out").props.onPress();
      await flushPromises();
    });
    expect(findFeedback("Could not log out").props.message).toContain(
      "Your session is still active"
    );
    expect(findButton("Log out").props.loading).toBe(false);

    await act(async () => {
      findButton("Log out").props.onPress();
      await flushPromises();
    });
    expect(signOut).toHaveBeenCalledTimes(2);
  });

  it("unlocks after an async rejection and retries exactly once", async () => {
    mockedJoinCompany
      .mockRejectedValueOnce(new ApiError("Temporary join failure", 503))
      .mockResolvedValueOnce(joinedCompany);
    await renderJoinCompany();
    enterJoinCode("retry1");

    await submitJoin();
    expect(findFeedback("Could not join company").props.message).toBe(
      "Temporary join failure"
    );
    expect(findNativeButton("Join company").props.accessibilityState).toEqual({
      busy: false,
      disabled: false
    });

    await submitJoin();
    expect(mockedJoinCompany).toHaveBeenCalledTimes(2);
    expect(applyCompany).toHaveBeenCalledTimes(1);
    expect(refreshCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("routes a synchronous throw through the same finalizer and permits retry", async () => {
    mockedJoinCompany
      .mockImplementationOnce(() => {
        throw new ApiError("Join service unavailable", 503);
      })
      .mockResolvedValueOnce(joinedCompany);
    await renderJoinCompany();
    enterJoinCode("sync1");

    await submitJoin();
    expect(findFeedback("Could not join company").props.message).toBe(
      "Join service unavailable"
    );
    expect(findField().props.editable).toBe(true);
    expect(findNativeButton("Join company").props.accessibilityState).toEqual({
      busy: false,
      disabled: false
    });

    await submitJoin();
    expect(mockedJoinCompany).toHaveBeenCalledTimes(2);
    expect(applyCompany).toHaveBeenCalledTimes(1);
  });

  it("does not apply or refresh when a join resolves after unmount", async () => {
    const request = deferred<Company>();
    mockedJoinCompany.mockReturnValueOnce(request.promise);
    await renderJoinCompany();
    enterJoinCode("late1");

    await act(async () => {
      findButton("Join company").props.onPress();
      await Promise.resolve();
    });
    act(() => rendered!.unmount());
    rendered = null;

    await act(async () => {
      request.resolve(joinedCompany);
      await flushPromises();
    });
    expect(applyCompany).not.toHaveBeenCalled();
    expect(refreshCurrentUser).not.toHaveBeenCalled();
  });

  it("does not inspect or map a rejection after unmount", async () => {
    const request = deferred<Company>();
    const messageGetter = jest.fn(() => "Late join failure");
    const rejection = new Error();
    Object.defineProperty(rejection, "message", {
      configurable: true,
      get: messageGetter
    });
    mockedJoinCompany.mockReturnValueOnce(request.promise);
    await renderJoinCompany();
    enterJoinCode("late2");

    await act(async () => {
      findButton("Join company").props.onPress();
      await Promise.resolve();
    });
    act(() => rendered!.unmount());
    rendered = null;

    await act(async () => {
      request.reject(rejection);
      await flushPromises();
    });
    expect(messageGetter).not.toHaveBeenCalled();
    expect(applyCompany).not.toHaveBeenCalled();
    expect(refreshCurrentUser).not.toHaveBeenCalled();
  });

  it("finishes refresh after a mounted success starts applyCompany even if the gate unmounts", async () => {
    const applied = deferred<User>();
    applyCompany.mockReturnValueOnce(applied.promise);
    await renderJoinCompany();
    enterJoinCode("route1");

    await act(async () => {
      findButton("Join company").props.onPress();
      await flushPromises();
    });
    expect(applyCompany).toHaveBeenCalledWith(joinedCompany);
    expect(refreshCurrentUser).not.toHaveBeenCalled();

    act(() => rendered!.unmount());
    rendered = null;
    await act(async () => {
      applied.resolve(workerAfterJoin);
      await flushPromises();
    });

    expect(refreshCurrentUser).toHaveBeenCalledTimes(1);
  });
});
