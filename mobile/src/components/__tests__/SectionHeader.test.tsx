import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { StyleSheet, View } from "react-native";
import { theme } from "../../utils/theme";
import { AppIcon } from "../AppIcon";
import { SectionHeader } from "../SectionHeader";

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

describe("SectionHeader", () => {
  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("renders the minimal title-only section hierarchy", async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<SectionHeader title="Recent shifts" />);
    });

    const title = view.root.findByProps({ children: "Recent shifts" });
    expect(title.props.accessibilityRole).toBe("header");
    expect(StyleSheet.flatten(title.props.style)).toMatchObject({
      ...theme.typography.sectionTitle,
      color: theme.colors.ink.primary,
      flexShrink: 1
    });
    expect(view.root.findAll((node) => node.props.accessibilityRole === "button")).toHaveLength(0);
  });

  it("renders optional supporting copy without truncation", async () => {
    const supporting = "Останні зміни та recent activity for this section.";
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<SectionHeader title="Activity" supportingText={supporting} />);
    });

    const copy = view.root.findByProps({ children: supporting });
    expect(copy.props.numberOfLines).toBeUndefined();
    expect(copy.props.ellipsizeMode).toBeUndefined();
    expect(StyleSheet.flatten(copy.props.style)).toMatchObject({
      ...theme.typography.supporting,
      color: theme.colors.ink.secondary,
      flexShrink: 1
    });
  });

  it("renders a visible named action with a decorative semantic icon and invokes its callback", async () => {
    const onPress = jest.fn();
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <SectionHeader
          title="Recent shifts"
          action={{ label: "View all shifts", onPress, icon: "forward" }}
        />
      );
    });

    const button = view.root.findByProps({ accessibilityLabel: "View all shifts" });
    expect(button.props).toMatchObject({
      accessible: true,
      accessibilityRole: "button",
      accessibilityState: { disabled: false },
      "aria-disabled": false,
      disabled: false
    });
    expect(StyleSheet.flatten(button.props.style({ pressed: false }))).toMatchObject({
      minWidth: theme.target.min,
      minHeight: theme.target.min,
      maxWidth: "100%",
      flexShrink: 1,
      marginLeft: "auto"
    });
    expect(view.root.findByProps({ children: "View all shifts" })).toBeTruthy();

    const icon = view.root.findByType(AppIcon);
    expect(icon.props).toMatchObject({ name: "forward", size: "metadata", tone: "brand" });
    expect(icon.props.accessibilityLabel).toBeUndefined();
    expect(view.root.findByType(Ionicons).props.accessibilityRole).toBeUndefined();

    await act(async () => {
      button.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("exposes disabled action semantics and removes executable press behavior", async () => {
    const onPress = jest.fn();
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <SectionHeader
          title="Requests"
          action={{ label: "Approve selected requests", onPress, disabled: true }}
        />
      );
    });

    const button = view.root.findByProps({ accessibilityLabel: "Approve selected requests" });
    expect(button.props).toMatchObject({
      accessibilityRole: "button",
      accessibilityState: { disabled: true },
      "aria-disabled": true,
      disabled: true
    });
    expect(button.props.onPress).toBeUndefined();
    expect(StyleSheet.flatten(button.props.style({ pressed: true }))).toMatchObject({
      borderWidth: theme.border.default,
      borderStyle: "dashed",
      opacity: 0.6
    });
    expect(onPress).not.toHaveBeenCalled();
  });

  it("wraps long bilingual copy and action labels in a narrow-safe layout without fixed heights", async () => {
    const title = "Дуже довгий заголовок розділу with an English continuation";
    const supporting = "Пояснювальний текст українською and supporting English copy for a narrow layout.";
    const action = "Переглянути всі доступні записи";
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <SectionHeader
          title={title}
          supportingText={supporting}
          action={{ label: action, onPress: jest.fn() }}
        />
      );
    });

    const wrappingRoot = view.root.findAllByType(View).find((node) => {
      const style = StyleSheet.flatten(node.props.style);
      return style?.width === "100%" && style?.flexWrap === "wrap";
    })!;
    expect(StyleSheet.flatten(wrappingRoot.props.style)).toMatchObject({
      width: "100%",
      flexDirection: "row",
      flexWrap: "wrap"
    });
    expectNoFixedOrClippingStyle(wrappingRoot.props.style);

    const titleNode = view.root.findByProps({ children: title });
    const copyWrapper = titleNode.parent!;
    expectNoFixedOrClippingStyle(copyWrapper.props.style);

    for (const copy of [title, supporting, action]) {
      const text = view.root.findByProps({ children: copy });
      const style = StyleSheet.flatten(text.props.style);
      expect(text.props.numberOfLines).toBeUndefined();
      expect(text.props.ellipsizeMode).toBeUndefined();
      expectNoFixedOrClippingStyle(style);
      expect(style.flexShrink).toBe(1);
    }

    const actionButton = view.root.findByProps({ accessibilityLabel: action });
    const actionStyle = StyleSheet.flatten(actionButton.props.style({ pressed: false }));
    expect(actionStyle).toMatchObject({
      minWidth: theme.target.min,
      minHeight: theme.target.min,
      maxWidth: "100%",
      flexWrap: "wrap"
    });
    expectNoFixedOrClippingStyle(actionStyle);
  });

  it("accepts only semantic AppIcon names for an optional action icon", () => {
    // @ts-expect-error raw icon glyph names are not part of the SectionHeader action API.
    const rawGlyph = <SectionHeader title="Invalid" action={{ label: "Open", onPress: jest.fn(), icon: "arrow-forward-outline" }} />;

    expect(rawGlyph).toBeTruthy();
  });
});
