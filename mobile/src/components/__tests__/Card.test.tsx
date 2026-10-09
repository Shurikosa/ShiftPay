import type { ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../utils/theme";
import { Card } from "../Card";

function expectNoFixedOrClippingStyle(style: unknown) {
  const flattened = StyleSheet.flatten(style as never) as Record<string, unknown> | undefined;
  expect(flattened?.height).toBeUndefined();
  expect(flattened?.maxHeight).toBeUndefined();
  expect(flattened?.overflow).toBeUndefined();
}

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
      marginTop: 3,
      ...theme.elevation.overlay
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
      accessible: true,
      accessibilityElementsHidden: false,
      accessibilityLabel: "Open record",
      accessibilityRole: "button",
      "aria-disabled": false,
      "aria-hidden": false,
      "aria-label": "Open record",
      testID: "record",
      disabled: false,
      accessibilityState: { disabled: false },
      importantForAccessibility: "yes",
      onLongPress,
      role: "button"
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
      opacity: 0.9,
      transform: [{ translateY: theme.border.default }]
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

  it("removes both press handlers from a disabled actionable card", async () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    const disabledRuntimeProps = {
      accessibilityLabel: "Disabled record",
      disabled: true,
      onLongPress,
      onPress,
      style: {
        backgroundColor: theme.colors.danger.bg,
        borderStyle: "solid",
        borderWidth: 0,
        opacity: 1,
        transform: [{ scale: 2 }]
      }
    } as unknown as ComponentProps<typeof Card>;
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <Card {...disabledRuntimeProps}>
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
    expect(card.props.onPress).toBeUndefined();
    expect(card.props.onLongPress).toBeUndefined();
    expect(
      view.root.findAll(
        (node) =>
          node.props.accessibilityRole === "button" &&
          (node.props.onPress === onPress || node.props.onLongPress === onLongPress)
      )
    ).toHaveLength(0);

    await act(async () => {
      card.props.onPress?.();
      card.props.onLongPress?.();
    });
    expect(onPress).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();

    const disabledPressedStyle = StyleSheet.flatten(card.props.style({ pressed: true }));
    expect(disabledPressedStyle).toMatchObject({
      minWidth: theme.target.min,
      minHeight: theme.target.min,
      opacity: 0.6
    });
    expect(disabledPressedStyle.transform).toBeUndefined();

    const surface = view.root.findAllByType(View).find(
      (node) => StyleSheet.flatten(node.props.style)?.borderStyle === "dashed"
    )!;
    expect(StyleSheet.flatten(surface.props.style)).toMatchObject({
      backgroundColor: theme.colors.surface.default,
      borderStyle: "dashed",
      borderWidth: theme.border.default
    });
  });

  it("distinguishes a nested subtle surface from the elevated primary surface", async () => {
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
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md
    });
    expect(StyleSheet.flatten(surface.props.style).elevation).toBeUndefined();
    expect(StyleSheet.flatten(surface.props.style).shadowOpacity).toBeUndefined();
  });

  it("keeps authoritative action semantics when wider runtime props conflict", async () => {
    const onPress = jest.fn();
    const widerRuntimeProps = {
      accessibilityElementsHidden: true,
      accessibilityLabel: "Open secure record",
      accessibilityRole: "link",
      accessibilityState: { busy: true, disabled: true, selected: true },
      accessible: false,
      "aria-busy": false,
      "aria-disabled": true,
      "aria-hidden": true,
      "aria-label": "Unsafe label",
      "aria-selected": false,
      disabled: false,
      importantForAccessibility: "no-hide-descendants",
      onPress,
      pointerEvents: "none",
      role: "link",
      testID: "runtime-card"
    } as unknown as ComponentProps<typeof Card>;
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <Card {...widerRuntimeProps}>
          <Text>Content</Text>
        </Card>
      );
    });

    const card = view.root.findAll(
      (node) =>
        node.props.testID === "runtime-card" &&
        node.props.accessibilityRole === "button" &&
        typeof node.props.style === "function"
    )[0]!;
    expect(card.props).toMatchObject({
      accessible: true,
      accessibilityElementsHidden: false,
      accessibilityLabel: "Open secure record",
      accessibilityRole: "button",
      accessibilityState: { busy: true, disabled: false, selected: true },
      "aria-busy": true,
      "aria-disabled": false,
      "aria-hidden": false,
      "aria-label": "Open secure record",
      "aria-selected": true,
      disabled: false,
      importantForAccessibility: "yes",
      pointerEvents: "auto",
      role: "button"
    });

    await act(async () => {
      card.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each(["link", "checkbox", "switch", "button"] as const)(
    "does not let hostile runtime props create passive %s semantics or interaction",
    async (role) => {
      const onPress = jest.fn();
      const onLongPress = jest.fn();
      const onAccessibilityAction = jest.fn();
      const onTouchStart = jest.fn();
      const widerRuntimeProps = {
        accessibilityActions: [{ name: "activate" }],
        accessibilityRole: role,
        onAccessibilityAction,
        onLongPress,
        onPress,
        onTouchStart,
        pointerEvents: "box-only",
        role,
        testID: `passive-runtime-${role}`
      } as unknown as ComponentProps<typeof Card>;
      let view!: ReactTestRenderer;
      await act(async () => {
        view = create(
          <Card {...widerRuntimeProps}>
            <Text>Passive content</Text>
          </Card>
        );
      });

      const surface = view.root.findAllByType(View).find(
        (node) => node.props.testID === `passive-runtime-${role}`
      )!;
      expect(surface.props).toMatchObject({ testID: `passive-runtime-${role}` });
      expect(surface.props.accessibilityActions).toBeUndefined();
      expect(surface.props.accessibilityRole).toBeUndefined();
      expect(surface.props.onAccessibilityAction).toBeUndefined();
      expect(surface.props.onLongPress).toBeUndefined();
      expect(surface.props.onPress).toBeUndefined();
      expect(surface.props.onTouchStart).toBeUndefined();
      expect(surface.props.pointerEvents).toBeUndefined();
      expect(surface.props.role).toBeUndefined();
      expect(onPress).not.toHaveBeenCalled();
      expect(onLongPress).not.toHaveBeenCalled();
      expect(onAccessibilityAction).not.toHaveBeenCalled();
      expect(onTouchStart).not.toHaveBeenCalled();
    }
  );

  it("filters hostile passive styles while retaining safe external layout", async () => {
    const widerRuntimeProps = {
      style: {
        alignSelf: "center",
        backgroundColor: theme.colors.danger.bg,
        borderRadius: 0,
        borderWidth: 0,
        display: "none",
        elevation: 99,
        height: 1,
        marginTop: 7,
        maxHeight: 2,
        opacity: 0,
        overflow: "hidden",
        padding: 0,
        pointerEvents: "none",
        shadowColor: theme.colors.danger.fg,
        shadowOpacity: 1,
        shadowRadius: 99,
        transform: [{ scale: 0 }]
      },
      testID: "hostile-passive-style"
    } as unknown as ComponentProps<typeof Card>;
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <Card {...widerRuntimeProps}>
          <Text>Content</Text>
        </Card>
      );
    });

    const surface = view.root.findAllByType(View).find(
      (node) => node.props.testID === "hostile-passive-style"
    )!;
    const style = StyleSheet.flatten(surface.props.style);
    expect(style).toMatchObject({
      alignSelf: "center",
      backgroundColor: theme.colors.surface.default,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      borderWidth: theme.border.default,
      marginTop: 7,
      padding: theme.padding.card,
      ...theme.elevation.overlay
    });
    expect(style.display).toBeUndefined();
    expect(style.height).toBeUndefined();
    expect(style.maxHeight).toBeUndefined();
    expect(style.opacity).toBeUndefined();
    expect(style.overflow).toBeUndefined();
    expect(style.pointerEvents).toBeUndefined();
    expect(style.transform).toBeUndefined();
  });

  it("filters hostile actionable subtle styles without adding depth or clipping", async () => {
    const onPress = jest.fn();
    const widerRuntimeProps = {
      accessibilityLabel: "Open subtle record",
      onPress,
      style: {
        alignSelf: "flex-end",
        backgroundColor: theme.colors.danger.bg,
        borderRadius: 0,
        borderWidth: 0,
        display: "none",
        elevation: 99,
        height: 1,
        marginBottom: 9,
        maxHeight: 2,
        opacity: 0,
        overflow: "hidden",
        padding: 0,
        pointerEvents: "none",
        shadowColor: theme.colors.danger.fg,
        shadowOpacity: 1,
        shadowRadius: 99,
        transform: [{ scale: 0 }]
      },
      subtle: true,
      testID: "hostile-actionable-style"
    } as unknown as ComponentProps<typeof Card>;
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <Card {...widerRuntimeProps}>
          <Text>Content</Text>
        </Card>
      );
    });

    const control = view.root.findAll(
      (node) =>
        node.props.accessibilityLabel === "Open subtle record" &&
        node.props.accessibilityRole === "button"
    )[0]!;
    const controlStyle = StyleSheet.flatten(control.props.style({ pressed: false }));
    expect(controlStyle).toMatchObject({
      minHeight: theme.target.min,
      minWidth: theme.target.min
    });
    expect(controlStyle.display).toBeUndefined();
    expect(controlStyle.height).toBeUndefined();
    expect(controlStyle.maxHeight).toBeUndefined();
    expect(controlStyle.opacity).toBeUndefined();
    expect(controlStyle.overflow).toBeUndefined();
    expect(controlStyle.transform).toBeUndefined();

    const surface = view.root.findAllByType(View).find(
      (node) => StyleSheet.flatten(node.props.style)?.marginBottom === 9
    )!;
    const style = StyleSheet.flatten(surface.props.style);
    expect(style).toMatchObject({
      alignSelf: "flex-end",
      backgroundColor: theme.colors.surface.subtle,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      borderWidth: theme.border.default,
      marginBottom: 9,
      padding: theme.padding.card
    });
    expect(style.display).toBeUndefined();
    expect(style.elevation).toBeUndefined();
    expect(style.height).toBeUndefined();
    expect(style.maxHeight).toBeUndefined();
    expect(style.opacity).toBeUndefined();
    expect(style.overflow).toBeUndefined();
    expect(style.pointerEvents).toBeUndefined();
    expect(style.shadowColor).toBeUndefined();
    expect(style.shadowOpacity).toBeUndefined();
    expect(style.shadowRadius).toBeUndefined();
    expect(style.transform).toBeUndefined();
  });

  it("allows long content to grow without truncation or a fixed content height", async () => {
    const longContent =
      "Дуже довгий український опис і an equally long English explanation that must wrap on a narrow layout.";
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <Card testID="long-card">
          <Text>{longContent}</Text>
        </Card>
      );
    });

    const surface = view.root.findAllByType(View).find(
      (node) => node.props.testID === "long-card"
    )!;
    const text = view.root.findByProps({ children: longContent });
    const surfaceStyle = StyleSheet.flatten(surface.props.style);
    expectNoFixedOrClippingStyle(surfaceStyle);
    expect(text.props.numberOfLines).toBeUndefined();
    expect(text.props.ellipsizeMode).toBeUndefined();
  });

  it("allows actionable long content to grow without fixed or clipping wrappers", async () => {
    const longContent =
      "Actionable довгий український вміст and long English content that must wrap at a 1.5 font scale.";
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <Card accessibilityLabel="Open long record" onPress={jest.fn()}>
          <Text>{longContent}</Text>
        </Card>
      );
    });

    const control = view.root.findAll(
      (node) =>
        node.props.accessibilityLabel === "Open long record" &&
        node.props.accessibilityRole === "button"
    )[0]!;
    const controlStyle = StyleSheet.flatten(control.props.style({ pressed: false }));
    expect(controlStyle).toMatchObject({
      minHeight: theme.target.min,
      minWidth: theme.target.min
    });
    expectNoFixedOrClippingStyle(controlStyle);

    const surface = view.root.findAllByType(View).find(
      (node) => StyleSheet.flatten(node.props.style)?.backgroundColor === theme.colors.surface.default
    )!;
    expectNoFixedOrClippingStyle(surface.props.style);

    const text = view.root.findByProps({ children: longContent });
    expect(text.props.numberOfLines).toBeUndefined();
    expect(text.props.ellipsizeMode).toBeUndefined();
  });

  it("keeps the passive/actionable public API discriminated and type-safe", () => {
    // @ts-expect-error onLongPress requires the actionable Card branch with onPress.
    const longPressOnly = <Card onLongPress={jest.fn()}><Text>Invalid</Text></Card>;
    // @ts-expect-error disabled is not a passive Card prop.
    const passiveDisabled = <Card disabled><Text>Invalid</Text></Card>;
    // @ts-expect-error android_ripple is Pressable-only and requires onPress.
    const passiveRipple = <Card android_ripple={{ color: theme.colors.brand.tint }}><Text>Invalid</Text></Card>;
    // @ts-expect-error actionable cards require an explicit accessible name.
    const unnamedAction = <Card onPress={jest.fn()}><Text>Invalid</Text></Card>;
    // @ts-expect-error passive cards cannot opt into button semantics.
    const passiveButton = <Card accessibilityRole="button"><Text>Invalid</Text></Card>;
    // @ts-expect-error passive cards cannot opt into link semantics.
    const passiveLink = <Card role="link"><Text>Invalid</Text></Card>;
    // @ts-expect-error passive cards cannot opt into checkbox semantics.
    const passiveCheckbox = <Card accessibilityRole="checkbox"><Text>Invalid</Text></Card>;
    // @ts-expect-error passive cards cannot opt into switch semantics.
    const passiveSwitch = <Card role="switch"><Text>Invalid</Text></Card>;
    // @ts-expect-error passive cards cannot declare accessibility actions.
    const passiveAccessibilityActions = <Card accessibilityActions={[{ name: "activate" }]}><Text>Invalid</Text></Card>;
    // @ts-expect-error passive cards cannot install accessibility callbacks.
    const passiveAccessibilityCallback = <Card onAccessibilityAction={jest.fn()}><Text>Invalid</Text></Card>;
    // @ts-expect-error passive cards cannot install touch callbacks.
    const passiveTouchCallback = <Card onTouchStart={jest.fn()}><Text>Invalid</Text></Card>;
    // @ts-expect-error passive cards cannot control pointer behavior.
    const passivePointerBehavior = <Card pointerEvents="none"><Text>Invalid</Text></Card>;
    // @ts-expect-error Card style cannot override its canonical border.
    const unsafeBorderStyle = <Card style={{ borderWidth: 0 }}><Text>Invalid</Text></Card>;
    // @ts-expect-error Card style cannot add fixed or clipping geometry.
    const unsafeClippingStyle = <Card style={{ height: 1, overflow: "hidden" }}><Text>Invalid</Text></Card>;
    // @ts-expect-error Card style cannot replace surface presentation.
    const unsafeSurfaceStyle = <Card style={{ backgroundColor: theme.colors.danger.bg, borderRadius: 0 }}><Text>Invalid</Text></Card>;
    // @ts-expect-error Card style cannot replace interaction feedback.
    const unsafeFeedbackStyle = <Card style={{ opacity: 0, transform: [{ scale: 0 }] }}><Text>Invalid</Text></Card>;

    expect({
      longPressOnly,
      passiveDisabled,
      passiveRipple,
      unnamedAction,
      passiveButton,
      passiveLink,
      passiveCheckbox,
      passiveSwitch,
      passiveAccessibilityActions,
      passiveAccessibilityCallback,
      passiveTouchCallback,
      passivePointerBehavior,
      unsafeBorderStyle,
      unsafeClippingStyle,
      unsafeSurfaceStyle,
      unsafeFeedbackStyle
    }).toBeTruthy();
  });
});
