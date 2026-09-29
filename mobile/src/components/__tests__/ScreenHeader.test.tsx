import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../utils/theme";
import { ScreenHeader } from "../ScreenHeader";

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
    expect(StyleSheet.flatten(title.parent!.props.style)).toMatchObject({ width: "100%" });
    expect(StyleSheet.flatten(title.parent!.props.style).flexDirection).toBeUndefined();
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

    const title = view.root.findAllByType(Text).find(
      (node) => node.props.children === titleText
    )!;
    const copy = title.parent!;
    expect(copy).not.toBe(actionsRegion);
    expect(StyleSheet.flatten(copy.props.style)).toMatchObject({ width: "100%" });
    expect(StyleSheet.flatten(copy.props.style).flexDirection).toBeUndefined();
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

    for (const button of [backButton, actionButton]) {
      const unpressedStyle = StyleSheet.flatten(button.props.style({ pressed: false }));
      expect(unpressedStyle).toMatchObject({
        minWidth: theme.target.min,
        minHeight: theme.target.min,
        maxWidth: "100%",
        flexShrink: 1
      });
      expect(unpressedStyle.backgroundColor).toBeUndefined();
      expect(StyleSheet.flatten(button.props.style({ pressed: true }))).toMatchObject({
        backgroundColor: theme.colors.brand.tint
      });
    }

    const actionLabels = view.root.findAllByType(Text).filter(
      (node) => node.props.children === backLabel || node.props.children === actionLabel
    );
    expect(actionLabels).toHaveLength(2);
    for (const label of actionLabels) {
      expect(label.props.numberOfLines).toBeUndefined();
      expect(label.props.ellipsizeMode).toBeUndefined();
      expect(StyleSheet.flatten(label.props.style)).toMatchObject({ flexShrink: 1 });
    }

    await act(async () => {
      backButton.props.onPress();
      actionButton.props.onPress();
    });
    expect(back).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
  });
});
