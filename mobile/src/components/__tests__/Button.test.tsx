import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { theme } from "../../utils/theme";
import { Button } from "../Button";

describe("Button", () => {
  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it.each([
    ["primary", { backgroundColor: theme.colors.brand.primary }, theme.colors.surface.default],
    ["secondary", { backgroundColor: theme.colors.surface.subtle, borderWidth: theme.border.default, borderColor: theme.colors.border }, theme.colors.ink.primary],
    ["text", { borderWidth: 0 }, theme.colors.brand.primary],
    ["destructive", { backgroundColor: theme.colors.danger.fg }, theme.colors.surface.default],
    ["ghost", { borderWidth: 0 }, theme.colors.brand.primary]
  ] as const)("uses semantic tokens and target sizing for %s", async (variant, containerTokens, labelColor) => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<Button label="A long action label that can wrap" variant={variant} />);
    });

    const button = view.root.findByProps({ accessibilityLabel: "A long action label that can wrap" });
    expect(button.props.accessibilityRole).toBe("button");
    expect(StyleSheet.flatten(button.props.style({ pressed: false }))).toMatchObject({
      minWidth: theme.target.min,
      minHeight: theme.height.control.min,
      ...containerTokens
    });

    const label = view.root.findByType(Text);
    expect(label.props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({
      color: labelColor,
      flexShrink: 1
    });
  });

  it("uses the primary pressed token and merges caller styles", async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<Button label="Styled" style={{ marginTop: 7, minHeight: 1, minWidth: 1 }} />);
    });

    const button = view.root.findByProps({ accessibilityLabel: "Styled" });
    expect(StyleSheet.flatten(button.props.style({ pressed: false }))).toMatchObject({
      marginTop: 7,
      minHeight: theme.height.control.min,
      minWidth: theme.target.min
    });
    expect(StyleSheet.flatten(button.props.style({ pressed: true }))).toMatchObject({
      opacity: 0.86,
      backgroundColor: theme.colors.brand.pressed
    });

    let callbackView!: ReactTestRenderer;
    await act(async () => {
      callbackView = create(
        <Button label="Callback" style={({ pressed }) => ({ marginTop: pressed ? 4 : 2 })} />
      );
    });
    expect(
      StyleSheet.flatten(
        callbackView.root.findByProps({ accessibilityLabel: "Callback" }).props.style({ pressed: true })
      )
    ).toMatchObject({ marginTop: 4 });
  });

  it("exposes loading and disabled state while enabled buttons retain their callback", async () => {
    const onPress = jest.fn();
    let loadingView!: ReactTestRenderer;
    await act(async () => {
      loadingView = create(<Button label="Save" loading onPress={onPress} testID="save" />);
    });
    const loading = loadingView.root.findByProps({ accessibilityLabel: "Save" });
    expect(loading.props.disabled).toBe(true);
    expect(loading.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    expect(StyleSheet.flatten(loading.props.style({ pressed: false }))).toMatchObject({
      minHeight: theme.height.control.min,
      minWidth: theme.target.min,
      opacity: 0.6
    });
    expect(loadingView.root.findByType(ActivityIndicator)).toBeTruthy();

    let enabledView!: ReactTestRenderer;
    await act(async () => {
      enabledView = create(<Button label="Save" onPress={onPress} testID="enabled" />);
    });
    const enabled = enabledView.root.findByProps({ accessibilityLabel: "Save" });
    await act(async () => {
      enabled.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);

    let disabledView!: ReactTestRenderer;
    await act(async () => {
      disabledView = create(
        <Button label="Disabled" disabled accessibilityLabel="Custom" testID="disabled" />
      );
    });
    const disabled = disabledView.root.findAll(
      (node) => node.props.accessibilityLabel === "Custom" && node.props.accessibilityRole === "button"
    )[0]!;
    expect(disabled.props).toMatchObject({
      disabled: true,
      testID: "disabled",
      accessibilityState: { disabled: true, busy: false }
    });
    expect(StyleSheet.flatten(disabled.props.style({ pressed: false }))).toMatchObject({
      opacity: 0.6
    });
  });
});
