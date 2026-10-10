import Ionicons from "@expo/vector-icons/Ionicons";
import { createRef, type ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle
} from "react-native";
import { theme } from "../../utils/theme";
import { AppIcon } from "../AppIcon";
import {
  FormField,
  type FormFieldTrailingAction
} from "../FormField";

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

function findInputShell(view: ReactTestRenderer) {
  return view.root.findAllByType(View).find((node) => {
    const style = StyleSheet.flatten(node.props.style);
    return (
      style?.borderRadius === theme.radius.md &&
      style?.minHeight === theme.height.control.min &&
      style?.flexDirection === "row"
    );
  })!;
}

function findTrailingAction(view: ReactTestRenderer, label: string) {
  return view.root.findAll(
    (node) =>
      node.props.accessibilityLabel === label &&
      node.props.accessibilityRole === "button"
  )[0]!;
}

function expectNoFixedOrClippingStyle(style: unknown): void {
  const flattened = StyleSheet.flatten(style) as ViewStyle | undefined;
  expect(flattened).not.toHaveProperty("height");
  expect(flattened).not.toHaveProperty("maxHeight");
  expect(flattened?.overflow).not.toBe("hidden");
}

async function renderField(
  props: ComponentProps<typeof FormField>
): Promise<ReactTestRenderer> {
  let view!: ReactTestRenderer;
  await act(async () => {
    view = create(<FormField {...props} />);
  });
  return view;
}

const allowlistedTextInputCallbacks = [
  "onBlur",
  "onChange",
  "onChangeText",
  "onContentSizeChange",
  "onEndEditing",
  "onFocus",
  "onKeyPress",
  "onSelectionChange",
  "onSubmitEditing"
] as const;

describe("FormField", () => {
  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("keeps a persistent label and composes hint/error accessibility without changing controlled input", async () => {
    const onChangeText = jest.fn();
    const view = await renderField({
      accessibilityHint: "Password requirements",
      accessibilityLabel: "Secure password",
      autoCapitalize: "sentences",
      autoComplete: "current-password",
      error: "Required",
      hint: "At least 8 characters",
      inputMode: "text",
      keyboardType: "default",
      label: "Password",
      onChangeText,
      secureTextEntry: true,
      testID: "password",
      textContentType: "password",
      value: "kept"
    });

    const input = view.root.findByType(TextInput);
    expect(input.props).toMatchObject({
      accessibilityHint: "Password requirements. At least 8 characters. Required",
      accessibilityLabel: "Secure password. Password",
      accessibilityState: { disabled: false },
      "aria-disabled": false,
      "aria-invalid": true,
      autoCapitalize: "sentences",
      autoComplete: "current-password",
      inputMode: "text",
      keyboardType: "default",
      placeholderTextColor: theme.colors.ink.muted,
      secureTextEntry: true,
      testID: "password",
      textContentType: "password",
      value: "kept"
    });
    await act(async () => {
      input.props.onChangeText("next");
    });
    expect(onChangeText).toHaveBeenCalledWith("next");
    expect(input.props.value).toBe("kept");

    const visibleCopy = view.root
      .findAllByType(Text)
      .map((node) => node.props.children);
    expect(visibleCopy).toEqual(
      expect.arrayContaining(["Password", "At least 8 characters", "Required"])
    );
    const error = view.root.findByProps({ children: "Required" });
    expect(error.props).toMatchObject({
      accessibilityLiveRegion: "polite",
      accessibilityRole: "alert"
    });
  });

  it("forwards refs and safe keyboard/content TextInput props", async () => {
    const inputRef = createRef<TextInput>();
    const nativeInput = { blur: jest.fn(), focus: jest.fn() };
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <FormField
          autoCorrect={false}
          enterKeyHint="next"
          label="Email"
          maxLength={128}
          onSubmitEditing={jest.fn()}
          placeholder="worker@example.com"
          ref={inputRef}
          returnKeyType="next"
          selectTextOnFocus
          value="worker@example.com"
        />,
        {
          createNodeMock: (element) =>
            element.type === TextInput ? nativeInput : null
        }
      );
    });

    expect(view.root.findByType(TextInput).props).toMatchObject({
      autoCorrect: false,
      enterKeyHint: "next",
      maxLength: 128,
      placeholder: "worker@example.com",
      returnKeyType: "next",
      selectTextOnFocus: true,
      value: "worker@example.com"
    });
    expect(inputRef.current).not.toBeNull();
  });

  it("uses distinct default, focus, error, and disabled field treatments", async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const view = await renderField({
      label: "Company name",
      onBlur,
      onFocus,
      value: "ShiftPay"
    });
    const input = view.root.findByType(TextInput);
    const shell = findInputShell(view);

    expect(StyleSheet.flatten(shell.props.style)).toMatchObject({
      backgroundColor: theme.colors.surface.default,
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
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);

    const errorView = await renderField({
      error: "This value is required",
      label: "Company name",
      value: ""
    });
    expect(StyleSheet.flatten(findInputShell(errorView).props.style)).toMatchObject({
      borderColor: theme.colors.danger.fg,
      borderWidth: 2
    });
    expect(errorView.root.findByType(TextInput).props.accessibilityHint).toContain(
      "This value is required"
    );

    const disabledView = await renderField({
      editable: false,
      label: "Company name",
      value: "ShiftPay"
    });
    const disabledInput = disabledView.root.findByType(TextInput);
    expect(disabledInput.props).toMatchObject({
      accessibilityState: { disabled: true },
      "aria-disabled": true,
      editable: false
    });
    expect(StyleSheet.flatten(findInputShell(disabledView).props.style)).toMatchObject({
      backgroundColor: theme.colors.surface.subtle,
      borderStyle: "dashed"
    });
  });

  it("applies leading-icon tone precedence across default, focus, error, and disabled states", async () => {
    const view = await renderField({
      label: "Email",
      leadingIcon: "email",
      value: "worker@example.com"
    });
    const input = view.root.findByType(TextInput);

    expect(view.root.findByType(AppIcon).props.tone).toBe("secondary");
    await act(async () => {
      input.props.onFocus({});
    });
    expect(view.root.findByType(AppIcon).props.tone).toBe("brand");
    await act(async () => {
      input.props.onBlur({});
    });
    expect(view.root.findByType(AppIcon).props.tone).toBe("secondary");

    const errorView = await renderField({
      error: "Required",
      label: "Email",
      leadingIcon: "email",
      value: ""
    });
    const errorInput = errorView.root.findByType(TextInput);
    expect(errorView.root.findByType(AppIcon).props.tone).toBe("error");
    await act(async () => {
      errorInput.props.onFocus({});
    });
    expect(errorView.root.findByType(AppIcon).props.tone).toBe("error");

    const disabledView = await renderField({
      editable: false,
      label: "Email",
      leadingIcon: "email",
      value: "worker@example.com"
    });
    expect(disabledView.root.findByType(AppIcon).props.tone).toBe("muted");

    const disabledErrorView = await renderField({
      editable: false,
      error: "Required",
      label: "Email",
      leadingIcon: "email",
      value: ""
    });
    expect(disabledErrorView.root.findByType(AppIcon).props.tone).toBe("muted");
  });

  it("supports decorative leading and trailing semantic icons with a visible action", async () => {
    const onPress = jest.fn();
    const label = "Показати або приховати введений пароль";
    const view = await renderField({
      label: "Password",
      leadingIcon: "password",
      secureTextEntry: true,
      trailingAction: {
        icon: "visibilityOn",
        label,
        onPress,
        testID: "password-visibility"
      },
      value: "secret"
    });
    const action = findTrailingAction(view, label);

    expect(view.root.findByType(TextInput).props.secureTextEntry).toBe(true);
    expect(action.props).toMatchObject({
      accessible: true,
      accessibilityElementsHidden: false,
      accessibilityLabel: label,
      accessibilityRole: "button",
      accessibilityState: { disabled: false },
      "aria-disabled": false,
      disabled: false,
      role: "button",
      testID: "password-visibility"
    });
    expect(StyleSheet.flatten(action.props.style({ pressed: false }))).toMatchObject({
      maxWidth: "45%",
      minHeight: theme.target.min,
      minWidth: theme.target.min
    });
    expect(StyleSheet.flatten(action.props.style({ pressed: true }))).toMatchObject({
      backgroundColor: theme.colors.brand.tint,
      borderColor: theme.colors.brand.primary,
      transform: [{ translateY: theme.border.default }]
    });

    const actionLabel = view.root.findByProps({ children: label });
    expect(actionLabel.type).toBe(Text);
    expect(actionLabel.props.numberOfLines).toBeUndefined();
    expect(actionLabel.props.ellipsizeMode).toBeUndefined();
    expect(view.root.findAllByType(AppIcon).map((icon) => icon.props.name)).toEqual([
      "password",
      "visibilityOn"
    ]);
    expect(view.root.findAllByType(AppIcon).map((icon) => icon.props.tone)).toEqual([
      "secondary",
      "brand"
    ]);
    for (const icon of view.root.findAllByType(Ionicons)) {
      expect(icon.props).toMatchObject({
        accessible: false,
        accessibilityElementsHidden: true,
        "aria-hidden": true,
        importantForAccessibility: "no-hide-descendants"
      });
      expect(icon.props.accessibilityLabel).toBeUndefined();
    }

    await act(async () => {
      action.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("removes the disabled trailing action handler and exposes disabled semantics", async () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    const trailingAction = {
      disabled: true,
      icon: "visibilityOff",
      label: "Show password",
      onLongPress,
      onPress
    } as unknown as FormFieldTrailingAction;
    const view = await renderField({ label: "Password", trailingAction, value: "kept" });
    const action = findTrailingAction(view, "Show password");

    expect(action.props).toMatchObject({
      accessibilityState: { disabled: true },
      "aria-disabled": true,
      disabled: true
    });
    expect(action.props.onPress).toBeUndefined();
    expect(action.props.onLongPress).toBeUndefined();
    expect(StyleSheet.flatten(action.props.style({ pressed: false }))).toMatchObject({
      borderStyle: "dashed",
      borderWidth: theme.border.default,
      minHeight: theme.target.min,
      minWidth: theme.target.min,
      opacity: 0.62
    });
    expect(view.root.findByType(AppIcon).props).toMatchObject({
      name: "visibilityOff",
      tone: "muted"
    });

    await act(async () => {
      action.props.onPress?.();
      action.props.onLongPress?.();
    });
    expect(onPress).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("does not forward hostile runtime input or trailing-action props", async () => {
    const onChangeText = jest.fn();
    const onAccessibilityAction = jest.fn();
    const onInputPress = jest.fn();
    const onTrailingPress = jest.fn();
    const onTrailingLongPress = jest.fn();
    const hostileInputExtras = {
      accessibilityActions: [{ name: "activate" }],
      accessibilityLabel: "Forged link",
      accessibilityRole: "link",
      accessibilityState: { busy: true, disabled: true },
      children: <Text>Injected input child</Text>,
      onAccessibilityAction,
      onPress: onInputPress,
      placeholderTextColor: theme.colors.danger.fg,
      pointerEvents: "none",
      role: "link",
      style: {
        backgroundColor: theme.colors.danger.bg,
        color: theme.colors.danger.fg,
        height: 1,
        maxHeight: 2,
        overflow: "hidden"
      }
    } as unknown as Partial<ComponentProps<typeof FormField>>;
    const hostileTrailingAction = {
      accessibilityLabel: "Forged trailing link",
      accessibilityRole: "link",
      accessibilityState: { disabled: true },
      children: <Text>Injected action child</Text>,
      label: "Reveal value",
      onLongPress: onTrailingLongPress,
      onPress: onTrailingPress,
      pointerEvents: "none",
      role: "link",
      style: { height: 1, overflow: "hidden" }
    } as unknown as FormFieldTrailingAction;
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <FormField
          {...hostileInputExtras}
          label="Email"
          onChangeText={onChangeText}
          trailingAction={hostileTrailingAction}
          value="worker@example.com"
        />
      );
    });

    const input = view.root.findByType(TextInput);
    expect(input.props).toMatchObject({
      accessibilityLabel: "Forged link. Email",
      accessibilityState: { disabled: false },
      "aria-disabled": false,
      placeholderTextColor: theme.colors.ink.muted,
      value: "worker@example.com"
    });
    expect(input.props.accessibilityActions).toBeUndefined();
    expect(input.props.accessibilityRole).toBeUndefined();
    expect(input.props.onAccessibilityAction).toBeUndefined();
    expect(input.props.onPress).toBeUndefined();
    expect(input.props.pointerEvents).toBeUndefined();
    expect(input.props.role).toBeUndefined();
    const inputStyle = StyleSheet.flatten(input.props.style);
    expect(inputStyle).toMatchObject({
      color: theme.colors.ink.primary,
      minHeight: theme.height.control.min,
      minWidth: theme.target.min
    });
    expect(inputStyle.backgroundColor).toBeUndefined();
    expect(inputStyle.height).toBeUndefined();
    expect(inputStyle.maxHeight).toBeUndefined();
    expect(inputStyle.overflow).toBeUndefined();

    const action = findTrailingAction(view, "Reveal value");
    expect(action.props).toMatchObject({
      accessibilityLabel: "Reveal value",
      accessibilityRole: "button",
      accessibilityState: { disabled: false },
      disabled: false,
      role: "button"
    });
    expect(action.props.onLongPress).toBeUndefined();
    expect(action.props.pointerEvents).toBeUndefined();
    expect(view.root.findAllByProps({ children: "Injected input child" })).toHaveLength(0);
    expect(view.root.findAllByProps({ children: "Injected action child" })).toHaveLength(0);

    await act(async () => {
      input.props.onChangeText("next@example.com");
      action.props.onPress();
    });
    expect(onChangeText).toHaveBeenCalledWith("next@example.com");
    expect(onTrailingPress).toHaveBeenCalledTimes(1);
    expect(onAccessibilityAction).not.toHaveBeenCalled();
    expect(onInputPress).not.toHaveBeenCalled();
    expect(onTrailingLongPress).not.toHaveBeenCalled();
  });

  it.each(allowlistedTextInputCallbacks)(
    "filters a non-function runtime %s value from the native input",
    async (callbackProp) => {
      const unsafeProps = {
        label: "Email",
        [callbackProp]: { executable: false },
        value: "worker@example.com"
      } as unknown as ComponentProps<typeof FormField>;
      const view = await renderField(unsafeProps);
      const input = view.root.findByType(TextInput);

      if (callbackProp === "onFocus" || callbackProp === "onBlur") {
        expect(typeof input.props[callbackProp]).toBe("function");
      } else {
        expect(input.props[callbackProp]).toBeUndefined();
      }
    }
  );

  it("safely updates focus state when runtime focus callbacks are invalid", async () => {
    const unsafeProps = {
      label: "Email",
      leadingIcon: "email",
      onBlur: 42,
      onFocus: "focus",
      value: "worker@example.com"
    } as unknown as ComponentProps<typeof FormField>;
    const view = await renderField(unsafeProps);
    const input = view.root.findByType(TextInput);

    expect(view.root.findByType(AppIcon).props.tone).toBe("secondary");
    await act(async () => {
      input.props.onFocus({ nativeEvent: { source: "focus" } });
    });
    expect(view.root.findByType(AppIcon).props.tone).toBe("brand");
    await act(async () => {
      input.props.onBlur({ nativeEvent: { source: "blur" } });
    });
    expect(view.root.findByType(AppIcon).props.tone).toBe("secondary");
  });

  it("forwards each valid allowlisted callback exactly once with its original argument", async () => {
    const callbacks = {
      onBlur: jest.fn(),
      onChange: jest.fn(),
      onChangeText: jest.fn(),
      onContentSizeChange: jest.fn(),
      onEndEditing: jest.fn(),
      onFocus: jest.fn(),
      onKeyPress: jest.fn(),
      onSelectionChange: jest.fn(),
      onSubmitEditing: jest.fn()
    };
    const view = await renderField({
      ...callbacks,
      label: "Email",
      value: "worker@example.com"
    });
    const input = view.root.findByType(TextInput);
    const argumentsByCallback = {
      onBlur: { nativeEvent: { source: "blur" } },
      onChange: { nativeEvent: { text: "changed" } },
      onChangeText: "changed",
      onContentSizeChange: { nativeEvent: { contentSize: { height: 48, width: 200 } } },
      onEndEditing: { nativeEvent: { text: "ended" } },
      onFocus: { nativeEvent: { source: "focus" } },
      onKeyPress: { nativeEvent: { key: "Enter" } },
      onSelectionChange: {
        nativeEvent: { selection: { end: 3, start: 1 } }
      },
      onSubmitEditing: { nativeEvent: { text: "submitted" } }
    } as const;

    await act(async () => {
      for (const callbackProp of allowlistedTextInputCallbacks) {
        input.props[callbackProp](argumentsByCallback[callbackProp]);
      }
    });

    for (const callbackProp of allowlistedTextInputCallbacks) {
      expect(callbacks[callbackProp]).toHaveBeenCalledTimes(1);
      expect(callbacks[callbackProp]).toHaveBeenCalledWith(
        argumentsByCallback[callbackProp]
      );
    }
  });

  it.each([
    ["exact duplicate", "Email", "Email", "Email"],
    [
      "whitespace/case/punctuation equivalent",
      "Email",
      "  eMAIL!  ",
      "eMAIL!"
    ],
    ["distinct currency symbols", "Pay €", "Pay $", "Pay $. Pay €"],
    ["distinct math symbols", "C", "C++", "C++. C"],
    ["exact semantic symbol duplicate", "Pay €", "Pay €", "Pay €"],
    ["substring false positive", "No", "Not available", "Not available. No"],
    [
      "precomposed separate label part",
      "Email",
      "Worker profile. Email",
      "Worker profile. Email"
    ]
  ])(
    "composes the exact input accessible name for %s",
    async (_case, label, accessibilityLabel, expectedName) => {
      const view = await renderField({ accessibilityLabel, label, value: "" });
      expect(view.root.findByType(TextInput).props.accessibilityLabel).toBe(
        expectedName
      );
    }
  );

  it.each([
    ["blank", ""],
    ["whitespace", "   "],
    ["number", 42],
    ["object", { text: "Email" }]
  ])("fails closed for a %s runtime main label", async (_case, label) => {
    const onPress = jest.fn();
    const unsafeProps = {
      label,
      trailingAction: { label: "Show", onPress },
      value: "controlled"
    } as unknown as ComponentProps<typeof FormField>;
    const view = await renderField(unsafeProps);

    expect(view.toJSON()).toBeNull();
    expect(onPress).not.toHaveBeenCalled();
  });

  it.each([
    ["blank", ""],
    ["whitespace", "   "],
    ["number", 42]
  ])("omits a trailing action with a %s runtime label", async (_case, label) => {
    const onPress = jest.fn();
    const unsafeProps = {
      label: "Password",
      trailingAction: { label, onPress },
      value: "controlled"
    } as unknown as ComponentProps<typeof FormField>;
    const view = await renderField(unsafeProps);

    expect(view.root.findByType(TextInput).props.accessibilityLabel).toBe("Password");
    expect(
      view.root.findAll((node) => node.props.accessibilityRole === "button")
    ).toHaveLength(0);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("disables a named trailing action with a non-function runtime callback", async () => {
    const unsafeProps = {
      label: "Password",
      trailingAction: { label: "Show password", onPress: "run" },
      value: "controlled"
    } as unknown as ComponentProps<typeof FormField>;
    const view = await renderField(unsafeProps);
    const action = findTrailingAction(view, "Show password");

    expect(action.props).toMatchObject({
      accessibilityState: { disabled: true },
      disabled: true
    });
    expect(action.props.onPress).toBeUndefined();
    expect(action.props.onLongPress).toBeUndefined();
  });

  it("drops invalid runtime field icons while preserving valid controlled behavior", async () => {
    const onChangeText = jest.fn();
    const onPress = jest.fn();
    const unsafeProps = {
      label: "Password",
      leadingIcon: "lock-closed-outline",
      onChangeText,
      trailingAction: {
        icon: { name: "visibilityOn" },
        label: "Show password",
        onPress
      },
      value: "controlled"
    } as unknown as ComponentProps<typeof FormField>;
    const view = await renderField(unsafeProps);
    const input = view.root.findByType(TextInput);
    const action = findTrailingAction(view, "Show password");

    expect(view.root.findAllByType(AppIcon)).toHaveLength(0);
    expect(view.root.findAllByType(Ionicons)).toHaveLength(0);
    expect(input.props.value).toBe("controlled");
    await act(async () => {
      input.props.onChangeText("next");
      action.props.onPress();
    });
    expect(onChangeText).toHaveBeenCalledWith("next");
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("keeps long label, hint, error, input, and action copy free from fixed/clipping layout", async () => {
    const label = "Дуже довга назва поля and a long English field label";
    const hint = "Довга українська підказка that must wrap at a 1.5 font scale";
    const error = "Докладна помилка validation copy that remains completely visible";
    const actionLabel = "Показати повне значення and keep the action identity visible";
    const view = await renderField({
      error,
      hint,
      label,
      leadingIcon: "info",
      multiline: true,
      trailingAction: { icon: "visibilityOn", label: actionLabel, onPress: jest.fn() },
      value: "A long controlled value"
    });
    const container = view.root.findAllByType(View)[0]!;
    const shell = findInputShell(view);
    const input = view.root.findByType(TextInput);
    const action = findTrailingAction(view, actionLabel);
    const actionContent = view.root
      .findAllByType(View)
      .find(
        (node) =>
          StyleSheet.flatten(node.props.style)?.flexDirection === "row" &&
          StyleSheet.flatten(node.props.style)?.justifyContent === "center"
      )!;

    for (const wrapperStyle of [
      container.props.style,
      shell.props.style,
      input.props.style,
      action.props.style({ pressed: false }),
      actionContent.props.style
    ]) {
      expectNoFixedOrClippingStyle(wrapperStyle);
    }
    expect(StyleSheet.flatten(shell.props.style)).toMatchObject({
      flexShrink: 1,
      flexWrap: "wrap",
      minHeight: theme.height.control.min
    });
    expect(StyleSheet.flatten(action.props.style({ pressed: false }))).toMatchObject({
      minHeight: theme.target.min,
      minWidth: theme.target.min
    });

    for (const copy of [label, hint, error, actionLabel]) {
      const text = view.root.findByProps({ children: copy });
      expect(text.props.numberOfLines).toBeUndefined();
      expect(text.props.ellipsizeMode).toBeUndefined();
    }
  });

  it("rejects raw icon, color, style, and action escape hatches at compile time", () => {
    type Props = ComponentProps<typeof FormField>;
    const onPress = jest.fn();
    const compatiblePasswordUsage: Props = {
      label: "Password",
      onChangeText: jest.fn(),
      secureTextEntry: true,
      trailingAction: { label: "Show password", onPress },
      value: "secret"
    };

    // @ts-expect-error Callers use semantic AppIconName values, not glyph names.
    const rawLeadingGlyph: Props = { label: "Email", leadingIcon: "mail-outline", value: "" };
    // @ts-expect-error Arbitrary leading icon nodes are not accepted.
    const rawLeadingNode: Props = { label: "Email", leadingIcon: <Text>Raw</Text>, value: "" };
    // @ts-expect-error Trailing icons also use semantic AppIconName values.
    const rawTrailingGlyph: Props = { label: "Password", trailingAction: { icon: "eye-outline", label: "Show", onPress }, value: "" };
    // @ts-expect-error Arbitrary trailing icon nodes are not accepted.
    const rawTrailingNode: Props = { label: "Password", trailingAction: { icon: <Text>Raw</Text>, label: "Show", onPress }, value: "" };
    // @ts-expect-error Raw icon colors are not part of the field API.
    const rawIconColor: Props = { iconColor: "#000000", label: "Email", value: "" };
    // @ts-expect-error Placeholder color is authoritative and semantic.
    const rawPlaceholderColor: Props = { label: "Email", placeholderTextColor: "#000000", value: "" };
    // @ts-expect-error FormField does not expose a raw TextInput style escape hatch.
    const rawInputStyle: Props = { label: "Email", style: { height: 1, color: "#000000" }, value: "" };
    // @ts-expect-error FormField owns the input accessibility role.
    const rawInputRole: Props = { accessibilityRole: "button", label: "Email", value: "" };
    // @ts-expect-error Trailing actions require visible text.
    const unnamedTrailingAction: Props = { label: "Password", trailingAction: { icon: "visibilityOn", onPress }, value: "" };

    expect({
      compatiblePasswordUsage,
      rawIconColor,
      rawInputRole,
      rawInputStyle,
      rawLeadingGlyph,
      rawLeadingNode,
      rawPlaceholderColor,
      rawTrailingGlyph,
      rawTrailingNode,
      unnamedTrailingAction
    }).toBeTruthy();
  });
});
