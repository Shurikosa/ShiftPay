import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "../../utils/theme";
import { FormField } from "../FormField";

describe("FormField", () => {
  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("combines caller, visible, and validation hints without changing controlled input props", async () => {
    const onChangeText = jest.fn();
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <FormField
          label="Password"
          accessibilityLabel="Secure password"
          accessibilityHint="Password requirements"
          hint="At least 8 characters"
          error="Required"
          value="kept"
          onChangeText={onChangeText}
          testID="password"
          inputMode="text"
          autoCapitalize="sentences"
          style={{ marginTop: 3, height: 1, minHeight: 1, minWidth: 1 }}
        />
      );
    });

    const input = view.root.findByType(TextInput);
    expect(input.props).toMatchObject({
      value: "kept",
      testID: "password",
      accessibilityLabel: "Secure password",
      accessibilityHint: "Password requirements. At least 8 characters. Required",
      inputMode: "text",
      autoCapitalize: "sentences"
    });
    expect(StyleSheet.flatten(input.props.style)).toMatchObject({
      marginTop: 3,
      height: 1,
      minHeight: theme.height.control.min,
      minWidth: theme.target.min
    });
    await act(async () => {
      input.props.onChangeText("next");
    });
    expect(onChangeText).toHaveBeenCalledWith("next");
    expect(input.props.value).toBe("kept");
    expect(view.root.findAllByType(Text).map((node) => node.props.children)).toEqual(
      expect.arrayContaining(["Password", "At least 8 characters", "Required"])
    );
  });

  it("uses canonical default, explicit focus, and danger error borders", async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <FormField label="Password" value="kept" onFocus={onFocus} onBlur={onBlur} />
      );
    });

    const input = view.root.findByType(TextInput);
    const shell = view.root.findAllByType(View).find(
      (node) => StyleSheet.flatten(node.props.style)?.borderColor === theme.colors.border
    )!;
    expect(StyleSheet.flatten(shell.props.style)).toMatchObject({
      borderColor: theme.colors.border,
      borderWidth: theme.border.default
    });

    await act(async () => {
      input.props.onFocus({});
    });
    expect(StyleSheet.flatten(shell.props.style)).toMatchObject({
      borderColor: theme.colors.focus,
      borderWidth: 2
    });
    await act(async () => {
      input.props.onBlur({});
    });
    expect(StyleSheet.flatten(shell.props.style)).toMatchObject({
      borderColor: theme.colors.border,
      borderWidth: theme.border.default
    });
    expect(onFocus).toHaveBeenCalled();
    expect(onBlur).toHaveBeenCalled();

    let errorView!: ReactTestRenderer;
    await act(async () => {
      errorView = create(<FormField label="Password" error="Required" value="kept" />);
    });
    const errorShell = errorView.root.findAllByType(View).find(
      (node) => StyleSheet.flatten(node.props.style)?.borderColor === theme.colors.danger.fg
    )!;
    expect(StyleSheet.flatten(errorShell.props.style)).toMatchObject({
      borderColor: theme.colors.danger.fg,
      borderWidth: theme.border.default
    });
    expect(errorView.root.findByType(TextInput).props.accessibilityHint).toContain("Required");
  });

  it("owns an accessible managed trailing action with target, feedback, and disabled state", async () => {
    const onPress = jest.fn();
    const longLabel = "Показати або приховати введений пароль";
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <FormField
          label="Password"
          value="kept"
          trailingAction={{ label: longLabel, onPress }}
        />
      );
    });

    const action = view.root.findAll(
      (node) => node.props.accessibilityLabel === longLabel && node.props.accessibilityRole === "button"
    )[0]!;
    expect(action.props).toMatchObject({
      accessibilityLabel: longLabel,
      accessibilityRole: "button",
      accessibilityState: { disabled: false },
      disabled: false
    });
    expect(StyleSheet.flatten(action.props.style({ pressed: false }))).toMatchObject({
      minWidth: theme.target.min,
      minHeight: theme.target.min,
      maxWidth: "45%",
      flexShrink: 1
    });
    expect(StyleSheet.flatten(action.props.style({ pressed: true }))).toMatchObject({
      backgroundColor: theme.colors.brand.tint
    });
    const actionLabel = view.root.findByProps({ children: longLabel });
    expect(StyleSheet.flatten(actionLabel.props.style)).toMatchObject({ flexShrink: 1 });
    expect(actionLabel.props.numberOfLines).toBeUndefined();
    expect(actionLabel.props.ellipsizeMode).toBeUndefined();

    const input = view.root.findByType(TextInput);
    expect(StyleSheet.flatten(input.props.style)).toMatchObject({
      minWidth: theme.target.min,
      minHeight: theme.height.control.min
    });
    const shell = view.root.findAllByType(View).find(
      (node) => StyleSheet.flatten(node.props.style)?.borderColor === theme.colors.border
    )!;
    expect(StyleSheet.flatten(shell.props.style)).toMatchObject({
      minHeight: theme.height.control.min
    });
    expect(StyleSheet.flatten(shell.props.style)).not.toHaveProperty("height");
    expect(StyleSheet.flatten(shell.props.style)).not.toHaveProperty("maxHeight");
    await act(async () => {
      action.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);

    let disabledView!: ReactTestRenderer;
    await act(async () => {
      disabledView = create(
        <FormField
          label="Password"
          value="kept"
          trailingAction={{ label: "Show password", onPress, disabled: true }}
        />
      );
    });
    const disabledAction = disabledView.root.findAll(
      (node) => node.props.accessibilityLabel === "Show password" && node.props.accessibilityRole === "button"
    )[0]!;
    expect(disabledAction.props).toMatchObject({
      accessibilityState: { disabled: true },
      disabled: true
    });
    expect(StyleSheet.flatten(disabledAction.props.style({ pressed: false }))).toMatchObject({
      minWidth: theme.target.min,
      minHeight: theme.target.min,
      opacity: 0.6
    });
  });
});
