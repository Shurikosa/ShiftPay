import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type ViewStyle
} from "react-native";
import { theme } from "../../utils/theme";
import { AppIcon } from "../AppIcon";
import { Button } from "../Button";

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

function expectNoFixedOrClippingStyle(style: unknown): void {
  const flattened = StyleSheet.flatten(style) as ViewStyle | undefined;
  expect(flattened).not.toHaveProperty("height");
  expect(flattened).not.toHaveProperty("maxHeight");
  expect(flattened?.overflow).not.toBe("hidden");
}

async function renderButton(
  props: ComponentProps<typeof Button>
): Promise<ReactTestRenderer> {
  let view!: ReactTestRenderer;
  await act(async () => {
    view = create(<Button {...props} />);
  });
  return view;
}

describe("Button", () => {
  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
  });

  it.each([
    [
      "primary",
      {
        backgroundColor: theme.colors.brand.primary,
        borderColor: theme.colors.brand.primary,
        borderWidth: theme.border.default
      },
      theme.colors.surface.default
    ],
    [
      "secondary",
      {
        backgroundColor: theme.colors.surface.subtle,
        borderColor: theme.colors.border,
        borderWidth: theme.border.default
      },
      theme.colors.ink.primary
    ],
    ["text", { borderWidth: 0 }, theme.colors.brand.primary],
    [
      "destructive",
      {
        backgroundColor: theme.colors.danger.fg,
        borderColor: theme.colors.danger.fg,
        borderWidth: theme.border.default
      },
      theme.colors.surface.default
    ],
    ["ghost", { borderWidth: 0 }, theme.colors.brand.primary]
  ] as const)(
    "keeps the %s variant semantic, labelled, and actionable",
    async (variant, containerTokens, labelColor) => {
      const onPress = jest.fn();
      const label = "A long action label that can wrap";
      const view = await renderButton({ label, onPress, variant });
      const button = view.root.findByProps({ accessibilityLabel: label });

      expect(button.props).toMatchObject({
        accessible: true,
        accessibilityElementsHidden: false,
        accessibilityRole: "button",
        accessibilityState: { busy: false, disabled: false },
        "aria-busy": false,
        "aria-disabled": false,
        "aria-label": label,
        disabled: false,
        hitSlop: { bottom: 0, left: 2, right: 2, top: 0 },
        importantForAccessibility: "yes",
        role: "button"
      });
      const buttonStyle = StyleSheet.flatten(button.props.style({ pressed: false }));
      expect(buttonStyle).toMatchObject({
        minHeight: theme.height.control.min,
        minWidth: theme.target.min,
        ...containerTokens
      });
      expect(
        buttonStyle.minWidth + button.props.hitSlop.left + button.props.hitSlop.right
      ).toBe(theme.height.control.min);

      const visibleLabel = view.root.findByProps({ children: label });
      expect(visibleLabel.type).toBe(Text);
      expect(visibleLabel.props.accessible).toBe(false);
      expect(visibleLabel.props.numberOfLines).toBeUndefined();
      expect(visibleLabel.props.ellipsizeMode).toBeUndefined();
      expect(StyleSheet.flatten(visibleLabel.props.style)).toMatchObject({
        color: labelColor,
        flexShrink: 1,
        textAlign: "center"
      });

      await act(async () => {
        button.props.onPress();
      });
      expect(onPress).toHaveBeenCalledTimes(1);
    }
  );

  it("keeps the visible label and spinner identity during loading while blocking press", async () => {
    const onPress = jest.fn();
    const label = "Зберегти дуже довгу зміну";
    const view = await renderButton({ label, loading: true, onPress });
    const button = view.root.findByProps({ accessibilityLabel: label });

    expect(button.props).toMatchObject({
      accessibilityState: { busy: true, disabled: true },
      "aria-busy": true,
      "aria-disabled": true,
      disabled: true
    });
    expect(button.props.onPress).toBeUndefined();
    expect(button.props.onLongPress).toBeUndefined();
    expect(StyleSheet.flatten(button.props.style({ pressed: false }))).toMatchObject({
      borderStyle: "dashed",
      borderWidth: 2,
      minHeight: theme.height.control.min,
      minWidth: theme.target.min,
      opacity: 0.62
    });

    const visibleLabel = view.root.findByProps({ children: label });
    expect(visibleLabel.type).toBe(Text);
    const spinner = view.root.findByType(ActivityIndicator);
    expect(spinner.props).toMatchObject({
      accessible: false,
      accessibilityElementsHidden: true,
      "aria-hidden": true,
      importantForAccessibility: "no-hide-descendants"
    });

    await act(async () => {
      button.props.onPress?.();
    });
    expect(onPress).not.toHaveBeenCalled();
  });

  it("removes executable press handlers when disabled and uses a structural cue", async () => {
    const onPress = jest.fn();
    const view = await renderButton({
      accessibilityHint: "Unavailable until the form is complete",
      disabled: true,
      label: "Continue",
      onPress,
      testID: "continue"
    });
    const button = view.root.findAll(
      (node) =>
        node.props.testID === "continue" &&
        node.props.accessibilityRole === "button"
    )[0]!;

    expect(button.props).toMatchObject({
      accessibilityHint: "Unavailable until the form is complete",
      accessibilityLabel: "Continue",
      accessibilityState: { busy: false, disabled: true },
      disabled: true
    });
    expect(button.props.onPress).toBeUndefined();
    expect(button.props.onLongPress).toBeUndefined();
    expect(StyleSheet.flatten(button.props.style({ pressed: false }))).toMatchObject({
      borderStyle: "dashed",
      borderWidth: theme.border.default,
      opacity: 0.62
    });

    await act(async () => {
      button.props.onPress?.();
    });
    expect(onPress).not.toHaveBeenCalled();
  });

  it("renders semantic leading and trailing icons as decorative button content", async () => {
    const view = await renderButton({
      label: "Create shift",
      leadingIcon: "create",
      onPress: jest.fn(),
      trailingIcon: "forward"
    });
    const icons = view.root.findAllByType(AppIcon);

    expect(icons.map((icon) => icon.props)).toEqual([
      expect.objectContaining({ name: "create", tone: "inverse" }),
      expect.objectContaining({ name: "forward", tone: "inverse" })
    ]);
    for (const icon of icons) {
      expect(icon.props.accessibilityLabel).toBeUndefined();
    }
    expect(view.root.findAllByType(Ionicons)).toHaveLength(2);
    for (const icon of view.root.findAllByType(Ionicons)) {
      expect(icon.props).toMatchObject({
        accessible: false,
        accessibilityElementsHidden: true,
        "aria-hidden": true,
        importantForAccessibility: "no-hide-descendants"
      });
    }
  });

  it.each([
    ["exact duplicate", "Save", "Save", "Save"],
    [
      "whitespace/case/punctuation equivalent",
      "Save",
      "  sAvE!  ",
      "sAvE!"
    ],
    ["distinct currency symbols", "Pay €", "Pay $", "Pay $. Pay €"],
    ["distinct math symbols", "C", "C++", "C++. C"],
    ["exact semantic symbol duplicate", "Pay €", "Pay €", "Pay €"],
    ["substring false positive", "No", "Not available", "Not available. No"],
    [
      "precomposed separate label part",
      "Retry",
      "Recovery action. Retry",
      "Recovery action. Retry"
    ]
  ])(
    "composes the exact accessible name for %s",
    async (_case, label, accessibilityLabel, expectedName) => {
      const view = await renderButton({
        accessibilityLabel,
        label,
        onPress: jest.fn()
      });
      const button = view.root.findAll(
        (node) =>
          node.props.accessibilityLabel === expectedName &&
          node.props.accessibilityRole === "button"
      )[0]!;

      expect(button.props.accessibilityLabel).toBe(expectedName);
      expect(button.props["aria-label"]).toBe(expectedName);
    }
  );

  it.each([
    ["blank", ""],
    ["whitespace", "   "],
    ["number", 42],
    ["object", { text: "Save" }]
  ])("fails closed for a %s runtime label", async (_case, label) => {
    const onPress = jest.fn();
    const unsafeProps = {
      label,
      leadingIcon: "create",
      onPress
    } as unknown as ComponentProps<typeof Button>;
    const view = await renderButton(unsafeProps);

    expect(view.toJSON()).toBeNull();
    expect(onPress).not.toHaveBeenCalled();
  });

  it("keeps a valid label but disables interaction for a non-function runtime callback", async () => {
    const unsafeProps = {
      label: "Continue",
      onPress: "run"
    } as unknown as ComponentProps<typeof Button>;
    const view = await renderButton(unsafeProps);
    const button = view.root.findByProps({ accessibilityLabel: "Continue" });

    expect(button.props).toMatchObject({
      accessibilityState: { busy: false, disabled: true },
      disabled: true
    });
    expect(button.props.onPress).toBeUndefined();
    expect(button.props.onLongPress).toBeUndefined();
  });

  it("drops invalid runtime icon values without affecting the labelled action", async () => {
    const onPress = jest.fn();
    const unsafeProps = {
      label: "Continue",
      leadingIcon: "mail-outline",
      onPress,
      trailingIcon: { name: "forward" }
    } as unknown as ComponentProps<typeof Button>;
    const view = await renderButton(unsafeProps);
    const button = view.root.findByProps({ accessibilityLabel: "Continue" });

    expect(view.root.findAllByType(AppIcon)).toHaveLength(0);
    expect(view.root.findAllByType(Ionicons)).toHaveLength(0);
    await act(async () => {
      button.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("lets only safe external layout style through at runtime", async () => {
    const hostileStyle = {
      alignSelf: "center",
      backgroundColor: theme.colors.danger.bg,
      borderRadius: 0,
      borderWidth: 0,
      display: "none",
      elevation: 99,
      flex: 1,
      height: 1,
      marginTop: 7,
      maxHeight: 2,
      opacity: 0,
      overflow: "hidden",
      padding: 0,
      shadowColor: theme.colors.danger.fg,
      transform: [{ scale: 0 }]
    } as unknown as ComponentProps<typeof Button>["style"];
    const view = await renderButton({
      label: "Safe surface",
      onPress: jest.fn(),
      style: hostileStyle
    });
    const button = view.root.findByProps({ accessibilityLabel: "Safe surface" });
    const flattened = StyleSheet.flatten(button.props.style({ pressed: false }));

    expect(flattened).toMatchObject({
      alignSelf: "center",
      backgroundColor: theme.colors.brand.primary,
      borderColor: theme.colors.brand.primary,
      borderRadius: theme.radius.sm,
      borderWidth: theme.border.default,
      flex: 1,
      marginTop: 7,
      minHeight: theme.height.control.min,
      minWidth: theme.target.min,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2]
    });
    expect(
      flattened.minWidth + button.props.hitSlop.left + button.props.hitSlop.right
    ).toBe(theme.height.control.min);
    expect(flattened.display).toBeUndefined();
    expect(flattened.elevation).toBeUndefined();
    expect(flattened.height).toBeUndefined();
    expect(flattened.maxHeight).toBeUndefined();
    expect(flattened.opacity).toBeUndefined();
    expect(flattened.overflow).toBeUndefined();
    expect(flattened.shadowColor).toBeUndefined();
    expect(flattened.transform).toBeUndefined();
  });

  it("does not forward hostile runtime semantics, handlers, content, or style", async () => {
    const onPress = jest.fn();
    const onAccessibilityAction = jest.fn();
    const onLongPress = jest.fn();
    const onPressIn = jest.fn();
    const onTouchStart = jest.fn();
    const hostileExtras = {
      accessibilityActions: [{ name: "activate" }],
      accessibilityElementsHidden: true,
      accessibilityLabel: "Forged link",
      accessibilityRole: "link",
      accessibilityState: { busy: true, disabled: true, selected: true },
      accessible: false,
      "aria-busy": true,
      "aria-disabled": true,
      "aria-hidden": true,
      children: <Text>Injected child</Text>,
      onAccessibilityAction,
      onLongPress,
      onPressIn,
      onTouchStart,
      pointerEvents: "none",
      role: "link",
      style: {
        backgroundColor: theme.colors.danger.bg,
        height: 1,
        marginBottom: 9,
        opacity: 0,
        overflow: "hidden",
        transform: [{ scale: 0 }]
      }
    } as unknown as Partial<ComponentProps<typeof Button>>;
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <Button
          {...hostileExtras}
          label="Safe action"
          onPress={onPress}
          testID="safe-action"
        />
      );
    });

    const button = view.root.findAll(
      (node) =>
        node.props.testID === "safe-action" &&
        node.props.accessibilityRole === "button"
    )[0]!;
    expect(button.props).toMatchObject({
      accessible: true,
      accessibilityElementsHidden: false,
      accessibilityLabel: "Forged link. Safe action",
      accessibilityRole: "button",
      accessibilityState: { busy: false, disabled: false },
      "aria-busy": false,
      "aria-disabled": false,
      "aria-hidden": false,
      disabled: false,
      role: "button"
    });
    expect(button.props.accessibilityActions).toBeUndefined();
    expect(button.props.onAccessibilityAction).toBeUndefined();
    expect(button.props.onLongPress).toBeUndefined();
    expect(button.props.onPressIn).toBeUndefined();
    expect(button.props.onTouchStart).toBeUndefined();
    expect(button.props.pointerEvents).toBeUndefined();
    expect(view.root.findAllByProps({ children: "Injected child" })).toHaveLength(0);

    const flattened = StyleSheet.flatten(button.props.style({ pressed: false }));
    expect(flattened).toMatchObject({
      backgroundColor: theme.colors.brand.primary,
      borderRadius: theme.radius.sm,
      marginBottom: 9,
      minHeight: theme.height.control.min
    });
    expect(flattened.height).toBeUndefined();
    expect(flattened.opacity).toBeUndefined();
    expect(flattened.overflow).toBeUndefined();
    expect(flattened.transform).toBeUndefined();

    await act(async () => {
      button.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onAccessibilityAction).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
    expect(onPressIn).not.toHaveBeenCalled();
    expect(onTouchStart).not.toHaveBeenCalled();
  });

  it("allows long icon-supported labels to wrap without fixed or clipping wrappers", async () => {
    const label =
      "Підтвердити дуже довгу дію для зміни and keep the full English action identity visible";
    const view = await renderButton({
      label,
      leadingIcon: "success",
      onPress: jest.fn(),
      trailingIcon: "forward"
    });
    const button = view.root.findByProps({ accessibilityLabel: label });
    const content = view.root
      .findAllByType(View)
      .find((node) => StyleSheet.flatten(node.props.style)?.flexWrap === "wrap")!;
    const visibleLabel = view.root.findByProps({ children: label });

    expectNoFixedOrClippingStyle(button.props.style({ pressed: false }));
    expectNoFixedOrClippingStyle(content.props.style);
    expect(StyleSheet.flatten(content.props.style)).toMatchObject({
      flexShrink: 1,
      flexWrap: "wrap",
      maxWidth: "100%"
    });
    expect(visibleLabel.props.numberOfLines).toBeUndefined();
    expect(visibleLabel.props.ellipsizeMode).toBeUndefined();
  });

  it("uses structural feedback for pressed, disabled, and loading states", async () => {
    const pressedView = await renderButton({ label: "Press", onPress: jest.fn() });
    const pressed = pressedView.root.findByProps({ accessibilityLabel: "Press" });
    expect(StyleSheet.flatten(pressed.props.style({ pressed: true }))).toMatchObject({
      backgroundColor: theme.colors.brand.pressed,
      opacity: 0.88,
      transform: [{ translateY: theme.border.default }]
    });

    const disabledView = await renderButton({
      disabled: true,
      label: "Disabled",
      onPress: jest.fn()
    });
    expect(
      StyleSheet.flatten(
        disabledView.root
          .findByProps({ accessibilityLabel: "Disabled" })
          .props.style({ pressed: false })
      )
    ).toMatchObject({ borderStyle: "dashed" });

    const loadingView = await renderButton({
      label: "Loading",
      loading: true,
      onPress: jest.fn()
    });
    expect(loadingView.root.findByType(ActivityIndicator)).toBeTruthy();
    expect(
      StyleSheet.flatten(
        loadingView.root
          .findByProps({ accessibilityLabel: "Loading" })
          .props.style({ pressed: false })
      )
    ).toMatchObject({ borderStyle: "dashed", borderWidth: 2 });
  });

  it("keeps the public API semantic, labelled, and type-safe", () => {
    type Props = ComponentProps<typeof Button>;
    const onPress = jest.fn();
    const existingConsumer: Props = {
      accessibilityHint: "Creates the shift",
      accessibilityLabel: "Create shift",
      disabled: false,
      label: "Create shift",
      loading: false,
      onPress,
      style: { flex: 1, marginTop: 4 },
      testID: "create-shift",
      variant: "ghost"
    };

    // @ts-expect-error A visible label is required; icon-only buttons are unsupported.
    const iconOnly: Props = { leadingIcon: "create", onPress };
    // @ts-expect-error Button owns its visible children through the required label.
    const arbitraryChildren: Props = { children: <Text>Raw</Text>, label: "Safe", onPress };
    // @ts-expect-error Callers use semantic AppIconName values, not raw glyph names.
    const rawGlyph: Props = { label: "Mail", leadingIcon: "mail-outline", onPress };
    // @ts-expect-error Arbitrary icon nodes are not accepted.
    const rawIconNode: Props = { label: "Mail", leadingIcon: <Text>Raw</Text>, onPress };
    // @ts-expect-error Raw icon colors are not part of the semantic API.
    const rawIconColor: Props = { iconColor: "#000000", label: "Mail", onPress };
    // @ts-expect-error Interaction extensions are not part of the narrow action API.
    const longPress: Props = { label: "Hold", onLongPress: jest.fn(), onPress };
    // @ts-expect-error Caller style cannot replace the authoritative surface.
    const rawSurfaceStyle: Props = { label: "Unsafe", onPress, style: { backgroundColor: "#000000" } };
    // @ts-expect-error Caller style cannot add fixed or clipping geometry.
    const fixedStyle: Props = { label: "Unsafe", onPress, style: { height: 1, overflow: "hidden" } };

    expect({
      arbitraryChildren,
      existingConsumer,
      fixedStyle,
      iconOnly,
      longPress,
      rawGlyph,
      rawIconColor,
      rawIconNode,
      rawSurfaceStyle
    }).toBeTruthy();
  });
});
