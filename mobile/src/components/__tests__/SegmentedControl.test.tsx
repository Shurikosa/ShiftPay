import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../utils/theme";
import {
  SegmentedControl,
  type SegmentedControlOption
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

function findRadio(view: ReactTestRenderer, accessibilityLabel: string): ReactTestInstance {
  return view.root.findAll(
    (node) =>
      node.props.accessibilityRole === "radio" &&
      node.props.accessibilityLabel === accessibilityLabel &&
      typeof node.props.style === "function"
  )[0]!;
}

function findRadioGroup(view: ReactTestRenderer, accessibilityLabel: string): ReactTestInstance {
  return view.root.findAll(
    (node) =>
      node.props.accessibilityRole === "radiogroup" &&
      node.props.accessibilityLabel === accessibilityLabel
  )[0]!;
}

describe("SegmentedControl", () => {
  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("keeps generic values and selects an enabled option exactly once", async () => {
    const onChange = jest.fn<void, [Strategy]>();
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <SegmentedControl<Strategy>
          accessibilityLabel="Stacking strategy"
          onChange={onChange}
          options={strategyOptions}
          value="ADD"
        />
      );
    });

    const highest = findRadio(view, "Use highest premium only");
    await act(async () => {
      highest.props.onPress();
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("HIGHEST_ONLY");
  });

  it("exposes radiogroup, radio, checked, global-disabled, and per-option-disabled semantics", async () => {
    const onChange = jest.fn<void, [Strategy]>();
    const options: readonly SegmentedControlOption<Strategy>[] = [
      strategyOptions[0]!,
      { ...strategyOptions[1]!, disabled: true }
    ];
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <SegmentedControl
          accessibilityLabel="Stacking strategy"
          onChange={onChange}
          options={options}
          value="ADD"
        />
      );
    });

    expect(findRadioGroup(view, "Stacking strategy").props.accessibilityState).toEqual({
      disabled: false
    });
    const selected = findRadio(view, "Combine all premiums");
    const optionDisabled = findRadio(view, "Use highest premium only");
    expect(selected.props).toMatchObject({
      disabled: false,
      accessibilityState: { checked: true, disabled: false }
    });
    expect(optionDisabled.props).toMatchObject({
      disabled: true,
      accessibilityState: { checked: false, disabled: true }
    });

    await act(async () => {
      selected.props.onPress();
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("ADD");

    let globallyDisabledView!: ReactTestRenderer;
    await act(async () => {
      globallyDisabledView = create(
        <SegmentedControl
          accessibilityLabel="Disabled strategy"
          disabled
          onChange={onChange}
          options={strategyOptions}
          value="HIGHEST_ONLY"
        />
      );
    });
    expect(findRadioGroup(globallyDisabledView, "Disabled strategy").props.accessibilityState).toEqual({
      disabled: true
    });
    for (const label of strategyOptions.map((option) => option.label)) {
      expect(findRadio(globallyDisabledView, label).props).toMatchObject({
        disabled: true,
        accessibilityState: { disabled: true }
      });
    }
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("uses semantic selected, unselected, pressed, and disabled styles", async () => {
    const disabledOptions: readonly SegmentedControlOption<Strategy>[] = [
      strategyOptions[0]!,
      { ...strategyOptions[1]!, disabled: true }
    ];
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <SegmentedControl
          accessibilityLabel="Styled strategy"
          onChange={jest.fn()}
          options={disabledOptions}
          value="ADD"
        />
      );
    });

    const group = findRadioGroup(view, "Styled strategy");
    expect(StyleSheet.flatten(group.props.style)).toMatchObject({
      backgroundColor: theme.colors.surface.default,
      borderColor: theme.colors.border,
      borderWidth: theme.border.default
    });

    const selected = findRadio(view, "Combine all premiums");
    expect(StyleSheet.flatten(selected.props.style({ pressed: false }))).toMatchObject({
      backgroundColor: theme.colors.brand.primary
    });
    expect(StyleSheet.flatten(selected.props.style({ pressed: true }))).toMatchObject({
      backgroundColor: theme.colors.brand.pressed
    });

    const disabled = findRadio(view, "Use highest premium only");
    const disabledRestingStyle = StyleSheet.flatten(disabled.props.style({ pressed: false }));
    const disabledPressedStyle = StyleSheet.flatten(disabled.props.style({ pressed: true }));
    expect(disabledRestingStyle).toMatchObject({
      backgroundColor: theme.colors.surface.default,
      opacity: 0.6
    });
    expect(disabledPressedStyle).toMatchObject(disabledRestingStyle);
    expect(disabledPressedStyle.backgroundColor).not.toBe(theme.colors.brand.tint);

    let unselectedView!: ReactTestRenderer;
    await act(async () => {
      unselectedView = create(
        <SegmentedControl
          accessibilityLabel="Unselected pressed strategy"
          onChange={jest.fn()}
          options={strategyOptions}
          value="HIGHEST_ONLY"
        />
      );
    });
    const unselected = findRadio(unselectedView, "Combine all premiums");
    expect(StyleSheet.flatten(unselected.props.style({ pressed: false }))).toMatchObject({
      backgroundColor: theme.colors.surface.default
    });
    expect(StyleSheet.flatten(unselected.props.style({ pressed: true }))).toMatchObject({
      backgroundColor: theme.colors.brand.tint
    });

    const selectedLabel = view.root
      .findAllByType(Text)
      .find((node) => node.props.children === "Combine all premiums")!;
    expect(StyleSheet.flatten(selectedLabel.props.style)).toMatchObject({
      color: theme.colors.surface.default
    });
  });

  it.each([
    [false, "nowrap", 0],
    [true, "wrap", "30%"]
  ] as const)(
    "keeps a minimum 44 by 44 actionable target when wrap is %s",
    async (wrap, expectedWrap, expectedBasis) => {
      let view!: ReactTestRenderer;
      await act(async () => {
        view = create(
          <SegmentedControl
            accessibilityLabel={`Wrap ${String(wrap)}`}
            onChange={jest.fn()}
            options={strategyOptions}
            value="ADD"
            wrap={wrap}
          />
        );
      });

      const group = findRadioGroup(view, `Wrap ${String(wrap)}`);
      expect(StyleSheet.flatten(group.props.style)).toMatchObject({ flexWrap: expectedWrap });
      for (const option of strategyOptions) {
        const radioStyle = StyleSheet.flatten(
          findRadio(view, option.accessibilityLabel ?? option.label).props.style({ pressed: false })
        );
        expect(radioStyle).toMatchObject({
          minWidth: theme.target.min,
          minHeight: theme.target.min,
          flexBasis: expectedBasis
        });
        expect(radioStyle).not.toHaveProperty("height");
        expect(radioStyle).not.toHaveProperty("maxHeight");
      }
    }
  );

  it("keeps long localized labels visible and forwards caller accessibility/test metadata", async () => {
    const label =
      "Використовувати лише найбільшу премію для цього дуже довгого локалізованого правила";
    const options = [
      {
        accessibilityHint: "Selects one premium",
        accessibilityLabel: "Localized premium strategy",
        label,
        testID: "localized-option",
        value: "HIGHEST_ONLY"
      }
    ] as const satisfies readonly SegmentedControlOption<Strategy>[];
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <SegmentedControl
          accessibilityHint="Choose how matching premiums combine"
          accessibilityLabel="Premium strategy"
          nativeID="premium-strategy"
          onChange={jest.fn()}
          options={options}
          testID="premium-strategy-control"
          value="HIGHEST_ONLY"
          wrap
        />
      );
    });

    const group = view.root
      .findAllByType(View)
      .find((node) => node.props.testID === "premium-strategy-control")!;
    expect(group.props).toMatchObject({
      accessibilityRole: "radiogroup",
      accessibilityHint: "Choose how matching premiums combine",
      nativeID: "premium-strategy"
    });

    const option = view.root.findAll(
      (node) =>
        node.props.accessibilityRole === "radio" &&
        typeof node.props.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.includes("Localized premium strategy") &&
        node.props.accessibilityLabel.includes(label) &&
        typeof node.props.style === "function"
    )[0]!;
    expect(option.props).toMatchObject({
      accessibilityHint: "Selects one premium",
      testID: "localized-option"
    });
    expect(option.props.accessibilityLabel).toContain("Localized premium strategy");
    expect(option.props.accessibilityLabel).toContain(label);
    const labelNode = view.root.findAllByType(Text).find((node) => node.props.children === label)!;
    expect(labelNode.props).toMatchObject({ allowFontScaling: true });
    expect(labelNode.props.numberOfLines).toBeUndefined();
    expect(labelNode.props.ellipsizeMode).toBeUndefined();
    expect(StyleSheet.flatten(labelNode.props.style)).toMatchObject({
      maxWidth: "100%",
      flexShrink: 1
    });
  });
});
