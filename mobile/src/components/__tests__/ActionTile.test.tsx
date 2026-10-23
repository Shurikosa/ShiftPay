import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import {
  StyleSheet,
  Text,
  type TextStyle,
  type ViewStyle
} from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { theme } from "../../utils/theme";
import { ActionTile } from "../ActionTile";

jest.mock("@expo/vector-icons/Ionicons", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text: NativeText } = jest.requireActual<typeof import("react-native")>(
    "react-native"
  );
  const MockIonicons = (props: Record<string, unknown>) =>
    React.createElement(NativeText, props as ComponentProps<typeof NativeText>);

  return { __esModule: true, default: MockIonicons };
});

async function renderTile(
  overrides: Partial<ComponentProps<typeof ActionTile>> = {}
): Promise<ReactTestRenderer> {
  let view!: ReactTestRenderer;
  await act(async () => {
    view = create(
      <ActionTile
        icon="calendar"
        label="My shift history"
        onPress={jest.fn()}
        supportingText="Review joined shifts and attendance."
        testID="history-tile"
        {...overrides}
      />
    );
  });
  return view;
}

function findButtons(view: ReactTestRenderer) {
  return view.root.findAll(
    (node) =>
      node.props.accessibilityRole === "button" &&
      typeof node.props.style === "function"
  );
}

describe("ActionTile", () => {
  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("renders one named button with visible destination context and decorative icons", async () => {
    const onPress = jest.fn();
    const view = await renderTile({
      accessibilityHint: "Opens all joined shifts.",
      onPress
    });
    const buttons = findButtons(view);

    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.props).toMatchObject({
      accessible: true,
      accessibilityHint: "Opens all joined shifts.",
      accessibilityLabel:
        "My shift history. Review joined shifts and attendance.",
      accessibilityRole: "button",
      accessibilityState: { disabled: false },
      role: "button",
      testID: "history-tile"
    });
    expect(view.root.findByProps({ children: "My shift history" }).type).toBe(Text);
    expect(
      view.root.findByProps({ children: "Review joined shifts and attendance." }).type
    ).toBe(Text);

    const icons = view.root.findAllByType(Ionicons);
    expect(icons.map((icon) => icon.props.name)).toEqual(["calendar-outline"]);
    for (const icon of icons) {
      expect(icon.props).toMatchObject({
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: "no-hide-descendants",
        "aria-hidden": true
      });
    }

    act(() => {
      buttons[0]?.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("uses canonical pressed presentation", async () => {
    const view = await renderTile();
    const button = findButtons(view)[0]!;
    const pressed = StyleSheet.flatten(
      button.props.style({ pressed: true })
    ) as ViewStyle;

    expect(pressed).toMatchObject({
      minHeight: 104,
      minWidth: 0,
      opacity: 0.9,
      transform: [{ translateY: theme.border.default }]
    });
  });

  it("exposes disabled semantics and suppresses its press callback", async () => {
    const onPress = jest.fn();
    const view = await renderTile({ disabled: true, onPress });
    const button = findButtons(view)[0]!;
    const disabled = StyleSheet.flatten(
      button.props.style({ pressed: true })
    ) as ViewStyle;

    expect(button.props).toMatchObject({
      accessibilityState: { disabled: true },
      "aria-disabled": true,
      disabled: true
    });
    expect(button.props.onPress).toBeUndefined();
    expect(disabled.opacity).toBe(0.6);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("keeps destination text scalable, wrapping, and free of clipping constraints", async () => {
    const label =
      "A very long destination label that must wrap on a narrow worker dashboard";
    const supportingText =
      "Long supporting context remains readable at a font scale of one point five.";
    const view = await renderTile({ label, supportingText });

    for (const copy of [label, supportingText]) {
      const node = view.root.findByProps({ children: copy });
      const style = StyleSheet.flatten(node.props.style) as TextStyle;
      expect(node.props.allowFontScaling).toBe(true);
      expect(node.props.numberOfLines).toBeUndefined();
      expect(node.props.ellipsizeMode).toBeUndefined();
      expect(style).toMatchObject({ flexShrink: 1 });
      expect(style.height).toBeUndefined();
      expect(style.maxHeight).toBeUndefined();
      expect(style.overflow).not.toBe("hidden");
    }
  });

  it("fails closed for a blank label", async () => {
    const view = await renderTile({ label: "   " });
    expect(view.toJSON()).toBeNull();
    expect(findButtons(view)).toHaveLength(0);
  });

  it("supports a compact label-only tile", async () => {
    const view = await renderTile({ label: "Payroll", supportingText: "\n\t" });
    const button = findButtons(view)[0]!;

    expect(button.props.accessibilityLabel).toBe("Payroll");
    expect(view.root.findByProps({ children: "Payroll" })).toBeDefined();
  });

  it("uses the canonical green surface and inverse icon for the primary tile", async () => {
    const view = await renderTile({
      icon: "join",
      label: "Join shift",
      supportingText: undefined,
      tone: "primary"
    });
    const button = findButtons(view)[0]!;
    const surface = button.find(
      (node) =>
        Array.isArray(node.props.style) &&
        StyleSheet.flatten(node.props.style)?.backgroundColor ===
          theme.colors.brand.primary
    );
    const style = StyleSheet.flatten(surface.props.style) as ViewStyle;

    expect(style).toMatchObject({
      backgroundColor: theme.colors.brand.primary,
      borderColor: theme.colors.brand.primary
    });
    expect(view.root.findByType(Ionicons).props.color).toBe(
      theme.colors.surface.default
    );
  });

  it("keeps raw style and accessibility-name overrides out of its public contract", () => {
    type Props = ComponentProps<typeof ActionTile>;

    const forgedName: Props = {
      // @ts-expect-error ActionTile derives its name from visible copy.
      accessibilityLabel: "Hidden destination",
      icon: "calendar",
      label: "History",
      onPress: jest.fn(),
      supportingText: "Review shifts."
    };
    const rawStyle: Props = {
      icon: "payroll",
      label: "Payroll",
      onPress: jest.fn(),
      // @ts-expect-error ActionTile does not expose unsafe raw surface styles.
      style: { height: 1 },
      supportingText: "Review pay."
    };

    expect({ forgedName, rawStyle }).toBeTruthy();
  });
});
