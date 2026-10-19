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
  type ImageStyle,
  type ImageSourcePropType,
  type KeyboardEvent,
  type ViewStyle
} from "react-native";
import { ApiError } from "../../api/errors";
import { AppIcon } from "../../components/AppIcon";
import { Button } from "../../components/Button";
import { FormField } from "../../components/FormField";
import { Screen } from "../../components/Screen";
import { StateMessage } from "../../components/StateMessage";
import { useAuth } from "../../context/AuthContext";
import type { LoginRequest } from "../../types/auth";
import { theme } from "../../utils/theme";
import { LoginScreen } from "../LoginScreen";

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

const approvedHero = require(
  "../../../assets/images/login-hero.png"
) as ImageSourcePropType;
const approvedHeroPath = (
  require as typeof require & { resolve: (path: string) => string }
).resolve("../../../assets/images/login-hero.png");
const approvedHeroSha256 =
  "0082ebe6add3c50366ce4677236b874f3686b8e8c0ffc6171b3838b48ac33f9e";
const nodeCrypto = jest.requireActual("crypto") as {
  createHash: (algorithm: string) => {
    update: (content: unknown) => { digest: (encoding: "hex") => string };
  };
};
const nodeFs = jest.requireActual("fs") as {
  readFileSync: (path: string) => unknown;
};
const mockedUseAuth = jest.mocked(useAuth);
const initialWindowDimensions = Dimensions.get("window");
const initialScreenDimensions = Dimensions.get("screen");
const initialPlatformOS = Platform.OS;

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

function setTestPlatform(os: "android" | "ios"): void {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: os
  });
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

type Deferred<TValue> = {
  promise: Promise<TValue>;
  reject: (reason?: unknown) => void;
  resolve: (value: TValue | PromiseLike<TValue>) => void;
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

function findField(
  view: ReactTestRenderer,
  label: string
): ReactTestInstance {
  const result = view.root
    .findAllByType(FormField)
    .find((node) => node.props.label === label);

  if (!result) {
    throw new Error(`Missing ${label} field`);
  }

  return result;
}

function findButton(
  view: ReactTestRenderer,
  label: string
): ReactTestInstance {
  const result = view.root
    .findAllByType(Button)
    .find((node) => node.props.label === label);

  if (!result) {
    throw new Error(`Missing ${label} button`);
  }

  return result;
}

function findNativeButton(
  view: ReactTestRenderer,
  label: string
): ReactTestInstance {
  const result = view.root.findAll(
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

function findViewByTestID(
  view: ReactTestRenderer,
  testID: string
): ReactTestInstance {
  const result = view.root
    .findAllByType(View)
    .find((node) => node.props.testID === testID);

  if (!result) {
    throw new Error(`Missing ${testID} view`);
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

function getLoginKeyboardListeners(
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
    throw new Error("Missing Login keyboardDidShow listener");
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
    throw new Error("Missing Login keyboardDidHide listener");
  }

  return { hide, show };
}

function getHeroGeometry(view: ReactTestRenderer): {
  image: ImageStyle;
  stage: ViewStyle;
} {
  return {
    image: StyleSheet.flatten(
      view.root.findByType(Image).props.style
    ) as ImageStyle,
    stage: StyleSheet.flatten(
      findViewByTestID(view, "login-hero-stage").props.style
    ) as ViewStyle
  };
}

function expectFinitePositiveGeometry(
  geometry: ReturnType<typeof getHeroGeometry>
): void {
  for (const value of [
    geometry.stage.minHeight,
    geometry.image.width,
    geometry.image.height
  ]) {
    expect(typeof value).toBe("number");
    expect(Number.isFinite(value as number)).toBe(true);
    expect(value).toBeGreaterThan(0);
  }
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

describe("LoginScreen", () => {
  let view: ReactTestRenderer | null = null;
  let navigate: jest.Mock;
  let clearError: jest.Mock;
  let signIn: jest.Mock<Promise<void>, [LoginRequest]>;
  let authError: string | null;

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setTestDimensions(411, 891);
    navigate = jest.fn();
    authError = null;
    clearError = jest.fn(() => {
      authError = null;
    });
    signIn = jest.fn<Promise<void>, [LoginRequest]>().mockResolvedValue(undefined);
    mockedUseAuth.mockImplementation(
      () =>
        ({
          clearError,
          error: authError,
          signIn
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

  async function renderLogin(): Promise<ReactTestRenderer> {
    const screenProps = {
      navigation: { navigate },
      route: { key: "login", name: "Login" }
    } as unknown as ComponentProps<typeof LoginScreen>;

    await act(async () => {
      view = create(<LoginScreen {...screenProps} />);
    });

    return view!;
  }

  function enterCredentials(
    rendered: ReactTestRenderer,
    email: string,
    password: string
  ): void {
    act(() => {
      findField(rendered, "Email").props.onChangeText(email);
      findField(rendered, "Password").props.onChangeText(password);
    });
  }

  it("renders the approved decorative hero and exact welcome hierarchy", async () => {
    const rendered = await renderLogin();
    const hero = rendered.root.findByType(Image);
    const title = rendered.root.findByProps({ children: "Welcome back" });
    const subtitle = rendered.root.findByProps({
      children: "Sign in to manage your shifts and payroll."
    });

    expect(hero.props).toMatchObject({
      accessibilityElementsHidden: true,
      accessible: false,
      "aria-hidden": true,
      importantForAccessibility: "no-hide-descendants",
      resizeMode: "cover",
      source: approvedHero,
      testID: "login-hero"
    });
    expect(
      rendered.root.findAll(
        (node) => node.props.accessibilityRole === "image"
      )
    ).toHaveLength(0);
    expect(rendered.root.findByProps({ children: "ShiftPay" }).type).toBe(Text);
    expect(title.props).toMatchObject({
      accessibilityRole: "header",
      allowFontScaling: true
    });
    expect(subtitle.props.allowFontScaling).toBe(true);
    expect(title.props.numberOfLines).toBeUndefined();
    expect(subtitle.props.numberOfLines).toBeUndefined();
    expect(title.props.ellipsizeMode).toBeUndefined();
    expect(subtitle.props.ellipsizeMode).toBeUndefined();
  });

  it("keeps the production hero byte-identical to the approved checksum", () => {
    const actualSha256 = nodeCrypto
      .createHash("sha256")
      .update(nodeFs.readFileSync(approvedHeroPath))
      .digest("hex");

    expect(actualSha256).toBe(approvedHeroSha256);
  });

  it("layers the larger intro over an unframed hero before the form Card", async () => {
    const rendered = await renderLogin();
    const screen = rendered.root.findByType(Screen);
    const stage = findViewByTestID(rendered, "login-hero-stage");
    const stageStyle = StyleSheet.flatten(stage.props.style);
    const surface = findViewByTestID(rendered, "login-form-card");
    const surfaceStyle = StyleSheet.flatten(surface.props.style);
    const hero = rendered.root.findByType(Image);
    const heroStyle = StyleSheet.flatten(hero.props.style);
    const intro = findViewByTestID(rendered, "login-intro");
    const form = findViewByTestID(rendered, "login-form-content");
    const page = findViewByTestID(rendered, "login-content");
    const responsiveWrappers = [
      page,
      intro,
      surface,
      form,
      findViewByTestID(rendered, "login-divider")
    ];

    expect(StyleSheet.flatten(screen.props.contentStyle)).toMatchObject({
      paddingHorizontal: 0
    });
    expectNoFixedOrClippingStyle(screen.props.contentStyle);
    expect(StyleSheet.flatten(intro.props.style)).toMatchObject({
      paddingHorizontal: theme.inset.screen
    });
    expect(StyleSheet.flatten(intro.props.style).position).toBeUndefined();
    expect(intro.findAllByType(Image)).toHaveLength(0);
    expect(stageStyle).toMatchObject({
      maxWidth: "100%",
      minHeight: 411 * 0.88,
      width: "100%"
    });
    expect(stage.findAllByType(Image)).toHaveLength(1);
    expect(stage.findAllByType(Text).map((node) => node.props.children)).toEqual(
      expect.arrayContaining([
        "ShiftPay",
        "Welcome back",
        "Sign in to manage your shifts and payroll."
      ])
    );
    expect(surface.findAllByType(Image)).toHaveLength(0);
    expect(rendered.root.findAllByType(Image)).toHaveLength(1);
    const hierarchyIds = new Set([
      "login-hero-stage",
      "login-form-card"
    ]);
    const sectionOrder = page
      .findAllByType(View)
      .map((node) => node.props.testID)
      .filter(
        (testID): testID is string =>
          typeof testID === "string" && hierarchyIds.has(testID)
      )
      .filter((testID, index, values) => values.indexOf(testID) === index);
    expect(sectionOrder).toEqual([
      "login-hero-stage",
      "login-form-card"
    ]);
    expect(
      StyleSheet.flatten(
        rendered.root.findByProps({ children: "ShiftPay" }).props.style
      )
    ).toMatchObject({ fontSize: theme.typography.screenTitle.fontSize });
    expect(
      StyleSheet.flatten(
        rendered.root.findByProps({ children: "Welcome back" }).props.style
      )
    ).toMatchObject({ fontSize: theme.typography.display.fontSize });
    expect(
      StyleSheet.flatten(
        rendered.root.findByProps({
          children: "Sign in to manage your shifts and payroll."
        }).props.style
      )
    ).toMatchObject({ fontSize: theme.typography.sectionTitle.fontSize });
    expect(surfaceStyle).toMatchObject({
      backgroundColor: theme.colors.surface.default,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      borderWidth: theme.border.default,
      marginHorizontal: theme.inset.screen,
      marginTop: -theme.space[4],
      padding: theme.padding.card,
      ...theme.elevation.overlay
    });
    expect(surfaceStyle.marginTop).toBeLessThan(0);
    expect(heroStyle).toMatchObject({
      bottom: 0,
      height: 411 * (198 / 300),
      left: 0,
      position: "absolute",
      pointerEvents: "none",
      width: 411
    });
    expect(heroStyle.maxHeight).toBeUndefined();
    expect(heroStyle.aspectRatio).toBeUndefined();
    for (const frameProperty of [
      "backgroundColor",
      "borderColor",
      "borderRadius",
      "borderWidth",
      "elevation",
      "shadowColor",
      "shadowOffset",
      "shadowOpacity",
      "shadowRadius"
    ]) {
      expect(heroStyle).not.toHaveProperty(frameProperty);
      expect(stageStyle).not.toHaveProperty(frameProperty);
    }
    expect(heroStyle.overflow).not.toBe("hidden");
    expect(heroStyle.height as number).toBeLessThan(
      stageStyle.minHeight as number
    );
    for (const wrapper of responsiveWrappers) {
      expectNoFixedOrClippingStyle(wrapper.props.style);
    }

    const visibleCopy = [
      "Welcome back",
      "Sign in to manage your shifts and payroll.",
      "or"
    ];
    for (const copy of visibleCopy) {
      const node = rendered.root.findByProps({ children: copy });
      expect(node.props.numberOfLines).toBeUndefined();
      expect(node.props.ellipsizeMode).toBeUndefined();
      expectNoFixedOrClippingStyle(node.props.style);
    }

    const scrollView = rendered.root.findByType(ScrollView);
    expect(scrollView.props).toMatchObject({
      horizontal: false,
      keyboardShouldPersistTaps: "handled",
      scrollEnabled: true
    });
    expect(StyleSheet.flatten(scrollView.props.contentContainerStyle)).toMatchObject({
      flexGrow: 1
    });

    const orderedFormContent = form
      .findAll(
        (node) =>
          node.type === FormField ||
          node.type === Button ||
          (node.type === Text && node.props.children === "or")
      )
      .map((node) =>
        node.type === FormField || node.type === Button
          ? node.props.label
          : "or"
      );
    expect(orderedFormContent).toEqual([
      "Email",
      "Password",
      "Log in",
      "or",
      "Create account"
    ]);
  });

  it.each([
    {
      expectedImageHeight: 240 * (198 / 300),
      expectedStageHeight: 264,
      label: "minimum stage",
      width: 240
    },
    {
      expectedImageHeight: 360 * (198 / 300),
      expectedStageHeight: 360 * 0.88,
      label: "proportional stage",
      width: 360
    },
    {
      expectedImageHeight: 500 * (198 / 300),
      expectedStageHeight: 363,
      label: "maximum stage",
      width: 500
    },
    {
      expectedImageHeight: 363,
      expectedStageHeight: 363,
      label: "wide image-height cap",
      width: 600
    }
  ])(
    "renders finite positive hero geometry for the $label branch",
    async ({ expectedImageHeight, expectedStageHeight, width }) => {
      setTestDimensions(width, 891);
      const rendered = await renderLogin();
      const geometry = getHeroGeometry(rendered);

      expect(geometry.stage).toMatchObject({
        maxWidth: "100%",
        minHeight: expectedStageHeight,
        width: "100%"
      });
      expect(geometry.image).toMatchObject({
        bottom: 0,
        height: expectedImageHeight,
        width
      });
      expect(geometry.image.height as number).toBeLessThanOrEqual(
        geometry.stage.minHeight as number
      );
      expectFinitePositiveGeometry(geometry);
    }
  );

  it.each([0, -100, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "uses the deterministic phone-width fallback for malformed width %s",
    async (width) => {
      setTestDimensions(width, 891);
      const rendered = await renderLogin();
      const geometry = getHeroGeometry(rendered);

      expect(geometry.stage.minHeight).toBeCloseTo(316.8);
      expect(geometry.image.width).toBe(360);
      expect(geometry.image.height).toBeCloseTo(237.6);
      expectFinitePositiveGeometry(geometry);
    }
  );

  it("updates rendered hero geometry across minimum, proportional, and wide branches", async () => {
    setTestDimensions(240, 640);
    const rendered = await renderLogin();

    let geometry = getHeroGeometry(rendered);
    expect(geometry.stage.minHeight).toBe(264);
    expect(geometry.image).toMatchObject({
      height: 240 * (198 / 300),
      width: 240
    });

    act(() => {
      setTestDimensions(360, 720);
    });
    geometry = getHeroGeometry(rendered);
    expect(geometry.stage.minHeight).toBeCloseTo(316.8);
    expect(geometry.image).toMatchObject({
      height: 360 * (198 / 300),
      width: 360
    });

    act(() => {
      setTestDimensions(600, 900);
    });
    geometry = getHeroGeometry(rendered);
    expect(geometry.stage.minHeight).toBe(363);
    expect(geometry.image).toMatchObject({ height: 363, width: 600 });
    expectFinitePositiveGeometry(geometry);
  });

  it("keeps unit-testable font-scaling and content-safe layout contracts", async () => {
    setTestDimensions(411, 891, 1.5);
    const rendered = await renderLogin();
    const intro = findViewByTestID(rendered, "login-intro");
    const stage = findViewByTestID(rendered, "login-hero-stage");
    const geometry = getHeroGeometry(rendered);
    const introText = [
      "ShiftPay",
      "Welcome back",
      "Sign in to manage your shifts and payroll."
    ].map((children) => rendered.root.findByProps({ children }));

    for (const text of introText) {
      expect(text.props.allowFontScaling).toBe(true);
      expect(text.props.numberOfLines).toBeUndefined();
      expect(text.props.ellipsizeMode).toBeUndefined();
    }
    expectNoFixedOrClippingStyle(intro.props.style);
    expect(geometry.stage.minHeight).toBeCloseTo(411 * 0.88);
    expect(geometry.stage.height).toBeUndefined();
    expect(geometry.stage.maxHeight).toBeUndefined();
    expect(geometry.stage.overflow).not.toBe("hidden");
    expect(stage.findAllByType(Image)).toHaveLength(1);
    expect(geometry.image).toMatchObject({
      bottom: 0,
      position: "absolute"
    });
    expect(rendered.root.findByType(Image).props).toMatchObject({
      accessibilityElementsHidden: true,
      accessible: false,
      importantForAccessibility: "no-hide-descendants"
    });

    act(() => {
      setTestDimensions(411, 420, 1, 891);
    });
    expect(getHeroGeometry(rendered).stage.minHeight).toBeCloseTo(411 * 0.88);
  });

  it("adds finite Android keyboard scroll extent without changing the Login hierarchy", async () => {
    setTestPlatform("android");
    const keyboard = mockKeyboardEvents();
    const rendered = await renderLogin();
    const screen = rendered.root.findByType(Screen);
    const scrollView = rendered.root.findByType(ScrollView);
    const baselineScreenInset = StyleSheet.flatten(
      screen.props.scrollContentStyle
    ) as ViewStyle | undefined;
    const baselineNativeContentStyle = StyleSheet.flatten(
      scrollView.props.contentContainerStyle
    ) as ViewStyle;
    const baselineScreenBottomPadding =
      getFiniteNonNegativeBottomPadding(screen.props.scrollContentStyle);
    const baselineNativeBottomPadding =
      getFiniteNonNegativeBottomPadding(scrollView.props.contentContainerStyle);
    const page = findViewByTestID(rendered, "login-content");
    const formStyleBefore = findViewByTestID(
      rendered,
      "login-form-content"
    ).props.style;
    const heroStyleBefore = findViewByTestID(
      rendered,
      "login-hero-stage"
    ).props.style;
    const formOrderBefore = page
      .findAll(
        (node) =>
          node.type === FormField ||
          node.type === Button ||
          (node.type === Text && node.props.children === "or")
      )
      .map((node) =>
        node.type === FormField || node.type === Button
          ? node.props.label
          : "or"
      );

    expect(baselineScreenInset?.paddingBottom).toBeUndefined();
    expectFiniteNonNegativeNumericStyleValues(screen.props.scrollContentStyle);
    expectFiniteNonNegativeNumericStyleValues(
      scrollView.props.contentContainerStyle
    );
    expect(baselineNativeContentStyle).toMatchObject({ flexGrow: 1 });

    act(() => {
      keyboard.emit("keyboardDidShow", {
        endCoordinates: { height: 336 }
      } as Partial<KeyboardEvent>);
    });

    const inset = StyleSheet.flatten(
      screen.props.scrollContentStyle
    ) as ViewStyle;
    expect(getFiniteNonNegativeBottomPadding(inset)).toBe(
      baselineScreenBottomPadding + 336
    );
    expect(
      getFiniteNonNegativeBottomPadding(scrollView.props.contentContainerStyle)
    ).toBe(baselineNativeBottomPadding + 336);
    expectFiniteNonNegativeNumericStyleValues(inset);
    expectFiniteNonNegativeNumericStyleValues(
      scrollView.props.contentContainerStyle
    );
    expect(StyleSheet.flatten(scrollView.props.contentContainerStyle))
      .toMatchObject({
        flexGrow: 1,
        paddingBottom: baselineNativeBottomPadding + 336
      });
    expect(scrollView.props).toMatchObject({
      keyboardShouldPersistTaps: "handled",
      scrollEnabled: true
    });
    expect(findViewByTestID(rendered, "login-form-content").props.style).toBe(
      formStyleBefore
    );
    expect(findViewByTestID(rendered, "login-hero-stage").props.style).toEqual(
      heroStyleBefore
    );
    expect(
      page
        .findAll(
          (node) =>
            node.type === FormField ||
            node.type === Button ||
            (node.type === Text && node.props.children === "or")
        )
        .map((node) =>
          node.type === FormField || node.type === Button
            ? node.props.label
            : "or"
        )
    ).toEqual(formOrderBefore);
  });

  it("removes Android keyboard scroll extent when the keyboard hides", async () => {
    setTestPlatform("android");
    const keyboard = mockKeyboardEvents();
    const rendered = await renderLogin();
    const screen = rendered.root.findByType(Screen);
    const scrollView = rendered.root.findByType(ScrollView);
    const baselineScreenInset = StyleSheet.flatten(
      screen.props.scrollContentStyle
    ) as ViewStyle | undefined;
    const baselineNativeContentStyle = StyleSheet.flatten(
      scrollView.props.contentContainerStyle
    ) as ViewStyle;
    const baselineNativeBottomPadding =
      getFiniteNonNegativeBottomPadding(scrollView.props.contentContainerStyle);

    act(() => {
      keyboard.emit("keyboardDidShow", {
        endCoordinates: { height: 336 }
      } as Partial<KeyboardEvent>);
    });
    expect(
      StyleSheet.flatten(
        screen.props.scrollContentStyle
      )
    ).toMatchObject({ paddingBottom: 336 });
    expect(getFiniteNonNegativeBottomPadding(
      scrollView.props.contentContainerStyle
    )).toBe(baselineNativeBottomPadding + 336);

    act(() => {
      keyboard.emit("keyboardDidHide");
    });

    expect(
      StyleSheet.flatten(screen.props.scrollContentStyle)
    ).toEqual(baselineScreenInset);
    expect(
      StyleSheet.flatten(scrollView.props.contentContainerStyle)
    ).toEqual(baselineNativeContentStyle);
    expectFiniteNonNegativeNumericStyleValues(screen.props.scrollContentStyle);
    expectFiniteNonNegativeNumericStyleValues(
      scrollView.props.contentContainerStyle
    );
    expect(
      rendered.root.findAllByProps({ testID: "login-keyboard-spacer" })
    ).toHaveLength(0);
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
    "does not pass invalid Android keyboard padding for %s",
    async (_label, event) => {
      setTestPlatform("android");
      const keyboard = mockKeyboardEvents();
      const rendered = await renderLogin();
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
        keyboard.emit(
          "keyboardDidShow",
          event as Partial<KeyboardEvent>
        );
      });

      expect(
        StyleSheet.flatten(screen.props.scrollContentStyle)
      ).toEqual(baselineScreenInset);
      expect(
        StyleSheet.flatten(scrollView.props.contentContainerStyle)
      ).toEqual(baselineNativeContentStyle);
      expectFiniteNonNegativeNumericStyleValues(
        screen.props.scrollContentStyle
      );
      expectFiniteNonNegativeNumericStyleValues(
        scrollView.props.contentContainerStyle
      );
    }
  );

  it("handles an actual undefined keyboard event without leaving baseline", async () => {
    setTestPlatform("android");
    const keyboard = mockKeyboardEvents();
    const rendered = await renderLogin();
    const screen = rendered.root.findByType(Screen);
    const scrollView = rendered.root.findByType(ScrollView);
    const baselineScreenInset = StyleSheet.flatten(
      screen.props.scrollContentStyle
    ) as ViewStyle | undefined;
    const baselineNativeContentStyle = StyleSheet.flatten(
      scrollView.props.contentContainerStyle
    ) as ViewStyle;
    const { show } = getLoginKeyboardListeners(rendered, keyboard);

    expect(StyleSheet.flatten(screen.props.scrollContentStyle)).toEqual(
      baselineScreenInset
    );
    expect(StyleSheet.flatten(scrollView.props.contentContainerStyle)).toEqual(
      baselineNativeContentStyle
    );

    act(() => {
      show(undefined as unknown as KeyboardEvent);
    });

    expect(StyleSheet.flatten(screen.props.scrollContentStyle)).toEqual(
      baselineScreenInset
    );
    expect(StyleSheet.flatten(scrollView.props.contentContainerStyle)).toEqual(
      baselineNativeContentStyle
    );
    expectFiniteNonNegativeNumericStyleValues(screen.props.scrollContentStyle);
    expectFiniteNonNegativeNumericStyleValues(
      scrollView.props.contentContainerStyle
    );
  });

  it("keeps one active Android listener per event and removes all subscriptions", async () => {
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
    expect(keyboard.callbacks.get("keyboardDidShow")).toHaveLength(0);
    expect(keyboard.callbacks.get("keyboardDidHide")).toHaveLength(0);
    keyboard.addListener.mockClear();
    keyboard.removers.splice(0);
    keyboard.subscriptions.splice(0);

    const rendered = await renderLogin();
    const loginListeners = getLoginKeyboardListeners(rendered, keyboard);
    const loginShowSubscription = keyboard.subscriptions.find(
      ({ eventName, listener }) =>
        eventName === "keyboardDidShow" && listener === loginListeners.show
    );
    const loginHideSubscription = keyboard.subscriptions.find(
      ({ eventName, listener }) =>
        eventName === "keyboardDidHide" && listener === loginListeners.hide
    );

    const initialListenerCalls = keyboard.addListener.mock.calls.length;
    const didShowCalls = keyboard.addListener.mock.calls.filter(
      ([name]) => name === "keyboardDidShow"
    );
    const didHideCalls = keyboard.addListener.mock.calls.filter(
      ([name]) => name === "keyboardDidHide"
    );
    expect(didShowCalls).toHaveLength(baselineDidShowCalls + 1);
    expect(didHideCalls).toHaveLength(baselineDidHideCalls + 1);
    expect(initialListenerCalls).toBe(
      didShowCalls.length + didHideCalls.length
    );
    expect(keyboard.callbacks.get("keyboardDidShow")).toHaveLength(
      baselineActiveDidShow + 1
    );
    expect(keyboard.callbacks.get("keyboardDidHide")).toHaveLength(
      baselineActiveDidHide + 1
    );
    expect(didShowCalls.every(([, listener]) => typeof listener === "function"))
      .toBe(true);
    expect(didHideCalls.every(([, listener]) => typeof listener === "function"))
      .toBe(true);

    act(() => {
      findField(rendered, "Email").props.onChangeText("rerender@example.com");
    });
    expect(keyboard.addListener).toHaveBeenCalledTimes(initialListenerCalls);

    act(() => {
      rendered.unmount();
    });
    view = null;
    expect(keyboard.removers).toHaveLength(initialListenerCalls);
    for (const remove of keyboard.removers) {
      expect(remove).toHaveBeenCalledTimes(1);
    }
    expect(loginShowSubscription?.remove).toHaveBeenCalledTimes(1);
    expect(loginHideSubscription?.remove).toHaveBeenCalledTimes(1);
    expect(keyboard.callbacks.get("keyboardDidShow")).toHaveLength(0);
    expect(keyboard.callbacks.get("keyboardDidHide")).toHaveLength(0);

    const heightGetter = jest.fn(() => 336);
    const endCoordinates = {} as KeyboardEvent["endCoordinates"];
    Object.defineProperty(endCoordinates, "height", {
      configurable: true,
      get: heightGetter
    });
    act(() => {
      loginListeners.show({ endCoordinates } as KeyboardEvent);
    });
    expect(heightGetter).not.toHaveBeenCalled();
  });

  it("does not add screen-local keyboard padding or listeners on iOS", async () => {
    setTestPlatform("ios");
    const keyboard = mockKeyboardEvents();
    const rendered = await renderLogin();

    expect(
      keyboard.addListener.mock.calls.filter(
        ([name]) => name === "keyboardDidShow" || name === "keyboardDidHide"
      )
    ).toHaveLength(0);
    act(() => {
      keyboard.emit("keyboardDidShow", {
        endCoordinates: { height: 336 }
      } as Partial<KeyboardEvent>);
    });
    expect(
      rendered.root.findByType(Screen).props.scrollContentStyle
    ).toBeUndefined();
  });

  it("uses semantic field icons and toggles password visibility without losing its value", async () => {
    const rendered = await renderLogin();
    enterCredentials(rendered, "worker@example.com", "  exact password  ");

    expect(findField(rendered, "Email").props.leadingIcon).toBe("email");
    expect(findField(rendered, "Email").props).toMatchObject({
      autoComplete: "email",
      textContentType: "emailAddress"
    });
    let passwordField = findField(rendered, "Password");
    expect(passwordField.props).toMatchObject({
      autoComplete: "current-password",
      leadingIcon: "password",
      secureTextEntry: true,
      textContentType: "password",
      value: "  exact password  "
    });
    const nativeInputs = rendered.root.findAllByType(TextInput);
    expect(
      nativeInputs.find((input) => input.props.accessibilityLabel === "Email")
        ?.props
    ).toMatchObject({
      autoComplete: "email",
      textContentType: "emailAddress"
    });
    expect(
      nativeInputs.find(
        (input) => input.props.accessibilityLabel === "Password"
      )?.props
    ).toMatchObject({
      autoComplete: "current-password",
      textContentType: "password"
    });
    expect(passwordField.props.trailingAction).toMatchObject({
      accessibilityHint: "Reveals your password.",
      icon: "visibilityOn",
      label: "Show",
      testID: "password-visibility-action"
    });

    let visibilityAction = findNativeButton(rendered, "Show");
    expect(visibilityAction.props).toMatchObject({
      accessibilityHint: "Reveals your password.",
      accessibilityRole: "button",
      accessibilityState: { disabled: false },
      disabled: false
    });
    expect(StyleSheet.flatten(visibilityAction.props.style({ pressed: false })))
      .toMatchObject({
        minHeight: theme.target.min,
        minWidth: theme.target.min
      });
    expect(rendered.root.findByProps({ children: "Show" }).type).toBe(Text);
    expect(
      rendered.root.findAllByType(AppIcon).some(
        (node) => node.props.name === "visibilityOn"
      )
    ).toBe(true);

    await act(async () => {
      visibilityAction.props.onPress();
    });
    passwordField = findField(rendered, "Password");
    expect(passwordField.props).toMatchObject({
      secureTextEntry: false,
      value: "  exact password  "
    });
    expect(passwordField.props.trailingAction).toMatchObject({
      accessibilityHint: "Conceals your password.",
      icon: "visibilityOff",
      label: "Hide"
    });
    visibilityAction = findNativeButton(rendered, "Hide");
    expect(rendered.root.findByProps({ children: "Hide" }).type).toBe(Text);
    expect(
      rendered.root.findAllByType(AppIcon).some(
        (node) => node.props.name === "visibilityOff"
      )
    ).toBe(true);

    await act(async () => {
      visibilityAction.props.onPress();
    });
    expect(findField(rendered, "Password").props).toMatchObject({
      secureTextEntry: true,
      value: "  exact password  "
    });
  });

  it("keeps validation copy and does not submit invalid credentials", async () => {
    const rendered = await renderLogin();

    await act(async () => {
      findButton(rendered, "Log in").props.onPress();
    });

    expect(findField(rendered, "Email").props.error).toBe(
      "Enter a valid email address."
    );
    expect(findField(rendered, "Password").props.error).toBe(
      "Enter your password."
    );
    expect(signIn).not.toHaveBeenCalled();
  });

  it("submits trimmed email and preserves password exactly", async () => {
    const rendered = await renderLogin();
    enterCredentials(
      rendered,
      "  worker@example.com  ",
      "  exact password  "
    );

    await act(async () => {
      findButton(rendered, "Log in").props.onPress();
      await flushPromises();
    });

    expect(clearError).toHaveBeenCalledTimes(1);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(signIn).toHaveBeenCalledWith({
      email: "worker@example.com",
      password: "  exact password  "
    });
    expect(findButton(rendered, "Log in").props.loading).toBe(false);
  });

  it("blocks duplicate pending submission while preserving visible identity and values", async () => {
    const pendingSignIn = deferred<void>();
    signIn.mockReturnValueOnce(pendingSignIn.promise);
    const rendered = await renderLogin();
    enterCredentials(rendered, "worker@example.com", "kept password");
    const submit = findButton(rendered, "Log in").props.onPress;

    await act(async () => {
      submit();
      submit();
      await Promise.resolve();
    });

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(findButton(rendered, "Log in").props).toMatchObject({
      label: "Log in",
      loading: true
    });
    const nativeLogin = findNativeButton(rendered, "Log in");
    expect(nativeLogin.props).toMatchObject({
      accessibilityState: { busy: true, disabled: true },
      disabled: true
    });
    expect(nativeLogin.props.onPress).toBeUndefined();
    expect(findField(rendered, "Email").props.value).toBe("worker@example.com");
    expect(findField(rendered, "Password").props.value).toBe("kept password");
    expect(findButton(rendered, "Create account").props.disabled).not.toBe(true);

    await act(async () => {
      pendingSignIn.resolve();
      await flushPromises();
    });
    expect(findButton(rendered, "Log in").props.loading).toBe(false);
  });

  it("retains values, shows rejected sign-in feedback, and re-enables retry", async () => {
    const rejectedSignIn = deferred<void>();
    signIn.mockReturnValueOnce(rejectedSignIn.promise);
    const rendered = await renderLogin();
    enterCredentials(rendered, "worker@example.com", "kept password");

    act(() => {
      findButton(rendered, "Log in").props.onPress();
    });
    expect(findButton(rendered, "Log in").props.loading).toBe(true);

    await act(async () => {
      rejectedSignIn.reject(new ApiError("Invalid email or password", 401));
      await flushPromises();
    });

    expect(findField(rendered, "Email").props.value).toBe("worker@example.com");
    expect(findField(rendered, "Password").props.value).toBe("kept password");
    expect(rendered.root.findByType(StateMessage).props).toMatchObject({
      message: "Invalid email or password",
      title: "Sign in failed",
      tone: "error"
    });
    expect(findButton(rendered, "Log in").props.loading).toBe(false);
    expect(findNativeButton(rendered, "Log in").props).toMatchObject({
      accessibilityState: { busy: false, disabled: false },
      disabled: false
    });

    await act(async () => {
      findNativeButton(rendered, "Log in").props.onPress();
      await flushPromises();
    });
    expect(signIn).toHaveBeenCalledTimes(2);
  });

  it("recovers from a synchronous signIn throw and allows a successful retry", async () => {
    const credentials = {
      email: "worker@example.com",
      password: "kept exactly"
    };
    signIn
      .mockImplementationOnce(() => {
        throw new ApiError("Synchronous sign-in failure", 0);
      })
      .mockResolvedValueOnce(undefined);
    const rendered = await renderLogin();
    enterCredentials(rendered, `  ${credentials.email}  `, credentials.password);
    let escapedError: unknown;

    try {
      await act(async () => {
        findNativeButton(rendered, "Log in").props.onPress();
        await flushPromises();
      });
    } catch (error) {
      escapedError = error;
    }
    await act(async () => {
      await flushPromises();
    });

    expect(escapedError).toBeUndefined();
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(signIn).toHaveBeenNthCalledWith(1, credentials);
    expect(rendered.root.findByType(StateMessage).props).toMatchObject({
      message: "Synchronous sign-in failure",
      title: "Sign in failed",
      tone: "error"
    });
    expect(findField(rendered, "Email").props.value).toBe(
      `  ${credentials.email}  `
    );
    expect(findField(rendered, "Password").props.value).toBe(
      credentials.password
    );
    expect(findNativeButton(rendered, "Log in").props).toMatchObject({
      accessibilityState: { busy: false, disabled: false },
      disabled: false
    });
    expect(typeof findNativeButton(rendered, "Log in").props.onPress).toBe(
      "function"
    );

    await act(async () => {
      findNativeButton(rendered, "Log in").props.onPress();
      await flushPromises();
    });
    expect(signIn).toHaveBeenCalledTimes(2);
    expect(signIn).toHaveBeenNthCalledWith(2, credentials);
    expect(findButton(rendered, "Log in").props.loading).toBe(false);
  });

  it("replaces a stale auth error with network feedback and keeps retry executable", async () => {
    const credentials = {
      email: "network@example.com",
      password: "network password"
    };
    const networkRequest = deferred<void>();
    const networkError = new ApiError(
      "Network error. Check your connection and backend URL.",
      0
    );
    authError = "Previous authentication error";
    signIn.mockReturnValueOnce(networkRequest.promise);
    const rendered = await renderLogin();

    expect(rendered.root.findByType(StateMessage).props.message).toBe(
      "Previous authentication error"
    );
    enterCredentials(rendered, credentials.email, credentials.password);

    await act(async () => {
      findNativeButton(rendered, "Log in").props.onPress();
      await Promise.resolve();
    });

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(signIn).toHaveBeenCalledWith(credentials);
    expect(clearError).toHaveBeenCalledTimes(1);
    expect(clearError.mock.invocationCallOrder[0]).toBeLessThan(
      signIn.mock.invocationCallOrder[0]!
    );
    expect(rendered.root.findAllByType(StateMessage)).toHaveLength(0);
    expect(findNativeButton(rendered, "Log in").props).toMatchObject({
      accessibilityState: { busy: true, disabled: true },
      disabled: true
    });
    expect(findNativeButton(rendered, "Log in").props.onPress).toBeUndefined();

    await act(async () => {
      networkRequest.reject(networkError);
      await flushPromises();
    });

    expect(networkError).toBeInstanceOf(ApiError);
    expect(networkError.status).toBe(0);
    expect(rendered.root.findByType(StateMessage).props).toMatchObject({
      message: "Network error. Check your connection and backend URL.",
      title: "Sign in failed",
      tone: "error"
    });
    expect(findField(rendered, "Email").props.value).toBe(credentials.email);
    expect(findField(rendered, "Password").props.value).toBe(
      credentials.password
    );
    expect(findNativeButton(rendered, "Log in").props).toMatchObject({
      accessibilityState: { busy: false, disabled: false },
      disabled: false
    });
    expect(typeof findNativeButton(rendered, "Log in").props.onPress).toBe(
      "function"
    );

    await act(async () => {
      findNativeButton(rendered, "Log in").props.onPress();
      await flushPromises();
    });
    expect(signIn).toHaveBeenCalledTimes(2);
    expect(signIn).toHaveBeenNthCalledWith(2, credentials);
    expect(rendered.root.findAllByType(StateMessage)).toHaveLength(0);
  });

  it("preserves AuthContext error feedback", async () => {
    authError = "Authentication service unavailable";
    const rendered = await renderLogin();

    expect(rendered.root.findByType(StateMessage).props).toMatchObject({
      message: "Authentication service unavailable",
      title: "Sign in failed",
      tone: "error"
    });
  });

  it("navigates to Register and exposes no unnamed interactive controls", async () => {
    const rendered = await renderLogin();

    await act(async () => {
      findButton(rendered, "Create account").props.onPress();
    });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("Register");

    const accessibleButtons = rendered.root.findAll(
      (node) => node.props.accessibilityRole === "button"
    );
    expect(accessibleButtons.length).toBeGreaterThanOrEqual(3);
    expect(
      accessibleButtons.every(
        (node) =>
          typeof node.props.accessibilityLabel === "string" &&
          node.props.accessibilityLabel.trim().length > 0
      )
    ).toBe(true);
    expect(
      rendered.root.findAllByType(TextInput).map((node) => ({
        name: node.props.accessibilityLabel,
        role: node.props.accessibilityRole
      }))
    ).toEqual([
      { name: "Email", role: undefined },
      { name: "Password", role: undefined }
    ]);
  });
});
