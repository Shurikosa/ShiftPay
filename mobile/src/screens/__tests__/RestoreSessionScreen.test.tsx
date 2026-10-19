import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCurrentUser, loginUser, registerUser } from "../../api/auth";
import { Button } from "../../components/Button";
import { Feedback } from "../../components/Feedback";
import { Screen } from "../../components/Screen";
import {
  clearSession,
  loadSession,
  saveSession
} from "../../storage/sessionStorage";
import { theme } from "../../utils/theme";
import { RestoreSessionScreen } from "../RestoreSessionScreen";
import { useNavigation } from "@react-navigation/native";

jest.mock("../../api/auth", () => ({
  getCurrentUser: jest.fn(),
  loginUser: jest.fn(),
  registerUser: jest.fn()
}));
jest.mock("../../storage/sessionStorage", () => ({
  clearSession: jest.fn(),
  loadSession: jest.fn(),
  saveSession: jest.fn()
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: jest.fn()
}));

const initialWindowDimensions = Dimensions.get("window");
const initialScreenDimensions = Dimensions.get("screen");

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

function findViewByTestID(
  rendered: ReactTestRenderer,
  testID: string
): ReactTestInstance {
  return rendered.root
    .findAllByType(View)
    .find((node) => node.props.testID === testID)!;
}

function findVisibleText(
  rendered: ReactTestRenderer,
  copy: string
): ReactTestInstance {
  return rendered.root
    .findAllByType(Text)
    .find((node) => node.props.children === copy)!;
}

async function renderRestoreSession(): Promise<ReactTestRenderer> {
  let rendered!: ReactTestRenderer;
  await act(async () => {
    rendered = create(<RestoreSessionScreen />);
  });
  return rendered;
}

describe("RestoreSessionScreen", () => {
  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setTestDimensions(411, 891, 1);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    Dimensions.set({
      screen: initialScreenDimensions,
      window: initialWindowDimensions
    });
  });

  it("renders one non-scroll branded system-state shell without unrelated content or actions", async () => {
    const rendered = await renderRestoreSession();

    expect(rendered.root.findAllByType(Screen)).toHaveLength(1);
    expect(rendered.root.findByType(Screen).props.scroll).toBe(false);
    expect(rendered.root.findAllByType(ScrollView)).toHaveLength(0);
    expect(rendered.root.findAllByType(Feedback)).toHaveLength(1);
    expect(rendered.root.findByType(Feedback).props).toMatchObject({
      loading: true,
      message: "Checking saved sign-in state.",
      mode: "screen",
      title: "Restoring session"
    });
    expect(
      rendered.root.findAllByType(Text).map((node) => node.props.children)
    ).toEqual([
      "ShiftPay",
      "Restoring session",
      "Checking saved sign-in state."
    ]);
    expect(rendered.root.findAllByType(Image)).toHaveLength(0);
    expect(rendered.root.findAllByType(TextInput)).toHaveLength(0);
    expect(rendered.root.findAllByType(Button)).toHaveLength(0);
    expect(rendered.root.findAllByType(Pressable)).toHaveLength(0);
    expect(
      rendered.root.findAll(
        (node) =>
          node.props.accessibilityRole === "button" ||
          node.props.accessibilityRole === "link" ||
          typeof node.props.onPress === "function"
      )
    ).toHaveLength(0);
  });

  it("announces the single loading state accessibly and keeps visible copy scalable", async () => {
    const rendered = await renderRestoreSession();

    expect(rendered.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(rendered.root.findByType(ActivityIndicator).props.color).toBe(
      theme.colors.brand.primary
    );
    const accessibleNodes = rendered.root.findAll(
      (node) => node.props.accessible === true
    );
    const announcement = accessibleNodes.find(
      (node) => node.props.accessibilityState?.busy === true
    );
    expect(announcement).toBeDefined();
    expect(announcement!.props).toMatchObject({
      accessibilityLiveRegion: "polite",
      accessibilityRole: "text",
      accessibilityState: { busy: true }
    });
    expect(announcement!.props.accessibilityLabel).toContain(
      "Restoring session"
    );
    expect(announcement!.props.accessibilityLabel).toContain(
      "Checking saved sign-in state."
    );
    for (const node of accessibleNodes) {
      expect(typeof node.props.accessibilityLabel).toBe("string");
      expect(node.props.accessibilityLabel.trim()).not.toBe("");
    }

    for (const copy of [
      "ShiftPay",
      "Restoring session",
      "Checking saved sign-in state."
    ]) {
      const text = findVisibleText(rendered, copy);
      expect(text.props.allowFontScaling).toBe(true);
      expect(text.props.numberOfLines).toBeUndefined();
      expect(text.props.ellipsizeMode).toBeUndefined();
      expect(StyleSheet.flatten(text.props.style)).not.toHaveProperty("height");
      expect(StyleSheet.flatten(text.props.style)).not.toHaveProperty(
        "maxHeight"
      );
    }
  });

  it("uses canonical responsive layout tokens on a narrow font-scale-1.5 viewport", async () => {
    setTestDimensions(280, 568, 1.5);
    const rendered = await renderRestoreSession();

    const safeAreaStyle = StyleSheet.flatten(
      rendered.root.findByType(SafeAreaView).props.style
    ) as ViewStyle;
    expect(safeAreaStyle).toMatchObject({
      backgroundColor: theme.colors.canvas,
      flex: 1
    });

    const pageStyle = StyleSheet.flatten(
      findViewByTestID(rendered, "restore-session-content").props.style
    ) as ViewStyle;
    expect(pageStyle).toMatchObject({
      flex: 1,
      gap: theme.space[6],
      justifyContent: "center",
      maxWidth: "100%",
      width: "100%"
    });
    const identityStyle = StyleSheet.flatten(
      findViewByTestID(rendered, "restore-session-identity").props.style
    ) as ViewStyle;
    expect(identityStyle).toMatchObject({
      alignItems: "center",
      flexShrink: 1,
      maxWidth: "100%"
    });
    const brandStyle = StyleSheet.flatten(
      findVisibleText(rendered, "ShiftPay").props.style
    );
    expect(brandStyle).toMatchObject({
      ...theme.typography.screenTitle,
      color: theme.colors.brand.primary,
      flexShrink: 1,
      textAlign: "center"
    });
    const feedbackSurfaceStyle = StyleSheet.flatten(
      findViewByTestID(rendered, "restore-session-feedback").props.style
    ) as ViewStyle;
    expect(feedbackSurfaceStyle).toMatchObject({
      backgroundColor: theme.colors.surface.subtle,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      borderWidth: theme.border.default,
      padding: theme.padding.card
    });

    for (const style of [pageStyle, identityStyle, feedbackSurfaceStyle]) {
      expect(style).not.toHaveProperty("height");
      expect(style).not.toHaveProperty("maxHeight");
    }
  });

  it("stays presentation-only without session, API, navigation, timer, or retry behavior", async () => {
    const timeout = jest.spyOn(globalThis, "setTimeout");
    const interval = jest.spyOn(globalThis, "setInterval");

    const rendered = await renderRestoreSession();

    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(loginUser).not.toHaveBeenCalled();
    expect(registerUser).not.toHaveBeenCalled();
    expect(loadSession).not.toHaveBeenCalled();
    expect(saveSession).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();
    expect(useNavigation).not.toHaveBeenCalled();
    expect(timeout).not.toHaveBeenCalled();
    expect(interval).not.toHaveBeenCalled();
    expect(
      rendered.root
        .findAllByType(Text)
        .some((node) => /retry|log in|cancel|back|%/iu.test(node.props.children))
    ).toBe(false);
  });
});
