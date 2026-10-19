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
import { Button } from "../../components/Button";
import { Feedback } from "../../components/Feedback";
import { Screen } from "../../components/Screen";
import { useAuth } from "../../context/AuthContext";
import {
  clearSession,
  loadSession,
  saveSession
} from "../../storage/sessionStorage";
import type { User } from "../../types/auth";
import { theme } from "../../utils/theme";
import { UnsupportedRoleScreen } from "../UnsupportedRoleScreen";

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
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../storage/sessionStorage", () => ({
  clearSession: jest.fn(),
  loadSession: jest.fn(),
  saveSession: jest.fn()
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: jest.fn()
}));

const mockedUseAuth = jest.mocked(useAuth);
const initialWindowDimensions = Dimensions.get("window");
const initialScreenDimensions = Dimensions.get("screen");
const adminUser: User = {
  company: null,
  email: "admin.with.a.long.address@example.com",
  firstName: "Admin",
  id: 29,
  lastName: "Account",
  role: "ADMIN"
};

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

function findAccessibleHost(
  rendered: ReactTestRenderer,
  label: string
): ReactTestInstance {
  return rendered.root.find(
    (node) =>
      typeof node.type === "string" &&
      node.props.accessible === true &&
      node.props.accessibilityLabel === label
  );
}

async function renderUnsupportedRole(
  signOut: jest.Mock = jest.fn().mockResolvedValue(undefined),
  user: User = adminUser
): Promise<ReactTestRenderer> {
  mockedUseAuth.mockReturnValue({
    signOut,
    status: "authenticated",
    user
  } as unknown as ReturnType<typeof useAuth>);

  let rendered!: ReactTestRenderer;
  await act(async () => {
    rendered = create(<UnsupportedRoleScreen />);
  });
  return rendered;
}

describe("UnsupportedRoleScreen", () => {
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

  it("renders one scrollable branded role gate with the exact account context and action", async () => {
    const rendered = await renderUnsupportedRole();

    expect(rendered.root.findAllByType(Screen)).toHaveLength(1);
    expect(rendered.root.findByType(Screen).props.scroll).toBe(true);
    expect(rendered.root.findAllByType(ScrollView)).toHaveLength(1);
    expect(rendered.root.findAllByType(Feedback)).toHaveLength(1);
    expect(rendered.root.findByType(Feedback).props).toMatchObject({
      message:
        "Mobile MVP supports worker and foreman accounts. Admin work is handled in the backend Vaadin dashboard.",
      mode: "screen",
      title: "Admin role is not available here",
      tone: "warning"
    });
    expect(rendered.root.findAllByType(Button)).toHaveLength(1);
    expect(rendered.root.findByType(Button).props).toMatchObject({
      label: "Log out",
      leadingIcon: "logout"
    });
    expect(
      rendered.root
        .findAllByType(Text)
        .map((node) => node.props.children)
        .filter((children) => typeof children === "string")
    ).toEqual([
      "ShiftPay",
      "Unsupported mobile role",
      adminUser.email,
      "Admin role is not available here",
      "Mobile MVP supports worker and foreman accounts. Admin work is handled in the backend Vaadin dashboard.",
      "Log out"
    ]);
    expect(rendered.root.findAllByType(Image)).toHaveLength(0);
    expect(rendered.root.findAllByType(TextInput)).toHaveLength(0);
    const forbiddenCopy = new Set([
      "Dashboard preview",
      "Retry",
      "Back",
      "Log in",
      "Company name",
      "Password"
    ]);
    expect(
      rendered.root
        .findAllByType(Text)
        .some((node) => forbiddenCopy.has(String(node.props.children)))
    ).toBe(false);
  });

  it("calls the existing signOut boundary exactly once without direct app side effects", async () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    const timeout = jest.spyOn(globalThis, "setTimeout");
    const interval = jest.spyOn(globalThis, "setInterval");
    const rendered = await renderUnsupportedRole(signOut);

    await act(async () => {
      rendered.root.findByType(Button).props.onPress();
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(loginUser).not.toHaveBeenCalled();
    expect(registerUser).not.toHaveBeenCalled();
    expect(loadSession).not.toHaveBeenCalled();
    expect(saveSession).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();
    expect(useNavigation).not.toHaveBeenCalled();
    expect(timeout).not.toHaveBeenCalled();
    expect(interval).not.toHaveBeenCalled();

  });

  it.each([
    ["blank", { ...adminUser, email: "   " }],
    [
      "missing",
      {
        company: null,
        firstName: "Admin",
        id: 29,
        lastName: "Account",
        role: "ADMIN"
      } as unknown as User
    ]
  ])(
    "omits %s email context without creating blank visible text",
    async (_case, user) => {
      const rendered = await renderUnsupportedRole(
        jest.fn().mockResolvedValue(undefined),
        user
      );
      const visibleText = rendered.root.findAllByType(Text);

      expect(
        visibleText.some(
          (node) =>
            typeof node.props.children === "string" &&
            node.props.children.trim().length === 0
        )
      ).toBe(false);
      expect(
        visibleText.filter((node) => node.props.children === adminUser.email)
      ).toHaveLength(0);
    }
  );

  it("exposes one named logout action, a heading, and complete polite feedback semantics", async () => {
    const rendered = await renderUnsupportedRole();
    const heading = findVisibleText(rendered, "Unsupported mobile role");
    const announcement = rendered.root.find(
      (node) =>
        typeof node.type === "string" &&
        node.props.accessible === true &&
        node.props.accessibilityRole === "text" &&
        node.props.accessibilityLiveRegion === "polite"
    );
    const namedButtons = rendered.root.findAll(
      (node) =>
        typeof node.type === "string" &&
        node.props.accessible === true &&
        node.props.accessibilityRole === "button"
    );

    expect(heading.props.accessibilityRole).toBe("header");
    expect(namedButtons).toHaveLength(1);
    const logoutButton = namedButtons[0]!;
    expect(logoutButton.props).toMatchObject({
      accessibilityHint:
        "Signs out of this account and returns to the sign-in flow.",
      accessibilityLabel: "Log out",
      accessibilityRole: "button"
    });
    expect(announcement.props.accessibilityLabel).toContain(
      "Admin role is not available here"
    );
    expect(announcement.props.accessibilityLabel).toContain(
      "Mobile MVP supports worker and foreman accounts. Admin work is handled in the backend Vaadin dashboard."
    );
    expect(announcement.props.accessibilityState).toEqual({ busy: false });

    const icon = rendered.root.findByType(Ionicons);
    expect(icon.props).toMatchObject({
      accessible: false,
      accessibilityElementsHidden: true,
      "aria-hidden": true,
      importantForAccessibility: "no-hide-descendants",
      name: "log-out-outline"
    });
    expect(
      rendered.root.findAll(
        (node) => {
          const label = node.props.accessibilityLabel;
          return (
            typeof node.type === "string" &&
            (node.props.accessibilityRole === "button" ||
              node.props.accessibilityRole === "link") &&
            (typeof label !== "string" || label.trim().length === 0)
          );
        }
      )
    ).toHaveLength(0);
  });

  it("keeps all copy scalable and wrapping without fixed text dimensions", async () => {
    const rendered = await renderUnsupportedRole();
    const visibleCopy = [
      "ShiftPay",
      "Unsupported mobile role",
      adminUser.email,
      "Admin role is not available here",
      "Mobile MVP supports worker and foreman accounts. Admin work is handled in the backend Vaadin dashboard.",
      "Log out"
    ];

    for (const copy of visibleCopy) {
      const text = findVisibleText(rendered, copy);
      expect(text.props.allowFontScaling).not.toBe(false);
      expect(text.props.numberOfLines).toBeUndefined();
      expect(text.props.ellipsizeMode).toBeUndefined();
      const style = StyleSheet.flatten(text.props.style) as ViewStyle;
      expect(style).not.toHaveProperty("height");
      expect(style).not.toHaveProperty("maxHeight");
      expect(style.overflow).not.toBe("hidden");
    }

    for (const copy of visibleCopy.slice(0, -1)) {
      expect(findVisibleText(rendered, copy).props.allowFontScaling).toBe(true);
    }
    expect(StyleSheet.flatten(findVisibleText(rendered, adminUser.email).props.style)).toMatchObject(
      {
        ...theme.typography.body,
        color: theme.colors.ink.secondary,
        flexShrink: 1,
        textAlign: "center"
      }
    );
  });

  it("uses canonical tokens and preserves manual reachability on a narrow font-scale-1.5 viewport", async () => {
    setTestDimensions(280, 568, 1.5);
    const rendered = await renderUnsupportedRole();
    const screen = rendered.root.findByType(Screen);
    const scrollView = rendered.root.findByType(ScrollView);

    expect(screen.props.scroll).toBe(true);
    expect(scrollView.props).toMatchObject({
      horizontal: false,
      keyboardShouldPersistTaps: "handled",
      scrollEnabled: true
    });
    expect(StyleSheet.flatten(scrollView.props.contentContainerStyle)).toMatchObject({
      flexGrow: 1
    });
    expect(StyleSheet.flatten(rendered.root.findByType(SafeAreaView).props.style)).toMatchObject(
      {
        backgroundColor: theme.colors.canvas,
        flex: 1
      }
    );

    const pageStyle = StyleSheet.flatten(
      findViewByTestID(rendered, "unsupported-role-content").props.style
    ) as ViewStyle;
    const headerStyle = StyleSheet.flatten(
      findViewByTestID(rendered, "unsupported-role-header").props.style
    ) as ViewStyle;
    const feedbackStyle = StyleSheet.flatten(
      findViewByTestID(rendered, "unsupported-role-feedback").props.style
    ) as ViewStyle;
    const actionsStyle = StyleSheet.flatten(
      findViewByTestID(rendered, "unsupported-role-actions").props.style
    ) as ViewStyle;

    expect(pageStyle).toMatchObject({
      flexGrow: 1,
      gap: theme.gap.section,
      justifyContent: "center",
      maxWidth: "100%",
      width: "100%"
    });
    expect(headerStyle).toMatchObject({
      alignItems: "center",
      flexShrink: 1,
      gap: theme.space[2],
      maxWidth: "100%"
    });
    expect(feedbackStyle).toMatchObject({
      backgroundColor: theme.colors.warning.bg,
      borderColor: theme.colors.warning.fg,
      borderRadius: theme.radius.lg,
      borderWidth: theme.border.default,
      padding: theme.padding.card
    });
    expect(actionsStyle).toMatchObject({
      alignSelf: "stretch",
      flexShrink: 1,
      maxWidth: "100%"
    });

    for (const style of [pageStyle, headerStyle, feedbackStyle, actionsStyle]) {
      expect(style).not.toHaveProperty("height");
      expect(style).not.toHaveProperty("maxHeight");
      expect(style.overflow).not.toBe("hidden");
    }
    expect(findAccessibleHost(rendered, "Log out")).toBeDefined();
  });
});
