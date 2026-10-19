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
import { ApiError } from "../../api/errors";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Feedback } from "../../components/Feedback";
import { FormField } from "../../components/FormField";
import { Screen } from "../../components/Screen";
import { SegmentedControl } from "../../components/SegmentedControl";
import { useAuth } from "../../context/AuthContext";
import type {
  MobileRegistrationRole,
  RegisterRequest,
  User
} from "../../types/auth";
import { theme } from "../../utils/theme";
import { RegisterScreen } from "../RegisterScreen";

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
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));

const mockedUseAuth = jest.mocked(useAuth);
const initialWindowDimensions = Dimensions.get("window");
const initialScreenDimensions = Dimensions.get("screen");
const initialPlatformOS = Platform.OS;

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
  removers: jest.Mock[];
  subscriptions: KeyboardSubscriptionRecord[];
};
const registeredUser: User = {
  company: null,
  email: "worker@example.com",
  firstName: "John",
  id: 17,
  lastName: "Worker",
  role: "WORKER"
};

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
  for (let step = 0; step < 8; step += 1) {
    await Promise.resolve();
  }
}

function setTestPlatform(os: "android" | "ios"): void {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: os
  });
}

function setTestDimensions(
  width: number,
  height: number,
  fontScale = 1,
  screenHeight = height
): void {
  const window = {
    fontScale,
    height,
    scale: initialWindowDimensions.scale,
    width
  };
  const screen = { ...window, height: screenHeight };

  Dimensions.set({ screen, window });
}

function mockKeyboardEvents(): KeyboardEventHarness {
  const callbacks = new Map<KeyboardEventName, KeyboardListener[]>();
  const removers: jest.Mock[] = [];
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
      removers.push(remove);
      subscriptions.push({
        eventName,
        listener: listener as KeyboardListener,
        remove
      });

      return { remove } as unknown as ReturnType<
        typeof Keyboard.addListener
      >;
    });

  return {
    addListener,
    callbacks,
    emit: (name, event) => {
      for (const listener of callbacks.get(name) ?? []) {
        listener(event as KeyboardEvent);
      }
    },
    removers,
    subscriptions
  };
}

function findViewByTestID(
  rendered: ReactTestRenderer,
  testID: string
): ReactTestInstance {
  const result = rendered.root
    .findAllByType(View)
    .find((node) => node.props.testID === testID);

  if (!result) {
    throw new Error(`Missing ${testID} view`);
  }

  return result;
}

function findField(
  rendered: ReactTestRenderer,
  label: string
): ReactTestInstance {
  const result = rendered.root
    .findAllByType(FormField)
    .find((node) => node.props.label === label);

  if (!result) {
    throw new Error(`Missing ${label} field`);
  }

  return result;
}

function findButton(
  rendered: ReactTestRenderer,
  label: string
): ReactTestInstance {
  const result = rendered.root
    .findAllByType(Button)
    .find((node) => node.props.label === label);

  if (!result) {
    throw new Error(`Missing ${label} button`);
  }

  return result;
}

function findNativeButton(
  rendered: ReactTestRenderer,
  label: string
): ReactTestInstance {
  const result = rendered.root.findAll(
    (node) =>
      node.props.accessibilityRole === "button" &&
      node.props.accessibilityLabel === label &&
      typeof node.props.style === "function"
  )[0];

  if (!result) {
    throw new Error(`Missing native ${label} button`);
  }

  return result;
}

function findNativeAccessibleButton(
  rendered: ReactTestRenderer,
  label: string
): ReactTestInstance {
  const result = rendered.root.findAll(
    (node) =>
      typeof node.type === "string" &&
      node.props.accessible === true &&
      node.props.accessibilityLabel === label
  )[0];

  if (!result) {
    throw new Error(`Missing accessible native ${label} button`);
  }

  return result;
}

function findNativeRadio(
  rendered: ReactTestRenderer,
  label: "Foreman" | "Worker"
): ReactTestInstance {
  const result = rendered.root.findAll(
    (node) =>
      node.props.accessibilityRole === "radio" &&
      node.props.accessibilityLabel === `Role: ${label}`
  )[0];

  if (!result) {
    throw new Error(`Missing ${label} radio`);
  }

  return result;
}

function expectNoFixedOrClippingStyle(style: unknown): void {
  const flattened = StyleSheet.flatten(style) as ViewStyle | undefined;
  expect(flattened).not.toHaveProperty("height");
  expect(flattened).not.toHaveProperty("maxHeight");
  expect(flattened?.overflow).not.toBe("hidden");
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

function getRegisterKeyboardListeners(
  rendered: ReactTestRenderer,
  keyboard: KeyboardEventHarness
): { hide: KeyboardListener; show: KeyboardListener } {
  const screen = rendered.root.findByType(Screen);
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
    throw new Error("Missing Register keyboardDidShow listener");
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
    throw new Error("Missing Register keyboardDidHide listener");
  }

  return { hide, show };
}

describe("RegisterScreen", () => {
  let view: ReactTestRenderer | null = null;
  let authError: string | null;
  let clearError: jest.Mock;
  let goBack: jest.Mock;
  let register: jest.Mock<Promise<User>, [RegisterRequest]>;
  let replace: jest.Mock;

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setTestDimensions(411, 891);
    authError = null;
    clearError = jest.fn(() => {
      authError = null;
    });
    goBack = jest.fn();
    register = jest
      .fn<Promise<User>, [RegisterRequest]>()
      .mockResolvedValue(registeredUser);
    replace = jest.fn();
    mockedUseAuth.mockImplementation(
      () =>
        ({
          clearError,
          error: authError,
          register
        }) as unknown as ReturnType<typeof useAuth>
    );
  });

  afterEach(() => {
    act(() => {
      view?.unmount();
    });
    view = null;
    jest.restoreAllMocks();
    setTestPlatform(initialPlatformOS as "android" | "ios");
  });

  afterAll(() => {
    Dimensions.set({
      screen: initialScreenDimensions,
      window: initialWindowDimensions
    });
  });

  function getScreenProps(
    initialRole?: unknown
  ): ComponentProps<typeof RegisterScreen> {
    return {
      navigation: { goBack, replace },
      route: {
        key: "register",
        name: "Register",
        params:
          initialRole === undefined
            ? undefined
            : { initialRole }
      }
    } as unknown as ComponentProps<typeof RegisterScreen>;
  }

  async function renderRegister(
    initialRole?: unknown
  ): Promise<ReactTestRenderer> {
    const screenProps = getScreenProps(initialRole);

    await act(async () => {
      view = create(<RegisterScreen {...screenProps} />);
    });

    return view!;
  }

  function enterRegistration(
    rendered: ReactTestRenderer,
    values: {
      email?: string;
      firstName?: string;
      lastName?: string;
      password?: string;
    } = {}
  ): void {
    act(() => {
      findField(rendered, "First name").props.onChangeText(
        values.firstName ?? "John"
      );
      findField(rendered, "Last name").props.onChangeText(
        values.lastName ?? "Worker"
      );
      findField(rendered, "Email").props.onChangeText(
        values.email ?? "worker@example.com"
      );
      findField(rendered, "Password").props.onChangeText(
        values.password ?? "password123"
      );
    });
  }

  it("renders the branded grouped Card hierarchy without the Login hero", async () => {
    const rendered = await renderRegister();
    const intro = findViewByTestID(rendered, "register-intro");
    const card = rendered.root.findByType(Card);
    const nativeCard = findViewByTestID(rendered, "register-form-card");
    const form = findViewByTestID(rendered, "register-form-content");
    const title = intro.findByProps({ children: "Create account" });
    const cardStyle = StyleSheet.flatten(nativeCard.props.style);

    expect(rendered.root.findAllByType(Image)).toHaveLength(0);
    expect(rendered.root.findAllByType(Card)).toHaveLength(1);
    expect(card.props.testID).toBe("register-form-card");
    expect(intro.findByProps({ children: "ShiftPay" }).type).toBe(Text);
    expect(title.props).toMatchObject({
      accessibilityRole: "header",
      allowFontScaling: true
    });
    expect(
      rendered.root.findByProps({
        children: "Join ShiftPay as a worker or foreman."
      }).props.allowFontScaling
    ).toBe(true);
    expect(cardStyle).toMatchObject({
      backgroundColor: theme.colors.surface.default,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      borderWidth: theme.border.default,
      padding: theme.padding.card,
      ...theme.elevation.overlay
    });

    const orderedControls = form
      .findAll(
        (node) =>
          node.type === FormField ||
          node.type === SegmentedControl ||
          node.type === Button
      )
      .map((node) => {
        if (node.type === FormField || node.type === Button) {
          return node.props.label;
        }
        return "Role";
      });
    expect(orderedControls).toEqual([
      "First name",
      "Last name",
      "Email",
      "Password",
      "Role",
      "Create account",
      "Back to login"
    ]);
  });

  it("selects only WORKER or FOREMAN with radiogroup checked semantics", async () => {
    const rendered = await renderRegister();
    const group = rendered.root.find(
      (node) =>
        node.props.accessibilityRole === "radiogroup" &&
        node.props.accessibilityLabel === "Role"
    );
    let worker = findNativeRadio(rendered, "Worker");
    let foreman = findNativeRadio(rendered, "Foreman");

    expect(group.props.accessibilityState).toEqual({ disabled: false });
    expect(worker.props.accessibilityState).toEqual({
      checked: true,
      disabled: false
    });
    expect(foreman.props.accessibilityState).toEqual({
      checked: false,
      disabled: false
    });
    expect(
      rendered.root.findAll(
        (node) =>
          node.props.accessibilityRole === "radio" &&
          node.props.accessibilityLabel?.includes("Admin")
      )
    ).toHaveLength(0);

    act(() => {
      foreman.props.onPress();
    });
    worker = findNativeRadio(rendered, "Worker");
    foreman = findNativeRadio(rendered, "Foreman");
    expect(worker.props.accessibilityState.checked).toBe(false);
    expect(foreman.props.accessibilityState.checked).toBe(true);
  });

  it.each<MobileRegistrationRole>(["WORKER", "FOREMAN"])(
    "honors valid initialRole %s",
    async (initialRole) => {
      const rendered = await renderRegister(initialRole);
      expect(rendered.root.findByType(SegmentedControl).props.value).toBe(
        initialRole
      );
    }
  );

  it.each(["ADMIN", "", 17, null, { role: "FOREMAN" }])(
    "falls back to WORKER for invalid runtime initialRole %p",
    async (initialRole) => {
      const rendered = await renderRegister(initialRole);
      expect(rendered.root.findByType(SegmentedControl).props.value).toBe(
        "WORKER"
      );
      expect(findNativeRadio(rendered, "Worker").props.accessibilityState.checked)
        .toBe(true);
    }
  );

  it("shows local validation and does not register invalid values", async () => {
    const rendered = await renderRegister();

    act(() => {
      findButton(rendered, "Create account").props.onPress();
    });

    expect(findField(rendered, "First name").props.error).toBe(
      "Enter your first name."
    );
    expect(findField(rendered, "Last name").props.error).toBe(
      "Enter your last name."
    );
    expect(findField(rendered, "Email").props.error).toBe(
      "Enter a valid email address."
    );
    expect(findField(rendered, "Password").props.error).toBe(
      "Use at least 8 characters."
    );
    expect(register).not.toHaveBeenCalled();
  });

  it("submits trimmed identity/email, exact password, selected role, and replaces Login", async () => {
    const rendered = await renderRegister();
    enterRegistration(rendered, {
      email: "  foreman@example.com  ",
      firstName: "  Niko  ",
      lastName: "  Foreman  ",
      password: "  exact password  "
    });
    act(() => {
      findNativeRadio(rendered, "Foreman").props.onPress();
    });

    await act(async () => {
      findButton(rendered, "Create account").props.onPress();
      await flushPromises();
    });

    expect(clearError).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith({
      email: "foreman@example.com",
      firstName: "Niko",
      lastName: "Foreman",
      password: "  exact password  ",
      role: "FOREMAN"
    });
    expect(replace).toHaveBeenCalledWith("Login");
  });

  it("returns to Login through the existing back behavior", async () => {
    const rendered = await renderRegister();

    act(() => {
      findNativeButton(rendered, "Back to login").props.onPress();
    });

    expect(goBack).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows an exact duplicate-email backend error and preserves values", async () => {
    const duplicateError = new ApiError(
      "User with email already exists: worker@example.com",
      409
    );
    register.mockRejectedValueOnce(duplicateError);
    const rendered = await renderRegister();
    enterRegistration(rendered);

    await act(async () => {
      findButton(rendered, "Create account").props.onPress();
      await flushPromises();
    });

    expect(rendered.root.findByType(Feedback).props).toMatchObject({
      message: "User with email already exists: worker@example.com",
      title: "Registration failed",
      tone: "error"
    });
    expect(findField(rendered, "First name").props.value).toBe("John");
    expect(findField(rendered, "Last name").props.value).toBe("Worker");
    expect(findField(rendered, "Email").props.value).toBe(
      "worker@example.com"
    );
    expect(findField(rendered, "Password").props.value).toBe("password123");
    expect(findNativeButton(rendered, "Create account").props.disabled).toBe(
      false
    );
  });

  it("clears stale auth feedback, handles network rejection, unlocks, and retries", async () => {
    authError = "Previous registration error";
    const request = deferred<User>();
    const networkError = new ApiError(
      "Network error. Check your connection and backend URL.",
      0
    );
    register.mockReturnValueOnce(request.promise);
    const rendered = await renderRegister();
    enterRegistration(rendered, {
      email: "network@example.com",
      password: "kept password"
    });
    expect(rendered.root.findByType(Feedback).props.message).toBe(
      "Previous registration error"
    );

    await act(async () => {
      findButton(rendered, "Create account").props.onPress();
      await Promise.resolve();
    });
    expect(clearError).toHaveBeenCalledTimes(1);
    expect(clearError.mock.invocationCallOrder[0]!).toBeLessThan(
      register.mock.invocationCallOrder[0]!
    );
    await act(async () => {
      rendered.update(<RegisterScreen {...getScreenProps()} />);
    });
    expect(rendered.root.findAllByType(Feedback)).toHaveLength(0);
    expect(findNativeButton(rendered, "Create account").props).toMatchObject({
      accessibilityState: { busy: true, disabled: true }
    });

    await act(async () => {
      request.reject(networkError);
      await flushPromises();
    });

    expect(rendered.root.findByType(Feedback).props.message).toBe(
      "Network error. Check your connection and backend URL."
    );
    expect(findField(rendered, "Email").props.value).toBe(
      "network@example.com"
    );
    expect(findField(rendered, "Password").props.value).toBe("kept password");
    const retry = findNativeButton(rendered, "Create account");
    expect(retry.props).toMatchObject({
      accessibilityState: { busy: false, disabled: false },
      disabled: false
    });
    expect(typeof retry.props.onPress).toBe("function");

    await act(async () => {
      retry.props.onPress();
      await flushPromises();
    });
    expect(register).toHaveBeenCalledTimes(2);
    expect(register).toHaveBeenLastCalledWith({
      email: "network@example.com",
      firstName: "John",
      lastName: "Worker",
      password: "kept password",
      role: "WORKER"
    });
    expect(replace).toHaveBeenCalledWith("Login");
  });

  it("catches a synchronous register throw, finalizes, and permits retry", async () => {
    register.mockImplementationOnce(() => {
      throw new ApiError("Registration service unavailable.", 503);
    });
    const rendered = await renderRegister();
    enterRegistration(rendered);

    await act(async () => {
      findButton(rendered, "Create account").props.onPress();
      await flushPromises();
    });

    expect(rendered.root.findByType(Feedback).props.message).toBe(
      "Registration service unavailable."
    );
    const retry = findNativeButton(rendered, "Create account");
    expect(retry.props.disabled).toBe(false);
    expect(typeof retry.props.onPress).toBe("function");

    await act(async () => {
      retry.props.onPress();
      await flushPromises();
    });
    expect(register).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledWith("Login");
  });

  it("blocks duplicate pending registration and exposes native busy state", async () => {
    setTestPlatform("android");
    const request = deferred<User>();
    register.mockReturnValueOnce(request.promise);
    const rendered = await renderRegister();
    enterRegistration(rendered);
    const submit = findButton(rendered, "Create account").props.onPress;

    await act(async () => {
      submit();
      submit();
      await Promise.resolve();
    });

    expect(register).toHaveBeenCalledTimes(1);
    expect(findButton(rendered, "Create account").props.loading).toBe(true);
    const nativeSubmit = findNativeAccessibleButton(rendered, "Create account");
    expect(nativeSubmit.props).toMatchObject({
      accessibilityLabel: "Create account",
      accessibilityRole: "button",
      accessibilityState: { busy: true, disabled: true },
      focusable: false,
      pointerEvents: "none",
      role: "button"
    });
    expect(nativeSubmit.props.accessibilityLiveRegion).toBeUndefined();
    expect(typeof nativeSubmit.type).toBe("string");
    expect(nativeSubmit.props.onPress).toBeUndefined();
    const submitContract = findNativeButton(rendered, "Create account");
    expect(submitContract.props).toMatchObject({
      disabled: true,
      focusable: false,
      onPress: undefined
    });
    await act(async () => {
      nativeSubmit.props.onClick({ currentTarget: 1, nativeEvent: {}, target: 1 });
    });
    expect(register).toHaveBeenCalledTimes(1);
    expect(
      rendered.root.findAll(
        (node) => node.props.accessibilityRole === "progressbar"
      )
    ).toHaveLength(0);
    expect(
      nativeSubmit.findAll(
        (node) => node.type === Text && node.props.children === "Create account"
      ).length
    ).toBeGreaterThan(0);
    expect(findField(rendered, "First name").props.editable).toBe(false);
    expect(findField(rendered, "Password").props.editable).toBe(false);
    expect(rendered.root.findByType(SegmentedControl).props.disabled).toBe(true);
    expect(findField(rendered, "Password").props.value).toBe("password123");
    expect(typeof findNativeButton(rendered, "Back to login").props.onPress)
      .toBe("function");

    await act(async () => {
      request.resolve(registeredUser);
      await flushPromises();
    });
    expect(findButton(rendered, "Create account").props.loading).toBe(false);
    expect(replace).toHaveBeenCalledWith("Login");
  });

  it("does not navigate or update the unmounted screen after async completion", async () => {
    const request = deferred<User>();
    register.mockReturnValueOnce(request.promise);
    const rendered = await renderRegister();
    enterRegistration(rendered);

    await act(async () => {
      findButton(rendered, "Create account").props.onPress();
      await Promise.resolve();
    });
    expect(register).toHaveBeenCalledTimes(1);

    act(() => {
      rendered.unmount();
    });
    view = null;

    await act(async () => {
      request.resolve(registeredUser);
      await flushPromises();
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not inspect a registration rejection after unmount", async () => {
    const request = deferred<User>();
    const messageGetter = jest.fn(() => "Late registration failure.");
    const rejection = new Error();
    Object.defineProperty(rejection, "message", {
      configurable: true,
      get: messageGetter
    });
    register.mockReturnValueOnce(request.promise);
    const rendered = await renderRegister();
    enterRegistration(rendered);

    await act(async () => {
      findButton(rendered, "Create account").props.onPress();
      await Promise.resolve();
    });
    expect(register).toHaveBeenCalledTimes(1);

    act(() => {
      rendered.unmount();
    });
    view = null;

    await act(async () => {
      request.reject(rejection);
      await flushPromises();
    });

    expect(messageGetter).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(goBack).not.toHaveBeenCalled();
  });

  it("keeps autofill, field labels, radio state, and named controls accessible", async () => {
    const rendered = await renderRegister();
    expect(findField(rendered, "First name").props).toMatchObject({
      autoComplete: "given-name",
      leadingIcon: "person",
      textContentType: "givenName"
    });
    expect(findField(rendered, "Last name").props).toMatchObject({
      autoComplete: "family-name",
      leadingIcon: "person",
      textContentType: "familyName"
    });
    expect(findField(rendered, "Email").props).toMatchObject({
      autoComplete: "email",
      leadingIcon: "email",
      textContentType: "emailAddress"
    });
    expect(findField(rendered, "Password").props).toMatchObject({
      autoComplete: "new-password",
      leadingIcon: "password",
      secureTextEntry: true,
      textContentType: "newPassword"
    });
    for (const label of ["First name", "Last name", "Email", "Password"]) {
      expect(
        rendered.root.findAllByType(TextInput).find(
          (input) => input.props.accessibilityLabel === label
        )?.props.accessibilityState
      ).toEqual({ disabled: false });
    }
    for (const node of rendered.root.findAll(
      (candidate) =>
        candidate.props.accessibilityRole === "button" ||
        candidate.props.accessibilityRole === "radio"
    )) {
      expect(typeof node.props.accessibilityLabel).toBe("string");
      expect(node.props.accessibilityLabel.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps narrow and scaled content flexible without clipping", async () => {
    setTestDimensions(320, 640, 1.5);
    const rendered = await renderRegister();
    const responsiveContainers = [
      findViewByTestID(rendered, "register-content"),
      findViewByTestID(rendered, "register-intro"),
      findViewByTestID(rendered, "register-form-card"),
      findViewByTestID(rendered, "register-form-content"),
      findViewByTestID(rendered, "register-identity-group"),
      findViewByTestID(rendered, "register-account-group"),
      findViewByTestID(rendered, "register-role-group"),
      findViewByTestID(rendered, "register-actions")
    ];

    for (const container of responsiveContainers) {
      expectNoFixedOrClippingStyle(container.props.style);
    }
    for (const copy of [
      "ShiftPay",
      "Create account",
      "Join ShiftPay as a worker or foreman.",
      "Your details",
      "Account",
      "Role",
      "Choose how you will use ShiftPay."
    ]) {
      const node = rendered.root
        .findAllByType(Text)
        .find(
          (candidate) =>
            candidate.props.children === copy &&
            (copy !== "Create account" ||
              candidate.props.accessibilityRole === "header")
        );
      expect(node).toBeDefined();
      expect(node!.props.allowFontScaling).toBe(true);
      expect(node!.props.numberOfLines).toBeUndefined();
      expect(node!.props.ellipsizeMode).toBeUndefined();
    }
    expect(rendered.root.findByType(SegmentedControl).props.wrap).toBe(true);
    expect(rendered.root.findByType(ScrollView).props).toMatchObject({
      horizontal: false,
      keyboardShouldPersistTaps: "handled",
      scrollEnabled: true
    });
  });

  it("adds and removes exactly 336dp of Android keyboard scroll extent from baseline", async () => {
    setTestPlatform("android");
    const keyboard = mockKeyboardEvents();
    const rendered = await renderRegister();
    const screen = rendered.root.findByType(Screen);
    const scrollView = rendered.root.findByType(ScrollView);
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

    expect(baselineScreenInset?.paddingBottom).toBeUndefined();
    expectFiniteNonNegativeNumericStyleValues(screen.props.scrollContentStyle);
    expectFiniteNonNegativeNumericStyleValues(
      scrollView.props.contentContainerStyle
    );

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
    expect(scrollView.props).toMatchObject({
      keyboardShouldPersistTaps: "handled",
      scrollEnabled: true
    });

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
    ["missing coordinates", {}],
    ["missing height", { endCoordinates: {} }]
  ])(
    "returns Android keyboard styles to baseline for %s height",
    async (_label, event) => {
      setTestPlatform("android");
      const keyboard = mockKeyboardEvents();
      const rendered = await renderRegister();
      const screen = rendered.root.findByType(Screen);
      const scrollView = rendered.root.findByType(ScrollView);
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
        keyboard.emit("keyboardDidShow", event as Partial<KeyboardEvent>);
      });

      expect(StyleSheet.flatten(screen.props.scrollContentStyle)).toEqual(
        baselineScreenInset
      );
      expect(StyleSheet.flatten(scrollView.props.contentContainerStyle)).toEqual(
        baselineNativeContentStyle
      );
      expectFiniteNonNegativeNumericStyleValues(
        scrollView.props.contentContainerStyle
      );
    }
  );

  it("handles an actual undefined Android keyboard event at baseline", async () => {
    setTestPlatform("android");
    const keyboard = mockKeyboardEvents();
    const rendered = await renderRegister();
    const screen = rendered.root.findByType(Screen);
    const scrollView = rendered.root.findByType(ScrollView);
    const baselineScreenInset = StyleSheet.flatten(
      screen.props.scrollContentStyle
    ) as ViewStyle | undefined;
    const baselineNativeContentStyle = StyleSheet.flatten(
      scrollView.props.contentContainerStyle
    ) as ViewStyle;
    const { show } = getRegisterKeyboardListeners(rendered, keyboard);

    act(() => {
      show(undefined as unknown as KeyboardEvent);
    });

    expect(StyleSheet.flatten(screen.props.scrollContentStyle)).toEqual(
      baselineScreenInset
    );
    expect(StyleSheet.flatten(scrollView.props.contentContainerStyle)).toEqual(
      baselineNativeContentStyle
    );
  });

  it("registers one Android listener pair, avoids rerender duplicates, and guards stale callbacks", async () => {
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
    keyboard.removers.splice(0);
    keyboard.subscriptions.splice(0);

    const rendered = await renderRegister();
    const listeners = getRegisterKeyboardListeners(rendered, keyboard);
    const registerShowSubscription = keyboard.subscriptions.find(
      ({ eventName, listener }) =>
        eventName === "keyboardDidShow" && listener === listeners.show
    );
    const registerHideSubscription = keyboard.subscriptions.find(
      ({ eventName, listener }) =>
        eventName === "keyboardDidHide" && listener === listeners.hide
    );
    const didShowCalls = keyboard.addListener.mock.calls.filter(
      ([name]) => name === "keyboardDidShow"
    );
    const didHideCalls = keyboard.addListener.mock.calls.filter(
      ([name]) => name === "keyboardDidHide"
    );
    const initialListenerCalls = keyboard.addListener.mock.calls.length;

    expect(didShowCalls).toHaveLength(baselineDidShowCalls + 1);
    expect(didHideCalls).toHaveLength(baselineDidHideCalls + 1);
    expect(keyboard.callbacks.get("keyboardDidShow")).toHaveLength(
      baselineActiveDidShow + 1
    );
    expect(keyboard.callbacks.get("keyboardDidHide")).toHaveLength(
      baselineActiveDidHide + 1
    );

    act(() => {
      findField(rendered, "First name").props.onChangeText("Rerender");
    });
    expect(keyboard.addListener).toHaveBeenCalledTimes(initialListenerCalls);

    act(() => {
      rendered.unmount();
    });
    view = null;
    expect(registerShowSubscription?.remove).toHaveBeenCalledTimes(1);
    expect(registerHideSubscription?.remove).toHaveBeenCalledTimes(1);
    for (const remove of keyboard.removers) {
      expect(remove).toHaveBeenCalledTimes(1);
    }
    expect(keyboard.callbacks.get("keyboardDidShow")).toHaveLength(0);
    expect(keyboard.callbacks.get("keyboardDidHide")).toHaveLength(0);

    const heightGetter = jest.fn(() => 336);
    const endCoordinates = {} as KeyboardEvent["endCoordinates"];
    Object.defineProperty(endCoordinates, "height", {
      configurable: true,
      get: heightGetter
    });
    act(() => {
      listeners.show({ endCoordinates } as KeyboardEvent);
    });
    expect(heightGetter).not.toHaveBeenCalled();
  });

  it("does not add Register keyboard listeners or duplicate padding on iOS", async () => {
    setTestPlatform("ios");
    const keyboard = mockKeyboardEvents();
    const rendered = await renderRegister();
    const screen = rendered.root.findByType(Screen);
    const scrollView = rendered.root.findByType(ScrollView);
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
  });
});
