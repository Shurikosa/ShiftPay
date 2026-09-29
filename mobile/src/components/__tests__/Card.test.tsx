import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../utils/theme";
import { Card } from "../Card";

describe("Card", () => {
  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("renders a passive canonical surface without implicit button semantics", async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <Card style={{ marginTop: 3 }}>
          <Text>Content</Text>
        </Card>
      );
    });

    const surface = view.root.findByType(View);
    expect(StyleSheet.flatten(surface.props.style)).toMatchObject({
      backgroundColor: theme.colors.surface.default,
      borderWidth: theme.border.default,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      padding: theme.padding.card,
      marginTop: 3
    });
    expect(view.root.findByProps({ children: "Content" })).toBeTruthy();
    expect(view.root.findAll((node) => node.props.accessibilityRole === "button")).toHaveLength(0);
    expect(surface.props.accessibilityState).toBeUndefined();
  });

  it("forwards passive View test, accessibility, native, and handler props to the surface", async () => {
    const onLayout = jest.fn();
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <Card
          testID="passive-card"
          nativeID="passive-native"
          accessible
          accessibilityLabel="Record summary"
          accessibilityHint="Contains record details"
          onLayout={onLayout}
        >
          <Text>Content</Text>
        </Card>
      );
    });

    const surface = view.root.findAllByType(View).find(
      (node) => node.props.testID === "passive-card"
    )!;
    expect(surface.props).toMatchObject({
      testID: "passive-card",
      nativeID: "passive-native",
      accessible: true,
      accessibilityLabel: "Record summary",
      accessibilityHint: "Contains record details",
      onLayout
    });
    await act(async () => {
      surface.props.onLayout({});
    });
    expect(onLayout).toHaveBeenCalledTimes(1);
  });

  it("forwards actionable props and keeps target, surface, and enabled press feedback", async () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <Card
          accessibilityLabel="Open record"
          onPress={onPress}
          onLongPress={onLongPress}
          testID="record"
          style={{ marginTop: 5 }}
        >
          <Text>Content</Text>
        </Card>
      );
    });

    const card = view.root.findAll(
      (node) =>
        node.props.accessibilityLabel === "Open record" &&
        node.props.accessibilityRole === "button" &&
        typeof node.props.onPress === "function"
    )[0]!;
    expect(card.props).toMatchObject({
      testID: "record",
      disabled: false,
      accessibilityState: { disabled: false },
      onLongPress
    });

    const unpressedStyle = StyleSheet.flatten(card.props.style({ pressed: false }));
    expect(unpressedStyle).toMatchObject({
      minWidth: theme.target.min,
      minHeight: theme.target.min
    });
    expect(unpressedStyle.opacity).toBeUndefined();
    expect(StyleSheet.flatten(card.props.style({ pressed: true }))).toMatchObject({
      minWidth: theme.target.min,
      minHeight: theme.target.min,
      opacity: 0.86
    });

    const surface = view.root.findAllByType(View).find(
      (node) => StyleSheet.flatten(node.props.style)?.backgroundColor === theme.colors.surface.default
    )!;
    expect(StyleSheet.flatten(surface.props.style)).toMatchObject({
      borderWidth: theme.border.default,
      borderRadius: theme.radius.lg,
      padding: theme.padding.card,
      marginTop: 5
    });

    await act(async () => {
      card.props.onPress();
      card.props.onLongPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("uses disabled actionable semantics without enabled pressed presentation", async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <Card disabled onPress={jest.fn()} accessibilityLabel="Disabled record">
          <Text>Content</Text>
        </Card>
      );
    });

    const card = view.root.findAll(
      (node) =>
        node.props.accessibilityLabel === "Disabled record" &&
        node.props.accessibilityRole === "button"
    )[0]!;
    expect(card.props).toMatchObject({
      disabled: true,
      accessibilityState: { disabled: true }
    });
    const disabledPressedStyle = StyleSheet.flatten(card.props.style({ pressed: true }));
    expect(disabledPressedStyle).toMatchObject({
      minWidth: theme.target.min,
      minHeight: theme.target.min,
      opacity: 0.6
    });
    expect(disabledPressedStyle.opacity).not.toBe(0.86);
  });

  it("uses the canonical subtle surface token", async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <Card subtle testID="subtle-card">
          <Text>Content</Text>
        </Card>
      );
    });

    const surface = view.root.findAllByType(View).find(
      (node) => node.props.testID === "subtle-card"
    )!;
    expect(StyleSheet.flatten(surface.props.style)).toMatchObject({
      backgroundColor: theme.colors.surface.subtle,
      borderColor: theme.colors.border
    });
  });

  it("rejects press handlers and pressable-only props without an actionable callback", () => {
    // @ts-expect-error onLongPress requires the actionable Card branch with onPress.
    const longPressOnly = <Card onLongPress={jest.fn()}><Text>Invalid</Text></Card>;
    // @ts-expect-error disabled is not a passive Card prop.
    const passiveDisabled = <Card disabled><Text>Invalid</Text></Card>;
    // @ts-expect-error android_ripple is Pressable-only and requires onPress.
    const passiveRipple = <Card android_ripple={{ color: theme.colors.brand.tint }}><Text>Invalid</Text></Card>;

    expect(longPressOnly).toBeTruthy();
    expect(passiveDisabled).toBeTruthy();
    expect(passiveRipple).toBeTruthy();
  });
});
