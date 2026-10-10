import type { ComponentProps } from "react";
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer
} from "react-test-renderer";
import { StyleSheet, Text, type ViewStyle } from "react-native";
import { theme } from "../../utils/theme";
import {
  SegmentedControl,
  type SegmentedControlOption,
  type SegmentedControlProps
} from "../SegmentedControl";

type Strategy = "ADD" | "HIGHEST_ONLY";

const strategyOptions: readonly SegmentedControlOption<Strategy>[] = [
  { label: "Combine all premiums", value: "ADD", testID: "strategy-add" },
  {
    label: "Use highest premium only",
    value: "HIGHEST_ONLY",
    testID: "strategy-highest"
  }
];

async function renderControl<TValue extends string | number>(
  props: SegmentedControlProps<TValue>
): Promise<ReactTestRenderer> {
  let view!: ReactTestRenderer;
  await act(async () => {
    view = create(<SegmentedControl {...props} />);
  });
  return view;
}

function findRadio(view: ReactTestRenderer, name: string): ReactTestInstance {
  return view.root.findAll(
    (node) =>
      node.props.accessibilityRole === "radio" &&
      node.props.accessibilityLabel === name &&
      typeof node.props.style === "function"
  )[0]!;
}

function findRadios(view: ReactTestRenderer): ReactTestInstance[] {
  return view.root.findAll(
    (node) =>
      node.props.accessibilityRole === "radio" &&
      typeof node.props.style === "function"
  );
}

function findRadioGroup(view: ReactTestRenderer, name: string): ReactTestInstance {
  return view.root.findAll(
    (node) =>
      node.props.accessibilityRole === "radiogroup" &&
      node.props.accessibilityLabel === name
  )[0]!;
}

function expectNoFixedOrClippingStyle(style: unknown): void {
  const flattened = StyleSheet.flatten(style) as ViewStyle | undefined;
  expect(flattened).not.toHaveProperty("height");
  expect(flattened).not.toHaveProperty("maxHeight");
  expect(flattened?.overflow).not.toBe("hidden");
}

describe("SegmentedControl", () => {
  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("preserves controlled string selection and callback arguments", async () => {
    const onChange = jest.fn<void, [Strategy]>();
    const view = await renderControl<Strategy>({
      accessibilityLabel: "Stacking strategy",
      onChange,
      options: strategyOptions,
      value: "ADD"
    });
    const add = findRadio(view, "Combine all premiums");
    const highest = findRadio(view, "Use highest premium only");

    expect(add.props.accessibilityState).toEqual({
      checked: true,
      disabled: false
    });
    expect(highest.props.accessibilityState).toEqual({
      checked: false,
      disabled: false
    });
    await act(async () => {
      highest.props.onPress();
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("HIGHEST_ONLY");
    expect(highest.props.accessibilityState.checked).toBe(false);

    await act(async () => {
      view.update(
        <SegmentedControl
          accessibilityLabel="Stacking strategy"
          onChange={onChange}
          options={strategyOptions}
          value="HIGHEST_ONLY"
        />
      );
    });
    expect(findRadio(view, "Use highest premium only").props.accessibilityState.checked)
      .toBe(true);
  });

  it("supports controlled finite number values without string-key collisions", async () => {
    type NumericValue = 1 | 2;
    const options: readonly SegmentedControlOption<NumericValue>[] = [
      { label: "First period", value: 1 },
      { label: "Second period", value: 2 }
    ];
    const onChange = jest.fn<void, [NumericValue]>();
    const view = await renderControl<NumericValue>({
      accessibilityLabel: "Payroll period",
      onChange,
      options,
      value: 1
    });

    expect(findRadio(view, "First period").props.accessibilityState.checked).toBe(true);
    await act(async () => {
      findRadio(view, "Second period").props.onPress();
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it.each([
    ["punctuation-only label", "...", "Status.", "Status. ..."],
    ["empty normalized context part", "...", "!!!", "!!! ..."],
    ["colon-terminated context", "Open", "Status:", "Status: Open"],
    ["ellipsis-terminated context", "Open", "Status…", "Status… Open"],
    ["unpunctuated context", "Open", "Status", "Status: Open"],
    ["distinct currency symbols", "Pay €", "Pay $", "Pay $: Pay €"],
    ["distinct math symbols", "C", "C++", "C++: C"],
    [
      "exact symbol-containing part",
      "Pay €",
      "Payment status: Pay €",
      "Payment status: Pay €"
    ],
    ["substring is not a part", "No", "Not available", "Not available: No"],
    ["normalized exact part", "Paid", "  pAID!  ", "pAID!"]
  ])(
    "renders the authoritative accessible name for %s",
    async (_case, label, accessibilityLabel, expectedName) => {
      const options = [
        { accessibilityLabel, label, value: "ADD" }
      ] as const satisfies readonly SegmentedControlOption<Strategy>[];
      const view = await renderControl<Strategy>({
        accessibilityLabel: "Accessible-name examples",
        onChange: jest.fn(),
        options,
        value: "ADD"
      });
      const radios = findRadios(view);

      expect(radios).toHaveLength(1);
      expect(radios[0]!.props.accessibilityLabel).toBe(expectedName);
      expect(view.root.findByProps({ children: label }).type).toBe(Text);
    }
  );

  it("exposes authoritative radiogroup/radio checked and disabled semantics", async () => {
    const onChange = jest.fn<void, [Strategy]>();
    const options: readonly SegmentedControlOption<Strategy>[] = [
      strategyOptions[0]!,
      { ...strategyOptions[1]!, disabled: true }
    ];
    const view = await renderControl<Strategy>({
      accessibilityLabel: "Stacking strategy",
      onChange,
      options,
      value: "ADD"
    });
    const group = findRadioGroup(view, "Stacking strategy");
    const selected = findRadio(view, "Combine all premiums");
    const optionDisabled = findRadio(view, "Use highest premium only");

    expect(group.props).toMatchObject({
      accessibilityElementsHidden: false,
      accessibilityRole: "radiogroup",
      accessibilityState: { disabled: false },
      "aria-disabled": false,
      "aria-hidden": false,
      role: "radiogroup"
    });
    expect(selected.props).toMatchObject({
      accessible: true,
      accessibilityRole: "radio",
      accessibilityState: { checked: true, disabled: false },
      "aria-checked": true,
      "aria-disabled": false,
      disabled: false,
      role: "radio"
    });
    expect(optionDisabled.props).toMatchObject({
      accessibilityState: { checked: false, disabled: true },
      "aria-checked": false,
      "aria-disabled": true,
      disabled: true
    });
    expect(optionDisabled.props.onPress).toBeUndefined();

    await act(async () => {
      optionDisabled.props.onPress?.();
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("makes every option non-executable when the group is disabled", async () => {
    const onChange = jest.fn<void, [Strategy]>();
    const view = await renderControl<Strategy>({
      accessibilityLabel: "Disabled strategy",
      disabled: true,
      onChange,
      options: strategyOptions,
      value: "HIGHEST_ONLY"
    });

    expect(findRadioGroup(view, "Disabled strategy").props).toMatchObject({
      accessibilityState: { disabled: true },
      "aria-disabled": true
    });
    for (const radio of findRadios(view)) {
      expect(radio.props.accessibilityState.disabled).toBe(true);
      expect(radio.props.disabled).toBe(true);
      expect(radio.props.onPress).toBeUndefined();
      await act(async () => {
        radio.props.onPress?.();
      });
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it("fails closed when the runtime onChange value is not a function", async () => {
    const unsafeProps = {
      accessibilityLabel: "Unsafe callback strategy",
      onChange: { call: jest.fn() },
      options: strategyOptions,
      value: "ADD"
    } as unknown as SegmentedControlProps<Strategy>;
    const view = await renderControl(unsafeProps);

    expect(findRadioGroup(view, "Unsafe callback strategy").props.accessibilityState)
      .toEqual({ disabled: true });
    for (const radio of findRadios(view)) {
      expect(radio.props.onPress).toBeUndefined();
      expect(radio.props.accessibilityState.disabled).toBe(true);
    }
  });

  it("filters invalid and duplicate runtime options without conflicting radios", async () => {
    const onChange = jest.fn<void, [Strategy]>();
    const unsafeOptions = [
      { label: "Combine all premiums", value: "ADD" },
      { label: "Duplicate value", value: "ADD" },
      { label: " combine   ALL premiums ", value: "HIGHEST_ONLY" },
      { label: "", value: "HIGHEST_ONLY" },
      { label: 42, value: "HIGHEST_ONLY" },
      { label: "Invalid value", value: { raw: true } },
      { label: "Blank value", value: "" },
      null,
      { label: "Use highest premium only", value: "HIGHEST_ONLY" }
    ] as unknown as readonly SegmentedControlOption<Strategy>[];
    const view = await renderControl<Strategy>({
      accessibilityLabel: "Filtered strategy",
      onChange,
      options: unsafeOptions,
      value: "ADD"
    });
    const radios = findRadios(view);

    expect(radios).toHaveLength(2);
    expect(radios.map((radio) => radio.props.accessibilityLabel)).toEqual([
      "Combine all premiums",
      "Use highest premium only"
    ]);
    expect(radios.every((radio) => radio.props.accessibilityLabel.length > 0)).toBe(true);
  });

  it("drops a later option when contextual names would conflict", async () => {
    const context = "Available choices. Alpha. Beta";
    const options = [
      { accessibilityLabel: context, label: "Alpha", value: "ADD" },
      { accessibilityLabel: context, label: "Beta", value: "HIGHEST_ONLY" }
    ] as const satisfies readonly SegmentedControlOption<Strategy>[];
    const view = await renderControl<Strategy>({
      accessibilityLabel: "Conflicting names",
      onChange: jest.fn(),
      options,
      value: "ADD"
    });

    expect(findRadios(view)).toHaveLength(1);
    expect(findRadios(view)[0]!.props.accessibilityLabel).toBe(context);
  });

  it.each([
    ["blank", ""],
    ["whitespace", "   "],
    ["number", 42]
  ])("does not create an unnamed group for a %s runtime name", async (_case, name) => {
    const unsafeProps = {
      accessibilityLabel: name,
      onChange: jest.fn(),
      options: strategyOptions,
      value: "ADD"
    } as unknown as SegmentedControlProps<Strategy>;
    const view = await renderControl(unsafeProps);

    expect(view.toJSON()).toBeNull();
  });

  it("fails closed for a non-array runtime options value", async () => {
    const unsafeProps = {
      accessibilityLabel: "Empty safe group",
      onChange: jest.fn(),
      options: { first: strategyOptions[0] },
      value: "ADD"
    } as unknown as SegmentedControlProps<Strategy>;
    const view = await renderControl(unsafeProps);

    expect(view.toJSON()).toBeNull();
  });

  it.each([
    [false, "nowrap", 0],
    [true, "wrap", "30%"]
  ] as const)(
    "keeps 44 by 44 targets and responsive wrappers when wrap is %s",
    async (wrap, expectedWrap, expectedBasis) => {
      const view = await renderControl<Strategy>({
        accessibilityLabel: `Wrap ${String(wrap)}`,
        onChange: jest.fn(),
        options: strategyOptions,
        value: "ADD",
        wrap
      });
      const group = findRadioGroup(view, `Wrap ${String(wrap)}`);
      const groupStyle = StyleSheet.flatten(group.props.style);

      expect(groupStyle).toMatchObject({
        flexShrink: 1,
        flexWrap: expectedWrap,
        maxWidth: "100%"
      });
      expectNoFixedOrClippingStyle(group.props.style);
      for (const radio of findRadios(view)) {
        const radioStyle = StyleSheet.flatten(radio.props.style({ pressed: false }));
        expect(radioStyle).toMatchObject({
          flexBasis: expectedBasis,
          minHeight: theme.target.min,
          minWidth: theme.target.min
        });
        expectNoFixedOrClippingStyle(radio.props.style({ pressed: false }));
      }
    }
  );

  it("keeps long contextual labels visible, wrapping, scalable, and untruncated", async () => {
    const label =
      "Використовувати лише найбільшу премію for this unusually long localized rule";
    const options = [
      {
        accessibilityHint: "Selects one premium strategy",
        accessibilityLabel: "Premium behavior",
        label,
        testID: "localized-option",
        value: "HIGHEST_ONLY"
      }
    ] as const satisfies readonly SegmentedControlOption<Strategy>[];
    const view = await renderControl<Strategy>({
      accessibilityHint: "Choose how matching premiums combine",
      accessibilityLabel: "Premium strategy",
      nativeID: "premium-strategy",
      onChange: jest.fn(),
      options,
      testID: "premium-strategy-control",
      value: "HIGHEST_ONLY",
      wrap: true
    });
    const group = findRadioGroup(view, "Premium strategy");
    const radio = findRadio(view, `Premium behavior: ${label}`);
    const labelNode = view.root.findByProps({ children: label });

    expect(group.props).toMatchObject({
      accessibilityHint: "Choose how matching premiums combine",
      nativeID: "premium-strategy",
      testID: "premium-strategy-control"
    });
    expect(radio.props).toMatchObject({
      accessibilityHint: "Selects one premium strategy",
      testID: "localized-option"
    });
    expect(labelNode.props).toMatchObject({
      accessible: false,
      allowFontScaling: true
    });
    expect(labelNode.props.numberOfLines).toBeUndefined();
    expect(labelNode.props.ellipsizeMode).toBeUndefined();
    expect(StyleSheet.flatten(labelNode.props.style)).toMatchObject({
      flexShrink: 1,
      maxWidth: "100%"
    });
    expectNoFixedOrClippingStyle(labelNode.props.style);
  });

  it("uses structural selected, pressed, and disabled cues", async () => {
    const options: readonly SegmentedControlOption<Strategy>[] = [
      strategyOptions[0]!,
      { ...strategyOptions[1]!, disabled: true }
    ];
    const view = await renderControl<Strategy>({
      accessibilityLabel: "Styled strategy",
      onChange: jest.fn(),
      options,
      value: "ADD"
    });
    const selected = findRadio(view, "Combine all premiums");
    const disabled = findRadio(view, "Use highest premium only");
    const selectedResting = StyleSheet.flatten(selected.props.style({ pressed: false }));
    const selectedPressed = StyleSheet.flatten(selected.props.style({ pressed: true }));
    const disabledResting = StyleSheet.flatten(disabled.props.style({ pressed: false }));
    const disabledPressed = StyleSheet.flatten(disabled.props.style({ pressed: true }));

    expect(selectedResting).toMatchObject({
      backgroundColor: theme.colors.brand.primary,
      borderColor: theme.colors.brand.primary,
      borderWidth: 2
    });
    expect(selectedPressed).toMatchObject({
      backgroundColor: theme.colors.brand.pressed,
      borderWidth: 2,
      transform: [{ translateY: theme.border.default }]
    });
    expect(disabledResting).toMatchObject({
      backgroundColor: theme.colors.surface.subtle,
      borderColor: theme.colors.ink.muted,
      borderStyle: "dashed",
      borderWidth: theme.border.default,
      opacity: 0.62
    });
    expect(disabledPressed).toEqual(disabledResting);
  });

  it("does not forward hostile group or option semantics and handlers", async () => {
    const injectedGroupPress = jest.fn();
    const injectedOptionPress = jest.fn();
    const onChange = jest.fn<void, [Strategy]>();
    const hostileOptions = [
      {
        ...strategyOptions[0]!,
        accessible: false,
        accessibilityElementsHidden: true,
        accessibilityRole: "checkbox",
        accessibilityState: { checked: false, disabled: true },
        "aria-hidden": true,
        children: <Text>Injected option</Text>,
        onPress: injectedOptionPress,
        role: "checkbox",
        style: { height: 1, overflow: "hidden" }
      },
      strategyOptions[1]!
    ] as unknown as readonly SegmentedControlOption<Strategy>[];
    const hostileGroupProps = {
      accessible: false,
      accessibilityElementsHidden: true,
      accessibilityHint: "Safe hint",
      accessibilityLabel: "Authoritative group",
      accessibilityRole: "checkbox",
      accessibilityState: { disabled: true },
      "aria-hidden": true,
      children: <Text>Injected group</Text>,
      importantForAccessibility: "no-hide-descendants",
      nativeID: "authoritative-group-native",
      onChange,
      onPress: injectedGroupPress,
      options: hostileOptions,
      role: "checkbox",
      style: { display: "none", height: 1, overflow: "hidden" },
      testID: "authoritative-group",
      value: "HIGHEST_ONLY"
    } as unknown as SegmentedControlProps<Strategy>;
    const view = await renderControl(hostileGroupProps);
    const group = findRadioGroup(view, "Authoritative group");
    const radio = findRadio(view, "Combine all premiums");

    expect(group.props).toMatchObject({
      accessibilityElementsHidden: false,
      accessibilityRole: "radiogroup",
      accessibilityState: { disabled: false },
      "aria-hidden": false,
      importantForAccessibility: "yes",
      role: "radiogroup"
    });
    expect(group.props.onPress).toBeUndefined();
    expect(radio.props).toMatchObject({
      accessible: true,
      accessibilityElementsHidden: false,
      accessibilityRole: "radio",
      accessibilityState: { checked: false, disabled: false },
      "aria-hidden": false,
      role: "radio"
    });
    expect(view.root.findAllByProps({ children: "Injected group" })).toHaveLength(0);
    expect(view.root.findAllByProps({ children: "Injected option" })).toHaveLength(0);
    await act(async () => {
      radio.props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith("ADD");
    expect(injectedGroupPress).not.toHaveBeenCalled();
    expect(injectedOptionPress).not.toHaveBeenCalled();
  });

  it("keeps the generic semantic public contract narrow", () => {
    type Props = ComponentProps<typeof SegmentedControl<Strategy>>;
    const onChange = jest.fn<void, [Strategy]>();
    const compatible: Props = {
      accessibilityLabel: "Stacking strategy",
      onChange,
      options: strategyOptions,
      value: "ADD",
      wrap: true
    };
    const numericOptions: readonly SegmentedControlOption<1 | 2>[] = [
      { label: "One", value: 1 },
      { label: "Two", value: 2 }
    ];

    // @ts-expect-error Values remain string/number-like, not arbitrary objects.
    const objectValue: SegmentedControlOption<{ id: number }> = {
      label: "Object",
      value: { id: 1 }
    };
    // @ts-expect-error The control owns its option children.
    const children: Props = { ...compatible, children: "Injected" };
    // @ts-expect-error No raw group style escape hatch is exposed.
    const style: Props = { ...compatible, style: { height: 1 } };
    const optionChildren: SegmentedControlOption<Strategy> = {
      // @ts-expect-error Option content must be a visible text label.
      children: <Text>Injected</Text>,
      label: "Add",
      value: "ADD"
    };

    expect({
      children,
      compatible,
      numericOptions,
      objectValue,
      optionChildren,
      style
    }).toBeTruthy();
  });
});
