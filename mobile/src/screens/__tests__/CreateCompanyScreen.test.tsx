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
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
  type ViewStyle
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCurrentUser, loginUser, registerUser } from "../../api/auth";
import { createCompany } from "../../api/companies";
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
import type { User } from "../../types/auth";
import type { CreateCompanyResponse } from "../../types/company";
import { theme } from "../../utils/theme";
import { CreateCompanyScreen } from "../CreateCompanyScreen";

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
jest.mock("../../api/companies", () => ({ createCompany: jest.fn() }));
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../storage/sessionStorage", () => ({
  clearSession: jest.fn(),
  loadSession: jest.fn(),
  saveSession: jest.fn()
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: jest.fn()
}));

const mockedCreateCompany = jest.mocked(createCompany);
const mockedUseAuth = jest.mocked(useAuth);
const initialWindowDimensions = Dimensions.get("window");
const initialScreenDimensions = Dimensions.get("screen");
const initialPlatformOS = Platform.OS;
const createdCompany: CreateCompanyResponse = {
  currencyLabel: "EUR",
  defaultForemanHourlyRate: null,
  defaultWorkerHourlyRate: null,
  id: 41,
  joinCode: "CMP123",
  name: "Acme Construction",
  timeZone: "Europe/Berlin"
};
const foremanAfterCreate: User = {
  company: createdCompany,
  email: "foreman@example.com",
  firstName: "Fran",
  id: 7,
  lastName: "Foreman",
  role: "FOREMAN"
};

type Deferred<TValue> = {
  promise: Promise<TValue>;
  reject: (reason?: unknown) => void;
  resolve: (value: TValue | PromiseLike<TValue>) => void;
};

type KeyboardEventName = "keyboardDidHide" | "keyboardDidShow";
type KeyboardListener = (event: KeyboardEvent) => void;
type KeyboardSubscriptionRecord = {
  eventName: KeyboardEventName;
  listener: KeyboardListener;
  remove: jest.Mock;
};
type KeyboardEventHarness = {
  addListener: jest.SpyInstance;
  callbacks: Map<KeyboardEventName, KeyboardListener[]>;
  emit: (name: KeyboardEventName, event?: Partial<KeyboardEvent>) => void;
  subscriptions: KeyboardSubscriptionRecord[];
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

function setTestPlatform(os: "android" | "ios"): void {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: os
  });
}

function mockKeyboardEvents(): KeyboardEventHarness {
  const callbacks = new Map<KeyboardEventName, KeyboardListener[]>();
  const subscriptions: KeyboardSubscriptionRecord[] = [];
  const addListener = jest
    .spyOn(Keyboard, "addListener")
    .mockImplementation((name, listener) => {
      const eventName = name as KeyboardEventName;
      const listeners = callbacks.get(eventName) ?? [];
      listeners.push(listener as KeyboardListener);
      callbacks.set(eventName, listeners);
      const remove = jest.fn(() => {
        const registered = callbacks.get(eventName) ?? [];
        callbacks.set(
          eventName,
          registered.filter((callback) => callback !== listener)
        );
      });
      subscriptions.push({
        eventName,
        listener: listener as KeyboardListener,
        remove
      });

      return { remove } as unknown as ReturnType<typeof Keyboard.addListener>;
    });

  return {
    addListener,
    callbacks,
    emit: (name, event) => {
      for (const listener of callbacks.get(name) ?? []) {
        listener(event as KeyboardEvent);
      }
    },
    subscriptions
  };
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

function getFiniteNonNegativeBottomPadding(style: unknown): number {
  const flattened = StyleSheet.flatten(style) as ViewStyle | undefined;
  const value = flattened?.paddingBottom;

  if (value === undefined) {
    return 0;
  }

  expect(typeof value).toBe("number");
  expect(Number.isFinite(value as number)).toBe(true);
  expect(value).toBeGreaterThanOrEqual(0);
  return value as number;
}

function expectFiniteNonNegativeNumericStyleValues(style: unknown): void {
  const flattened = StyleSheet.flatten(style) as ViewStyle | undefined;

  for (const value of Object.values(flattened ?? {})) {
    if (typeof value === "number") {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  }
}

function getCreateCompanyKeyboardListeners(
  keyboard: KeyboardEventHarness
): { hide: KeyboardListener; show: KeyboardListener } {
  const screen = rendered!.root.findByType(Screen);
  const baselineBottomPadding = getFiniteNonNegativeBottomPadding(
    screen.props.scrollContentStyle
  );
  const probeHeight = 287;
  let show: KeyboardListener | undefined;

  for (const listener of keyboard.callbacks.get("keyboardDidShow") ?? []) {
    act(() => {
      listener({
        endCoordinates: { height: probeHeight }
      } as KeyboardEvent);
    });
    if (
      getFiniteNonNegativeBottomPadding(screen.props.scrollContentStyle) ===
      baselineBottomPadding + probeHeight
    ) {
      show = listener;
      break;
    }
  }

  if (!show) {
    throw new Error("Missing CreateCompany keyboardDidShow listener");
  }

  let hide: KeyboardListener | undefined;
  for (const listener of keyboard.callbacks.get("keyboardDidHide") ?? []) {
    act(() => {
      listener({} as KeyboardEvent);
    });
    if (
      getFiniteNonNegativeBottomPadding(screen.props.scrollContentStyle) ===
      baselineBottomPadding
    ) {
      hide = listener;
      break;
    }
  }

  if (!hide) {
    throw new Error("Missing CreateCompany keyboardDidHide listener");
  }

  return { hide, show };
}

function findViewByTestID(testID: string): ReactTestInstance {
  const result = rendered!.root
    .findAllByType(View)
    .find((node) => node.props.testID === testID);
  if (!result) {
    throw new Error("Missing " + testID + " view");
  }
  return result;
}

function findField(label: string): ReactTestInstance {
  const result = rendered!.root
    .findAllByType(FormField)
    .find((node) => node.props.label === label);
  if (!result) {
    throw new Error("Missing " + label + " field");
  }
  return result;
}

function findButton(label: "Create company" | "Log out" | "Settings"): ReactTestInstance {
  const result = rendered!.root
    .findAllByType(Button)
    .find((node) => node.props.label === label);
  if (!result) {
    throw new Error("Missing " + label + " button");
  }
  return result;
}

function findNativeButton(
  label: "Create company" | "Log out" | "Settings"
): ReactTestInstance {
  const result = rendered!.root.findAll(
    (node) =>
      typeof node.type === "string" &&
      node.props.accessible === true &&
      node.props.accessibilityRole === "button" &&
      node.props.accessibilityLabel === label
  )[0];
  if (!result) {
    throw new Error("Missing native " + label + " button");
  }
  return result;
}

function findFeedback(title: string): ReactTestInstance {
  const result = rendered!.root
    .findAllByType(Feedback)
    .find((node) => node.props.title === title);
  if (!result) {
    throw new Error("Missing " + title + " feedback");
  }
  return result;
}

function textValue(node: ReactTestInstance): string | undefined {
  const children = node.props.children as unknown;
  if (typeof children === "string") {
    return children;
  }
  if (Array.isArray(children) && children.every((part) => typeof part === "string")) {
    return children.join("");
  }
  return undefined;
}

function changeField(label: string, value: string): void {
  act(() => {
    findField(label).props.onChangeText(value);
  });
}

function fillRequired(
  name = "Acme Construction",
  currencyLabel = "EUR"
): void {
  act(() => {
    findField("Company name").props.onChangeText(name);
    findField("Currency label").props.onChangeText(currencyLabel);
  });
}

async function submitCreate(): Promise<void> {
  await act(async () => {
    findButton("Create company").props.onPress();
    await flushPromises();
  });
}

async function renderCreateCompany(onOpenSettings?: () => void): Promise<ReactTestRenderer> {
  mockedUseAuth.mockReturnValue({
    applyCompany,
    authenticatedRequest,
    refreshCurrentUser,
    signOut,
    status: "authenticated",
    user: { ...foremanAfterCreate, company: null }
  } as unknown as ReturnType<typeof useAuth>);

  await act(async () => {
    rendered = create(<CreateCompanyScreen onOpenSettings={onOpenSettings} />);
  });
  return rendered!;
}

describe("CreateCompanyScreen", () => {
  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setTestDimensions(411, 891, 1);
    authenticatedRequest.mockImplementation(
      (request: (token: string) => Promise<unknown>) => request("foreman-token")
    );
    applyCompany.mockResolvedValue(foremanAfterCreate);
    refreshCurrentUser.mockResolvedValue(foremanAfterCreate);
    signOut.mockResolvedValue(undefined);
    mockedCreateCompany.mockResolvedValue(createdCompany);
  });

  it("opens Settings without clearing in-progress company onboarding values", async () => {
    const onOpenSettings = jest.fn();
    await renderCreateCompany(onOpenSettings);
    fillRequired("Keep Construction", "грн");
    changeField("Default worker hourly rate", "22.50");

    act(() => void findButton("Settings").props.onPress());

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(findField("Company name").props.value).toBe("Keep Construction");
    expect(findField("Currency label").props.value).toBe("грн");
    expect(findField("Default worker hourly rate").props.value).toBe("22.50");
  });

  afterEach(() => {
    act(() => {
      rendered?.unmount();
    });
    rendered = null;
    jest.restoreAllMocks();
    setTestPlatform(initialPlatformOS as "android" | "ios");
  });

  afterAll(() => {
    Dimensions.set({
      screen: initialScreenDimensions,
      window: initialWindowDimensions
    });
  });

  it("renders the ordered branded foreman onboarding composition without fabricated content", async () => {
    await renderCreateCompany();

    expect(rendered!.root.findAllByType(Screen)).toHaveLength(1);
    expect(rendered!.root.findByType(Screen).props.scroll).toBe(true);
    expect(rendered!.root.findAllByType(Card)).toHaveLength(1);
    expect(rendered!.root.findByType(Card).props.subtle).toBeUndefined();
    expect(rendered!.root.findAllByType(FormField)).toHaveLength(4);
    expect(rendered!.root.findAllByType(Feedback)).toHaveLength(0);
    expect(rendered!.root.findAllByType(Button)).toHaveLength(2);
    expect(
      rendered!.root.findAllByType(FormField).map((node) => node.props.label)
    ).toEqual([
      "Company name",
      "Currency label",
      "Default worker hourly rate",
      "Default foreman hourly rate"
    ]);

    const visibleCopy = rendered!.root
      .findAllByType(Text)
      .map(textValue)
      .filter((value): value is string => value !== undefined);
    const orderedCopy = [
      "ShiftPay",
      "Foreman setup",
      "Create company",
      "Create your company before opening shifts for workers.",
      "Company details",
      "Company name",
      "Currency label",
      "Free-form display text, not an ISO-only currency. ShiftPay does not convert money.",
      "Default rates",
      "Both rates are optional and can be configured later. Without defaults, each new shift needs explicit worker and foreman rates.",
      "Default worker hourly rate",
      "Default foreman hourly rate",
      "Create company",
      "Log out"
    ];
    let previousIndex = -1;
    for (const copy of orderedCopy) {
      const nextIndex = visibleCopy.indexOf(copy, previousIndex + 1);
      expect(nextIndex).toBeGreaterThan(previousIndex);
      previousIndex = nextIndex;
    }

    expect(findField("Company name").props).toMatchObject({
      autoCapitalize: "words",
      leadingIcon: "company",
      placeholder: "Acme Construction"
    });
    expect(findField("Currency label").props).toMatchObject({
      autoCapitalize: "none",
      autoCorrect: false,
      leadingIcon: "wallet",
      placeholder: "EUR, €, долар, грн, 元"
    });
    expect(findField("Default worker hourly rate").props).toMatchObject({
      inputMode: "decimal",
      keyboardType: "decimal-pad",
      leadingIcon: "person",
      placeholder: "Optional"
    });
    expect(findField("Default foreman hourly rate").props).toMatchObject({
      inputMode: "decimal",
      keyboardType: "decimal-pad",
      leadingIcon: "role",
      returnKeyType: "done",
      submitBehavior: "submit"
    });
    expect(findButton("Create company").props.leadingIcon).toBe("create");
    expect(findButton("Log out").props).toMatchObject({
      leadingIcon: "logout",
      variant: "ghost"
    });
    expect(rendered!.root.findAllByType(Image)).toHaveLength(0);
    expect(
      visibleCopy.some((copy) =>
        /dashboard preview|timezone picker|join shift|company search|scan qr|fabricated/iu.test(
          copy
        )
      )
    ).toBe(false);
  });

  it("uses canonical elevated tokens and remains manually scrollable at narrow font scale 1.5", async () => {
    setTestDimensions(280, 568, 1.5);
    await renderCreateCompany();
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
      findViewByTestID("create-company-content").props.style
    ) as ViewStyle;
    const headerStyle = StyleSheet.flatten(
      findViewByTestID("create-company-header").props.style
    ) as ViewStyle;
    const cardStyle = StyleSheet.flatten(
      findViewByTestID("create-company-card").props.style
    ) as ViewStyle;
    const formStyle = StyleSheet.flatten(
      findViewByTestID("create-company-form").props.style
    ) as ViewStyle;
    const detailsStyle = StyleSheet.flatten(
      findViewByTestID("create-company-details-group").props.style
    ) as ViewStyle;
    const ratesStyle = StyleSheet.flatten(
      findViewByTestID("create-company-rates-group").props.style
    ) as ViewStyle;
    const recoveryStyle = StyleSheet.flatten(
      findViewByTestID("create-company-recovery").props.style
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
      gap: theme.space[6],
      maxWidth: "100%"
    });
    for (const groupStyle of [detailsStyle, ratesStyle]) {
      expect(groupStyle).toMatchObject({
        flexShrink: 1,
        gap: theme.space[3],
        maxWidth: "100%"
      });
    }
    expect(recoveryStyle).toMatchObject({
      alignSelf: "stretch",
      flexShrink: 1,
      maxWidth: "100%"
    });

    for (const style of [
      pageStyle,
      headerStyle,
      cardStyle,
      formStyle,
      detailsStyle,
      ratesStyle,
      recoveryStyle
    ]) {
      expect(style).not.toHaveProperty("height");
      expect(style).not.toHaveProperty("maxHeight");
      expect(style.overflow).not.toBe("hidden");
    }
    expect(findNativeButton("Log out")).toBeDefined();
  });

  it("adds exactly 336dp of Android keyboard scroll extent without accumulation and restores baseline on hide", async () => {
    setTestPlatform("android");
    const keyboard = mockKeyboardEvents();
    await renderCreateCompany();
    const screen = rendered!.root.findByType(Screen);
    const scrollView = rendered!.root.findByType(ScrollView);
    const baselineScreenInset = StyleSheet.flatten(
      screen.props.scrollContentStyle
    ) as ViewStyle | undefined;
    const baselineNativeContentStyle = StyleSheet.flatten(
      scrollView.props.contentContainerStyle
    ) as ViewStyle;
    const baselineScreenBottom = getFiniteNonNegativeBottomPadding(
      screen.props.scrollContentStyle
    );
    const baselineNativeBottom = getFiniteNonNegativeBottomPadding(
      scrollView.props.contentContainerStyle
    );

    expect(screen.props.scroll).toBe(true);
    expect(scrollView.props).toMatchObject({
      horizontal: false,
      keyboardShouldPersistTaps: "handled",
      scrollEnabled: true
    });
    expect(baselineScreenInset?.paddingBottom).toBeUndefined();

    act(() => {
      keyboard.emit("keyboardDidShow", {
        endCoordinates: { height: 336 }
      } as Partial<KeyboardEvent>);
    });

    expect(
      getFiniteNonNegativeBottomPadding(screen.props.scrollContentStyle)
    ).toBe(baselineScreenBottom + 336);
    expect(
      getFiniteNonNegativeBottomPadding(scrollView.props.contentContainerStyle)
    ).toBe(baselineNativeBottom + 336);

    act(() => {
      keyboard.emit("keyboardDidShow", {
        endCoordinates: { height: 336 }
      } as Partial<KeyboardEvent>);
    });
    expect(
      getFiniteNonNegativeBottomPadding(screen.props.scrollContentStyle)
    ).toBe(baselineScreenBottom + 336);
    expect(
      getFiniteNonNegativeBottomPadding(scrollView.props.contentContainerStyle)
    ).toBe(baselineNativeBottom + 336);

    act(() => {
      keyboard.emit("keyboardDidHide");
    });
    expect(StyleSheet.flatten(screen.props.scrollContentStyle)).toEqual(
      baselineScreenInset
    );
    expect(StyleSheet.flatten(scrollView.props.contentContainerStyle)).toEqual(
      baselineNativeContentStyle
    );
  });

  it.each([
    ["zero", { endCoordinates: { height: 0 } }],
    ["negative", { endCoordinates: { height: -1 } }],
    ["NaN", { endCoordinates: { height: Number.NaN } }],
    ["Infinity", { endCoordinates: { height: Number.POSITIVE_INFINITY } }],
    ["-Infinity", { endCoordinates: { height: Number.NEGATIVE_INFINITY } }],
    ["missing event", undefined],
    ["missing endCoordinates", {}],
    ["missing height", { endCoordinates: {} }]
  ])(
    "returns Android keyboard styles to baseline for %s height",
    async (_label, event) => {
      setTestPlatform("android");
      const keyboard = mockKeyboardEvents();
      await renderCreateCompany();
      const screen = rendered!.root.findByType(Screen);
      const scrollView = rendered!.root.findByType(ScrollView);
      const baselineScreenInset = StyleSheet.flatten(
        screen.props.scrollContentStyle
      ) as ViewStyle | undefined;
      const baselineNativeContentStyle = StyleSheet.flatten(
        scrollView.props.contentContainerStyle
      ) as ViewStyle;

      act(() => {
        keyboard.emit("keyboardDidShow", {
          endCoordinates: { height: 336 }
        } as Partial<KeyboardEvent>);
        keyboard.emit(
          "keyboardDidShow",
          event as Partial<KeyboardEvent> | undefined
        );
      });

      expect(StyleSheet.flatten(screen.props.scrollContentStyle)).toEqual(
        baselineScreenInset
      );
      expect(StyleSheet.flatten(scrollView.props.contentContainerStyle)).toEqual(
        baselineNativeContentStyle
      );
      expectFiniteNonNegativeNumericStyleValues(
        screen.props.scrollContentStyle
      );
      expectFiniteNonNegativeNumericStyleValues(
        scrollView.props.contentContainerStyle
      );
    }
  );

  it("registers one Android listener pair, avoids rerender duplicates, removes both, and guards stale callbacks", async () => {
    setTestPlatform("android");
    const keyboard = mockKeyboardEvents();
    let baselineScreen!: ReactTestRenderer;
    await act(async () => {
      baselineScreen = create(
        <Screen>
          <View />
        </Screen>
      );
    });
    const baselineDidShowCalls = keyboard.addListener.mock.calls.filter(
      ([name]) => name === "keyboardDidShow"
    ).length;
    const baselineDidHideCalls = keyboard.addListener.mock.calls.filter(
      ([name]) => name === "keyboardDidHide"
    ).length;
    const baselineActiveDidShow =
      keyboard.callbacks.get("keyboardDidShow")?.length ?? 0;
    const baselineActiveDidHide =
      keyboard.callbacks.get("keyboardDidHide")?.length ?? 0;
    act(() => {
      baselineScreen.unmount();
    });
    keyboard.addListener.mockClear();
    keyboard.subscriptions.splice(0);

    await renderCreateCompany();
    const listeners = getCreateCompanyKeyboardListeners(keyboard);
    const showSubscription = keyboard.subscriptions.find(
      ({ eventName, listener }) =>
        eventName === "keyboardDidShow" && listener === listeners.show
    );
    const hideSubscription = keyboard.subscriptions.find(
      ({ eventName, listener }) =>
        eventName === "keyboardDidHide" && listener === listeners.hide
    );

    expect(
      keyboard.addListener.mock.calls.filter(
        ([name]) => name === "keyboardDidShow"
      )
    ).toHaveLength(baselineDidShowCalls + 1);
    expect(
      keyboard.addListener.mock.calls.filter(
        ([name]) => name === "keyboardDidHide"
      )
    ).toHaveLength(baselineDidHideCalls + 1);
    expect(keyboard.callbacks.get("keyboardDidShow")).toHaveLength(
      baselineActiveDidShow + 1
    );
    expect(keyboard.callbacks.get("keyboardDidHide")).toHaveLength(
      baselineActiveDidHide + 1
    );

    const listenerCallCount = keyboard.addListener.mock.calls.length;
    changeField("Company name", "Rerender Company");
    expect(keyboard.addListener).toHaveBeenCalledTimes(listenerCallCount);

    act(() => {
      rendered!.unmount();
    });
    rendered = null;
    expect(showSubscription?.remove).toHaveBeenCalledTimes(1);
    expect(hideSubscription?.remove).toHaveBeenCalledTimes(1);
    expect(keyboard.callbacks.get("keyboardDidShow")).toHaveLength(0);
    expect(keyboard.callbacks.get("keyboardDidHide")).toHaveLength(0);

    const showHeightGetter = jest.fn(() => 336);
    const showCoordinates = {} as KeyboardEvent["endCoordinates"];
    Object.defineProperty(showCoordinates, "height", {
      configurable: true,
      get: showHeightGetter
    });
    const hideHeightGetter = jest.fn(() => 336);
    const hideCoordinates = {} as KeyboardEvent["endCoordinates"];
    Object.defineProperty(hideCoordinates, "height", {
      configurable: true,
      get: hideHeightGetter
    });

    act(() => {
      listeners.show({
        endCoordinates: showCoordinates
      } as KeyboardEvent);
      listeners.hide({
        endCoordinates: hideCoordinates
      } as KeyboardEvent);
    });
    expect(showHeightGetter).not.toHaveBeenCalled();
    expect(hideHeightGetter).not.toHaveBeenCalled();
  });

  it("does not register Android keyboard listeners or add bottom padding on iOS", async () => {
    setTestPlatform("ios");
    const keyboard = mockKeyboardEvents();
    await renderCreateCompany();
    const screen = rendered!.root.findByType(Screen);
    const scrollView = rendered!.root.findByType(ScrollView);
    const baselineNativeContentStyle = StyleSheet.flatten(
      scrollView.props.contentContainerStyle
    );

    expect(
      keyboard.addListener.mock.calls.filter(
        ([name]) => name === "keyboardDidShow" || name === "keyboardDidHide"
      )
    ).toHaveLength(0);
    keyboard.emit("keyboardDidShow", {
      endCoordinates: { height: 336 }
    } as Partial<KeyboardEvent>);
    expect(screen.props.scrollContentStyle).toBeUndefined();
    expect(StyleSheet.flatten(scrollView.props.contentContainerStyle)).toEqual(
      baselineNativeContentStyle
    );
    expect(scrollView.props).toMatchObject({
      keyboardShouldPersistTaps: "handled",
      scrollEnabled: true
    });
  });

  it("provides named fields and actions, a semantic heading, wrapping copy, and decorative icons", async () => {
    await renderCreateCompany();
    const inputs = rendered!.root.findAllByType(TextInput);
    const namedButtons = rendered!.root.findAll(
      (node) =>
        typeof node.type === "string" &&
        node.props.accessible === true &&
        node.props.accessibilityRole === "button"
    );

    expect(inputs).toHaveLength(4);
    expect(inputs.map((input) => input.props.accessibilityLabel)).toEqual([
      "Company name",
      "Currency label",
      "Default worker hourly rate",
      "Default foreman hourly rate"
    ]);
    for (const input of inputs) {
      expect(input.props.allowFontScaling).toBe(true);
      expect(input.props.accessibilityState).toEqual({ disabled: false });
      expect(input.props.maxLength).toBeUndefined();
    }
    expect(namedButtons).toHaveLength(2);
    expect(namedButtons.map((node) => node.props.accessibilityLabel)).toEqual([
      "Create company",
      "Log out"
    ]);
    expect(findNativeButton("Create company").props.accessibilityHint).toBe(
      "Creates this company with the entered settings."
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

    expect(rendered!.root.findAllByType(Ionicons)).toHaveLength(6);
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
      .filter((node) => textValue(node) !== undefined);
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
      visibleText.find(
        (node) =>
          textValue(node) === "Create company" &&
          node.props.accessibilityRole === "header"
      )?.props.accessibilityRole
    ).toBe("header");
  });

  it.each(["", " ", "\t\n  "])(
    "rejects blank company name %p locally without making a request",
    async (value) => {
      await renderCreateCompany();
      fillRequired(value, "EUR");

      await submitCreate();

      expect(findField("Company name").props.error).toBe(
        "Enter a company name."
      );
      expect(authenticatedRequest).not.toHaveBeenCalled();
      expect(mockedCreateCompany).not.toHaveBeenCalled();
    }
  );

  it.each(["", " ", "\u00A0\u3000"])(
    "requires a currency label for boundary-whitespace-only input %p",
    async (value) => {
      await renderCreateCompany();
      fillRequired("Acme", value);

      await submitCreate();

      expect(findField("Currency label").props.error).toBe(
        "Enter a currency label."
      );
      expect(authenticatedRequest).not.toHaveBeenCalled();
      expect(mockedCreateCompany).not.toHaveBeenCalled();
    }
  );

  it("trims only the exact Unicode boundaries and preserves internal Unicode without normalization", async () => {
    await renderCreateCompany();
    fillRequired(
      "  Acme Construction  ",
      "\u00A0e\u0301\u2007EUR\u3000"
    );

    await submitCreate();

    expect(mockedCreateCompany).toHaveBeenCalledWith("foreman-token", {
      currencyLabel: "e\u0301\u2007EUR",
      defaultForemanHourlyRate: undefined,
      defaultWorkerHourlyRate: undefined,
      name: "Acme Construction"
    });
    expect(
      mockedCreateCompany.mock.calls[0]![1].currencyLabel.normalize("NFC")
    ).not.toBe(mockedCreateCompany.mock.calls[0]![1].currencyLabel);
  });

  it("accepts 64 Unicode code points and rejects 65 without issuing a second request", async () => {
    const sixtyFour = "🙂".repeat(64);
    await renderCreateCompany();
    fillRequired("Acme", sixtyFour);

    await submitCreate();
    expect(mockedCreateCompany).toHaveBeenCalledWith(
      "foreman-token",
      expect.objectContaining({ currencyLabel: sixtyFour })
    );

    changeField("Currency label", "🙂".repeat(65));
    await submitCreate();

    expect(findField("Currency label").props.error).toBe(
      "Use 64 Unicode characters or fewer."
    );
    expect(mockedCreateCompany).toHaveBeenCalledTimes(1);
  });

  it("omits both optional blank rates from the create payload", async () => {
    await renderCreateCompany();
    fillRequired();

    await submitCreate();

    expect(mockedCreateCompany).toHaveBeenCalledWith("foreman-token", {
      currencyLabel: "EUR",
      defaultForemanHourlyRate: undefined,
      defaultWorkerHourlyRate: undefined,
      name: "Acme Construction"
    });
  });

  it.each([
    ["0", "", 0, undefined],
    ["", "0", undefined, 0]
  ] as const)(
    "preserves independent zero defaults for worker %p and foreman %p",
    async (workerInput, foremanInput, workerValue, foremanValue) => {
      await renderCreateCompany();
      fillRequired();
      changeField("Default worker hourly rate", workerInput);
      changeField("Default foreman hourly rate", foremanInput);

      await submitCreate();

      expect(mockedCreateCompany).toHaveBeenCalledWith("foreman-token", {
        currencyLabel: "EUR",
        defaultForemanHourlyRate: foremanValue,
        defaultWorkerHourlyRate: workerValue,
        name: "Acme Construction"
      });
    }
  );

  it("parses comma and dot decimal rates through the existing utility contract", async () => {
    await renderCreateCompany();
    fillRequired();
    changeField("Default worker hourly rate", " 12,50 ");
    changeField("Default foreman hourly rate", "30.25");

    await submitCreate();

    expect(mockedCreateCompany).toHaveBeenCalledWith("foreman-token", {
      currencyLabel: "EUR",
      defaultForemanHourlyRate: 30.25,
      defaultWorkerHourlyRate: 12.5,
      name: "Acme Construction"
    });
  });

  it.each(["-1", "1.234", "abc", "100000000000"])(
    "rejects invalid rate format %p through the existing parser",
    async (value) => {
      await renderCreateCompany();
      fillRequired();
      changeField("Default worker hourly rate", value);

      await submitCreate();

      expect(findField("Default worker hourly rate").props.error).toBe(
        "Use a non-negative rate with up to two decimal places."
      );
      expect(mockedCreateCompany).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["name", "Company name", "must not be blank"],
    ["currencyLabel", "Currency label", "must be 64 characters or fewer"],
    [
      "defaultWorkerHourlyRate",
      "Default worker hourly rate",
      "must be non-negative"
    ],
    [
      "defaultForemanHourlyRate",
      "Default foreman hourly rate",
      "must have at most two decimal places"
    ]
  ] as const)(
    "maps backend %s validation beside the correct field",
    async (apiField, label, message) => {
      mockedCreateCompany.mockRejectedValueOnce(
        new ApiError(apiField + ": " + message, 400)
      );
      await renderCreateCompany();
      fillRequired();

      await submitCreate();

      expect(findField(label).props.error).toBe(message);
      expect(rendered!.root.findAllByType(Feedback)).toHaveLength(0);
      expect(findField("Company name").props.value).toBe("Acme Construction");
      expect(findField("Currency label").props.value).toBe("EUR");
    }
  );

  it("retains input and announces a generic backend or network rejection", async () => {
    mockedCreateCompany.mockRejectedValueOnce(
      new ApiError("Company service unavailable", 503)
    );
    await renderCreateCompany();
    fillRequired("Long Foreman Company", "долар");

    await submitCreate();

    expect(findField("Company name").props.value).toBe("Long Foreman Company");
    expect(findField("Currency label").props.value).toBe("долар");
    expect(findFeedback("Could not create company").props).toMatchObject({
      message: "Company service unavailable",
      tone: "error"
    });
    const announcement = findViewByTestID("create-company-error").find(
      (node) =>
        node.props.accessible === true &&
        node.props.accessibilityRole === "alert"
    );
    expect(announcement.props).toMatchObject({
      accessibilityLiveRegion: "assertive",
      accessibilityState: { busy: false }
    });
    expect(announcement.props.accessibilityLabel).toContain(
      "Could not create company"
    );
    expect(announcement.props.accessibilityLabel).toContain(
      "Company service unavailable"
    );
  });

  it("clears the corresponding field error and stale global or success feedback on edit", async () => {
    mockedCreateCompany.mockRejectedValueOnce(
      new ApiError("name: already used", 400)
    );
    await renderCreateCompany();
    fillRequired();
    await submitCreate();
    expect(findField("Company name").props.error).toBe("already used");

    changeField("Company name", "Acme Two");
    expect(findField("Company name").props.error).toBeUndefined();

    mockedCreateCompany.mockRejectedValueOnce(
      new ApiError("Temporary create failure", 503)
    );
    await submitCreate();
    expect(findFeedback("Could not create company").props.message).toBe(
      "Temporary create failure"
    );

    changeField("Currency label", "грн");
    expect(rendered!.root.findAllByType(Feedback)).toHaveLength(0);

    await submitCreate();
    expect(findFeedback("Company ready").props.message).toBe(
      "Company created. Worker join code: CMP123."
    );

    changeField("Default worker hourly rate", "25");
    expect(rendered!.root.findAllByType(Feedback)).toHaveLength(0);
  });

  it("applies the returned company, refreshes afterward, and announces the worker join code", async () => {
    await renderCreateCompany();
    fillRequired();

    await submitCreate();

    expect(authenticatedRequest).toHaveBeenCalledTimes(1);
    expect(mockedCreateCompany).toHaveBeenCalledTimes(1);
    expect(applyCompany).toHaveBeenCalledWith(createdCompany);
    expect(refreshCurrentUser).toHaveBeenCalledTimes(1);
    expect(applyCompany.mock.invocationCallOrder[0]!).toBeLessThan(
      refreshCurrentUser.mock.invocationCallOrder[0]!
    );
    expect(findFeedback("Company ready").props).toMatchObject({
      message: "Company created. Worker join code: CMP123.",
      tone: "success"
    });
    const announcement = findViewByTestID("create-company-success").find(
      (node) =>
        node.props.accessible === true &&
        node.props.accessibilityRole === "text"
    );
    expect(announcement.props).toMatchObject({
      accessibilityLiveRegion: "polite",
      accessibilityState: { busy: false }
    });
    expect(announcement.props.accessibilityLabel).toContain("Company ready");
    expect(announcement.props.accessibilityLabel).toContain(
      "Company created. Worker join code: CMP123."
    );
    expect(useNavigation).not.toHaveBeenCalled();
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("warns on refresh failure without converting successful creation into failure", async () => {
    const refreshError = new Error("refresh unavailable");
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    refreshCurrentUser.mockRejectedValueOnce(refreshError);
    await renderCreateCompany();
    fillRequired();

    await submitCreate();

    expect(applyCompany).toHaveBeenCalledWith(createdCompany);
    expect(refreshCurrentUser).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(
      "Failed to refresh user after company creation.",
      refreshError
    );
    expect(findFeedback("Company ready").props.message).toBe(
      "Company created. Worker join code: CMP123."
    );
    expect(
      rendered!.root
        .findAllByType(Feedback)
        .some((feedback) => feedback.props.tone === "error")
    ).toBe(false);
  });

  it("locks duplicate button and return submissions, disables every control, and suppresses logout while pending", async () => {
    const request = deferred<CreateCompanyResponse>();
    mockedCreateCompany.mockReturnValueOnce(request.promise);
    await renderCreateCompany();
    fillRequired();
    const submit = findButton("Create company").props.onPress;
    const submitFromKeyboard = findField(
      "Default foreman hourly rate"
    ).props.onSubmitEditing;

    await act(async () => {
      submit();
      submitFromKeyboard();
      submit();
      await Promise.resolve();
    });

    expect(authenticatedRequest).toHaveBeenCalledTimes(1);
    expect(mockedCreateCompany).toHaveBeenCalledTimes(1);
    for (const field of rendered!.root.findAllByType(FormField)) {
      expect(field.props.editable).toBe(false);
    }
    for (const input of rendered!.root.findAllByType(TextInput)) {
      expect(input.props).toMatchObject({
        accessibilityState: { disabled: true },
        editable: false
      });
    }
    expect(findButton("Create company").props).toMatchObject({
      disabled: true,
      loading: true
    });
    expect(findNativeButton("Create company").props).toMatchObject({
      accessibilityState: { busy: true, disabled: true },
      focusable: false,
      pointerEvents: "none"
    });
    expect(rendered!.root.findAllByType(ActivityIndicator)).toHaveLength(1);
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
      request.resolve(createdCompany);
      await flushPromises();
    });
    for (const field of rendered!.root.findAllByType(FormField)) {
      expect(field.props.editable).toBe(true);
    }
    expect(findNativeButton("Create company").props.accessibilityState).toEqual({
      busy: false,
      disabled: false
    });
    expect(findNativeButton("Log out").props.accessibilityState).toEqual({
      busy: false,
      disabled: false
    });
  });

  it("delegates one enabled logout tap only to signOut", async () => {
    await renderCreateCompany();

    await act(async () => {
      findButton("Log out").props.onPress();
      await flushPromises();
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(authenticatedRequest).not.toHaveBeenCalled();
    expect(mockedCreateCompany).not.toHaveBeenCalled();
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
    await renderCreateCompany();

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
    mockedCreateCompany
      .mockRejectedValueOnce(new ApiError("Temporary create failure", 503))
      .mockResolvedValueOnce(createdCompany);
    await renderCreateCompany();
    fillRequired();

    await submitCreate();
    expect(findFeedback("Could not create company").props.message).toBe(
      "Temporary create failure"
    );
    expect(findNativeButton("Create company").props.accessibilityState).toEqual({
      busy: false,
      disabled: false
    });

    await submitCreate();
    expect(mockedCreateCompany).toHaveBeenCalledTimes(2);
    expect(applyCompany).toHaveBeenCalledTimes(1);
    expect(refreshCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("routes a synchronous throw through the same finalizer and permits retry", async () => {
    mockedCreateCompany
      .mockImplementationOnce(() => {
        throw new ApiError("Create service unavailable", 503);
      })
      .mockResolvedValueOnce(createdCompany);
    await renderCreateCompany();
    fillRequired();

    await submitCreate();
    expect(findFeedback("Could not create company").props.message).toBe(
      "Create service unavailable"
    );
    for (const field of rendered!.root.findAllByType(FormField)) {
      expect(field.props.editable).toBe(true);
    }
    expect(findNativeButton("Create company").props.accessibilityState).toEqual({
      busy: false,
      disabled: false
    });

    await submitCreate();
    expect(mockedCreateCompany).toHaveBeenCalledTimes(2);
    expect(applyCompany).toHaveBeenCalledTimes(1);
  });

  it("does not inspect, apply, or refresh a successful response after unmount", async () => {
    const request = deferred<CreateCompanyResponse>();
    const joinCodeGetter = jest.fn(() => "CMP123");
    const lateCompany: CreateCompanyResponse = { ...createdCompany };
    Object.defineProperty(lateCompany, "joinCode", {
      configurable: true,
      enumerable: true,
      get: joinCodeGetter
    });
    mockedCreateCompany.mockReturnValueOnce(request.promise);
    await renderCreateCompany();
    fillRequired();

    await act(async () => {
      findButton("Create company").props.onPress();
      await Promise.resolve();
    });
    act(() => rendered!.unmount());
    rendered = null;

    await act(async () => {
      request.resolve(lateCompany);
      await flushPromises();
    });
    expect(joinCodeGetter).not.toHaveBeenCalled();
    expect(applyCompany).not.toHaveBeenCalled();
    expect(refreshCurrentUser).not.toHaveBeenCalled();
  });

  it("does not inspect, map, or update state for a rejection after unmount", async () => {
    const request = deferred<CreateCompanyResponse>();
    const messageGetter = jest.fn(() => "Late create failure");
    const rejection = new Error();
    Object.defineProperty(rejection, "message", {
      configurable: true,
      get: messageGetter
    });
    mockedCreateCompany.mockReturnValueOnce(request.promise);
    await renderCreateCompany();
    fillRequired();

    await act(async () => {
      findButton("Create company").props.onPress();
      await Promise.resolve();
    });
    act(() => rendered!.unmount());
    rendered = null;
    const stateWarning = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await act(async () => {
      request.reject(rejection);
      await flushPromises();
    });
    expect(messageGetter).not.toHaveBeenCalled();
    expect(applyCompany).not.toHaveBeenCalled();
    expect(refreshCurrentUser).not.toHaveBeenCalled();
    expect(stateWarning).not.toHaveBeenCalled();
  });

  it("finishes refresh after a mounted success starts applyCompany even if the gate unmounts", async () => {
    const applied = deferred<User>();
    applyCompany.mockReturnValueOnce(applied.promise);
    await renderCreateCompany();
    fillRequired();

    await act(async () => {
      findButton("Create company").props.onPress();
      await flushPromises();
    });
    expect(applyCompany).toHaveBeenCalledWith(createdCompany);
    expect(refreshCurrentUser).not.toHaveBeenCalled();

    act(() => rendered!.unmount());
    rendered = null;
    await act(async () => {
      applied.resolve(foremanAfterCreate);
      await flushPromises();
    });

    expect(refreshCurrentUser).toHaveBeenCalledTimes(1);
  });
});
