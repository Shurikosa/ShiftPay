import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { theme } from "../../utils/theme";
import { AppIcon } from "../AppIcon";
import { ScreenHeader } from "../ScreenHeader";

jest.mock("@expo/vector-icons/Ionicons", () => {
  const actualReact = jest.requireActual<typeof import("react")>("react");
  const { Text: NativeText } = jest.requireActual<typeof import("react-native")>("react-native");
  const MockIonicons = (props: Record<string, unknown>) =>
    actualReact.createElement(NativeText, props as ComponentProps<typeof NativeText>);

  return { __esModule: true, default: MockIonicons };
});

function expectNoFixedOrClippingStyle(style: unknown) {
  const flattened = StyleSheet.flatten(style as never) as Record<string, unknown> | undefined;
  expect(flattened?.height).toBeUndefined();
  expect(flattened?.maxHeight).toBeUndefined();
  expect(flattened?.overflow).toBeUndefined();
}

describe("ScreenHeader", () => {
  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("renders a full-width title-only copy block without action semantics or truncation", async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<ScreenHeader title="A long title that remains readable" />);
    });

    const title = view.root.findAllByType(Text).find(
      (node) => node.props.children === "A long title that remains readable"
    )!;
    expect(title.props.numberOfLines).toBeUndefined();
    expect(title.props.ellipsizeMode).toBeUndefined();
    expect(title.props.accessibilityRole).toBe("header");
    expect(StyleSheet.flatten(title.props.style)).toMatchObject({
      ...theme.typography.screenTitle,
      color: theme.colors.ink.primary
    });
    expect(StyleSheet.flatten(title.parent!.props.style)).toMatchObject({ width: "100%" });
    expect(StyleSheet.flatten(title.parent!.props.style).flexDirection).toBeUndefined();
    expectNoFixedOrClippingStyle(title.parent!.props.style);
    expectNoFixedOrClippingStyle(title.parent!.parent!.props.style);
    expect(view.root.findAll((node) => node.props.accessibilityRole === "button")).toHaveLength(0);
  });

  it("separates a wrapping action region from full-width copy and renders all optional content", async () => {
    const back = jest.fn();
    const action = jest.fn();
    const backLabel = "Повернутися до попереднього екрана";
    const actionLabel = "Зберегти всі налаштування компанії";
    const titleText = "A deliberately long localized title that can wrap";
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <ScreenHeader
          eyebrow="Foreman"
          title={titleText}
          subtitle="Supporting text that remains fully visible"
          backAction={{ label: backLabel, onPress: back }}
          action={{ label: actionLabel, onPress: action }}
        >
          <Text testID="header-child">Additional header content</Text>
        </ScreenHeader>
      );
    });

    const actionsRegion = view.root.findAllByType(View).find((node) => {
      const style = StyleSheet.flatten(node.props.style);
      return style?.flexDirection === "row" && style?.flexWrap === "wrap";
    })!;
    expect(StyleSheet.flatten(actionsRegion.props.style)).toMatchObject({
      width: "100%",
      flexDirection: "row",
      flexWrap: "wrap"
    });
    expectNoFixedOrClippingStyle(actionsRegion.props.style);

    const title = view.root.findAllByType(Text).find(
      (node) => node.props.children === titleText
    )!;
    const copy = title.parent!;
    expect(copy).not.toBe(actionsRegion);
    expect(StyleSheet.flatten(copy.props.style)).toMatchObject({ width: "100%" });
    expect(StyleSheet.flatten(copy.props.style).flexDirection).toBeUndefined();
    expectNoFixedOrClippingStyle(copy.props.style);
    expectNoFixedOrClippingStyle(copy.parent!.props.style);
    expect(title.props.numberOfLines).toBeUndefined();
    expect(title.props.ellipsizeMode).toBeUndefined();

    expect(view.root.findAllByType(Text).map((node) => node.props.children)).toEqual(
      expect.arrayContaining([
        "Foreman",
        titleText,
        "Supporting text that remains fully visible",
        "Additional header content",
        backLabel,
        actionLabel
      ])
    );
    expect(view.root.findByProps({ testID: "header-child" })).toBeTruthy();

    const buttons = view.root.findAll(
      (node) => node.props.accessibilityRole === "button" && typeof node.props.onPress === "function"
    );
    expect(buttons).toHaveLength(2);
    const backButton = buttons.find((node) => node.props.accessibilityLabel === backLabel)!;
    const actionButton = buttons.find((node) => node.props.accessibilityLabel === actionLabel)!;

    expect(backButton.props.accessibilityState).toEqual({ disabled: false, busy: false });
    expect(actionButton.props.accessibilityState).toEqual({ disabled: false, busy: false });
    const backIcon = view.root.findByType(AppIcon);
    expect(backIcon.props).toMatchObject({ name: "back", size: "control", tone: "brand" });
    expect(backIcon.props.accessibilityLabel).toBeUndefined();
    expect(view.root.findByType(Ionicons).props.accessibilityRole).toBeUndefined();

    for (const button of [backButton, actionButton]) {
      const unpressedStyle = StyleSheet.flatten(button.props.style({ pressed: false }));
      expect(unpressedStyle).toMatchObject({
        minWidth: theme.target.min,
        minHeight: theme.target.min,
        maxWidth: "100%",
        flexShrink: 1
      });
      expect(unpressedStyle.backgroundColor).toBeUndefined();
      expectNoFixedOrClippingStyle(unpressedStyle);
      expect(StyleSheet.flatten(button.props.style({ pressed: true }))).toMatchObject({
        backgroundColor: theme.colors.brand.tint,
        transform: [{ translateY: theme.border.default }]
      });
      expectNoFixedOrClippingStyle(button.props.style({ pressed: true }));
    }

    const actionLabels = view.root.findAllByType(Text).filter(
      (node) => node.props.children === backLabel || node.props.children === actionLabel
    );
    expect(actionLabels).toHaveLength(2);
    for (const label of actionLabels) {
      expect(label.props.numberOfLines).toBeUndefined();
      expect(label.props.ellipsizeMode).toBeUndefined();
      expect(StyleSheet.flatten(label.props.style)).toMatchObject({ flexShrink: 1 });
      expectNoFixedOrClippingStyle(label.props.style);
    }

    await act(async () => {
      backButton.props.onPress();
      actionButton.props.onPress();
    });
    expect(back).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("exposes disabled and busy action state without removing the visible action identity", async () => {
    const disabledPress = jest.fn();
    const busyPress = jest.fn();
    let disabledView!: ReactTestRenderer;
    await act(async () => {
      disabledView = create(
        <ScreenHeader
          title="Settings"
          action={{ label: "Save changes", onPress: disabledPress, disabled: true }}
        />
      );
    });

    const disabled = disabledView.root.findByProps({ accessibilityLabel: "Save changes" });
    expect(disabled.props).toMatchObject({
      accessibilityRole: "button",
      accessibilityState: { disabled: true, busy: false },
      "aria-busy": false,
      "aria-disabled": true,
      disabled: true
    });
    expect(disabled.props.onPress).toBeUndefined();
    expect(StyleSheet.flatten(disabled.props.style({ pressed: true }))).toMatchObject({
      borderWidth: theme.border.default,
      borderStyle: "dashed",
      opacity: 0.6
    });
    expect(disabledView.root.findByProps({ children: "Save changes" })).toBeTruthy();

    let busyView!: ReactTestRenderer;
    await act(async () => {
      busyView = create(
        <ScreenHeader
          title="Settings"
          action={{ label: "Saving changes", onPress: busyPress, busy: true }}
        />
      );
    });

    const busy = busyView.root.findByProps({ accessibilityLabel: "Saving changes" });
    expect(busy.props).toMatchObject({
      accessibilityState: { disabled: true, busy: true },
      "aria-busy": true,
      "aria-disabled": true,
      disabled: true
    });
    expect(busy.props.onPress).toBeUndefined();
    expect(busyView.root.findByProps({ children: "Saving changes" })).toBeTruthy();
    const indicator = busyView.root.findByType(ActivityIndicator);
    expect(indicator.props).toMatchObject({
      accessibilityElementsHidden: true,
      accessible: false,
      "aria-hidden": true,
      importantForAccessibility: "no-hide-descendants"
    });
    expect(disabledPress).not.toHaveBeenCalled();
    expect(busyPress).not.toHaveBeenCalled();
  });

  it("keeps long title, subtitle, and action labels wrapping without fixed content heights", async () => {
    const longTitle = "Надзвичайно довгий заголовок екрана that remains readable at increased font scale";
    const longSubtitle = "Пояснення українською та English supporting copy that wraps on a narrow phone.";
    const longAction = "Зберегти всі довгі налаштування";
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <ScreenHeader
          title={longTitle}
          subtitle={longSubtitle}
          action={{ label: longAction, onPress: jest.fn() }}
        />
      );
    });

    for (const copy of [longTitle, longSubtitle, longAction]) {
      const text = view.root.findByProps({ children: copy });
      const style = StyleSheet.flatten(text.props.style);
      expect(text.props.numberOfLines).toBeUndefined();
      expect(text.props.ellipsizeMode).toBeUndefined();
      expectNoFixedOrClippingStyle(style);
    }

    const title = view.root.findByProps({ children: longTitle });
    const copyWrapper = title.parent!;
    const rootWrapper = copyWrapper.parent!;
    const actionsWrapper = view.root.findAllByType(View).find((node) => {
      const style = StyleSheet.flatten(node.props.style);
      return style?.width === "100%" && style?.flexWrap === "wrap";
    })!;
    expectNoFixedOrClippingStyle(rootWrapper.props.style);
    expectNoFixedOrClippingStyle(copyWrapper.props.style);
    expectNoFixedOrClippingStyle(actionsWrapper.props.style);

    const button = view.root.findByProps({ accessibilityLabel: longAction });
    const actionStyle = StyleSheet.flatten(button.props.style({ pressed: false }));
    expect(actionStyle).toMatchObject({
      minWidth: theme.target.min,
      minHeight: theme.target.min,
      maxWidth: "100%",
      flexShrink: 1,
      flexWrap: "wrap",
      marginLeft: "auto"
    });
    expectNoFixedOrClippingStyle(actionStyle);
  });
});
