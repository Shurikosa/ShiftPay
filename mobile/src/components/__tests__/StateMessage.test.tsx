import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { theme } from "../../utils/theme";
import { Feedback } from "../Feedback";
import { StateMessage } from "../StateMessage";

describe("StateMessage", () => {
  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it.each([
    ["neutral", theme.colors.surface.subtle, theme.colors.border],
    ["error", theme.colors.danger.bg, theme.colors.danger.fg],
    ["success", theme.colors.success.bg, theme.colors.success.fg]
  ] as const)("preserves the %s tone API with semantic tokens", async (tone, backgroundColor, borderColor) => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<StateMessage title={`${tone} state`} tone={tone} />);
    });

    const feedback = view.root.findByType(Feedback);
    expect(feedback.props).toMatchObject({ title: `${tone} state`, tone });
    const surface = view.root.findAllByType(View).find((node) => {
      const style = StyleSheet.flatten(node.props.style);
      return style?.backgroundColor === backgroundColor && style?.borderColor === borderColor;
    })!;
    expect(StyleSheet.flatten(surface.props.style)).toMatchObject({
      backgroundColor,
      borderColor,
      borderWidth: theme.border.default
    });
  });

  it("defaults to neutral and delegates its complete compatibility contract to Feedback", async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <StateMessage loading message="Fetching current data" title="Loading state" />
      );
    });

    expect(view.root.findByType(Feedback).props).toMatchObject({
      loading: true,
      message: "Fetching current data",
      title: "Loading state",
      tone: "neutral"
    });
    const announcement = view.root.findAllByType(View).find(
      (node) => node.props.accessible === true && node.props.accessibilityRole === "text"
    )!;
    expect(announcement.props).toMatchObject({
      accessibilityLiveRegion: "polite",
      accessibilityState: { busy: true }
    });
    expect(view.root.findByType(ActivityIndicator)).toBeTruthy();
  });

  it("keeps title and optional message visible, including the no-message state", async () => {
    let withMessage!: ReactTestRenderer;
    let withoutMessage!: ReactTestRenderer;
    await act(async () => {
      withMessage = create(<StateMessage message="Supporting copy" title="Visible title" />);
      withoutMessage = create(<StateMessage title="Title only" />);
    });

    expect(withMessage.root.findAllByType(Text).map((node) => node.props.children)).toEqual(
      expect.arrayContaining(["Visible title", "Supporting copy"])
    );
    expect(withoutMessage.root.findAllByType(Text).map((node) => node.props.children)).toEqual([
      "Title only"
    ]);
    expect(withoutMessage.root.findByType(Feedback).props.message).toBeUndefined();
  });

  it("allows long localized copy to scale and wrap without fixed text heights", async () => {
    const title = "Завантаження детальної інформації про поточну робочу зміну";
    const message =
      "Цей текст залишається повністю видимим на вузькому екрані та зі збільшеним шрифтом.";
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<StateMessage message={message} title={title} />);
    });

    for (const copy of [title, message]) {
      const text = view.root.findAllByType(Text).find((node) => node.props.children === copy)!;
      expect(text.props.allowFontScaling).toBe(true);
      expect(text.props.numberOfLines).toBeUndefined();
      expect(text.props.ellipsizeMode).toBeUndefined();
      expect(StyleSheet.flatten(text.props.style)).not.toHaveProperty("height");
    }
  });
});
