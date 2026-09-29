import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { KeyboardAvoidingView, ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from "react-native";
import { type ComponentProps } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../utils/theme";
import { Screen } from "../Screen";

type ScreenScrollProps = NonNullable<ComponentProps<typeof Screen>["scrollProps"]>;
type ScreenContentStyle = NonNullable<ComponentProps<typeof Screen>["contentStyle"]>;

describe("Screen", () => {
  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("owns vertical reachable scrolling while forwarding its safe scroll subset", async () => {
    const onScroll = jest.fn();
    const wideScrollProps: ScrollViewProps = {
      testID: "wide",
      style: { height: 1 },
      horizontal: true,
      scrollEnabled: false,
      showsVerticalScrollIndicator: false,
      keyboardDismissMode: "on-drag",
      onScroll
    };
    const wideContentStyle: ViewStyle = { paddingTop: 9, maxHeight: 1 };
    const wideScrollContentStyle: ViewStyle[] = [
      { paddingBottom: 12, maxHeight: 2 },
      { paddingLeft: 7, flex: 99 }
    ];
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <Screen
          contentStyle={wideContentStyle}
          scrollContentStyle={wideScrollContentStyle}
          scrollProps={wideScrollProps}
        >
          <View testID="content" />
        </Screen>
      );
    });

    const safe = view.root.findByType(SafeAreaView);
    const keyboard = view.root.findByType(KeyboardAvoidingView);
    expect(safe.props.edges).toBeUndefined();
    expect(keyboard.props.keyboardVerticalOffset).toBeUndefined();

    const scroll = view.root.findByType(ScrollView);
    expect(scroll.props).toMatchObject({
      horizontal: false,
      scrollEnabled: true,
      keyboardShouldPersistTaps: "handled",
      testID: "wide",
      showsVerticalScrollIndicator: false,
      keyboardDismissMode: "on-drag",
      onScroll
    });
    expect(scroll.props.style).toBeUndefined();
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({
      flexGrow: 1,
      paddingBottom: 12,
      paddingLeft: 7
    });
    const normalizedScrollInsets = StyleSheet.flatten(scroll.props.contentContainerStyle[0]);
    expect(normalizedScrollInsets).toMatchObject({ paddingBottom: 12, paddingLeft: 7 });
    expect(normalizedScrollInsets).not.toHaveProperty("maxHeight");
    expect(normalizedScrollInsets).not.toHaveProperty("flex");

    const content = view.root.findAllByType(View).find(
      (node) => Array.isArray(node.props.style)
        && StyleSheet.flatten(node.props.style[0])?.paddingHorizontal === theme.inset.screen
    )!;
    const normalizedContentInsets = StyleSheet.flatten(content.props.style[1]);
    expect(normalizedContentInsets).toMatchObject({ paddingTop: 9 });
    expect(normalizedContentInsets).not.toHaveProperty("paddingHorizontal");
    expect(normalizedContentInsets).not.toHaveProperty("paddingVertical");
    expect(normalizedContentInsets).not.toHaveProperty("maxHeight");
    expect(StyleSheet.flatten(content.props.style)).toMatchObject({
      paddingTop: 9,
      paddingHorizontal: theme.inset.screen,
      paddingVertical: theme.space[6]
    });
  });

  it("preserves zero insets without clearing unspecified canonical padding", async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <Screen contentStyle={{ paddingTop: 0 }}>
          <View testID="content" />
        </Screen>
      );
    });

    const content = view.root.findAllByType(View).find(
      (node) => Array.isArray(node.props.style)
        && StyleSheet.flatten(node.props.style[0])?.paddingHorizontal === theme.inset.screen
    )!;
    const normalizedContentInsets = StyleSheet.flatten(content.props.style[1]);
    expect(normalizedContentInsets).toEqual({ paddingTop: 0 });
    expect(StyleSheet.flatten(content.props.style)).toMatchObject({
      paddingTop: 0,
      paddingHorizontal: theme.inset.screen,
      paddingVertical: theme.space[6]
    });
  });

  it("excludes caller props that can disable or rotate scrolling", () => {
    const safeProps: ScreenScrollProps = { testID: "safe" };
    // @ts-expect-error Screen owns vertical orientation.
    const horizontalProps: ScreenScrollProps = { horizontal: true };
    // @ts-expect-error Screen owns reachable scrolling.
    const disabledScrollProps: ScreenScrollProps = { scrollEnabled: false };
    // @ts-expect-error Screen owns the handled-tap behavior.
    const tapProps: ScreenScrollProps = { keyboardShouldPersistTaps: "always" };
    // @ts-expect-error Screen owns its content-container layout.
    const contentContainerProps: ScreenScrollProps = { contentContainerStyle: { padding: 1 } };
    // @ts-expect-error Screen content customization is limited to safe insets.
    const unsafeContentStyle: ScreenContentStyle = { maxHeight: 1 };

    expect(safeProps).toEqual({ testID: "safe" });
    expect(horizontalProps).toEqual({ horizontal: true });
    expect(disabledScrollProps).toEqual({ scrollEnabled: false });
    expect(tapProps).toEqual({ keyboardShouldPersistTaps: "always" });
    expect(contentContainerProps).toEqual({ contentContainerStyle: { padding: 1 } });
    expect(unsafeContentStyle).toEqual({ maxHeight: 1 });
  });

  it("renders non-scroll content without removing the shell", async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <Screen scroll={false} safeAreaEdges={["top"]} keyboardVerticalOffset={12}>
          <View testID="content" />
        </Screen>
      );
    });

    expect(view.root.findAllByType(ScrollView)).toHaveLength(0);
    expect(view.root.findByType(SafeAreaView).props.edges).toEqual(["top"]);
    expect(view.root.findByType(KeyboardAvoidingView).props.keyboardVerticalOffset).toBe(12);
    expect(view.root.findByProps({ testID: "content" })).toBeTruthy();
  });
});
