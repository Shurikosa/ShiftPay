import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { ActivityIndicator, StyleSheet, Text, View, type ViewProps } from "react-native";
import { theme } from "../../utils/theme";
import { Button } from "../Button";
import { Feedback, type FeedbackTone } from "../Feedback";

const toneExpectations: readonly (
  readonly [
    FeedbackTone,
    {
      backgroundColor: string;
      borderColor: string;
      titleColor: string;
      messageColor: string;
    }
  ]
)[] = [
  [
    "neutral",
    {
      backgroundColor: theme.colors.surface.subtle,
      borderColor: theme.colors.border,
      titleColor: theme.colors.ink.primary,
      messageColor: theme.colors.ink.secondary
    }
  ],
  [
    "info",
    {
      backgroundColor: theme.colors.info.bg,
      borderColor: theme.colors.info.fg,
      titleColor: theme.colors.info.fg,
      messageColor: theme.colors.info.fg
    }
  ],
  [
    "warning",
    {
      backgroundColor: theme.colors.warning.bg,
      borderColor: theme.colors.warning.fg,
      titleColor: theme.colors.warning.fg,
      messageColor: theme.colors.warning.fg
    }
  ],
  [
    "error",
    {
      backgroundColor: theme.colors.danger.bg,
      borderColor: theme.colors.danger.fg,
      titleColor: theme.colors.danger.fg,
      messageColor: theme.colors.danger.fg
    }
  ],
  [
    "success",
    {
      backgroundColor: theme.colors.success.bg,
      borderColor: theme.colors.success.fg,
      titleColor: theme.colors.success.fg,
      messageColor: theme.colors.success.fg
    }
  ]
];

function findRoot(view: ReactTestRenderer, testID: string): ReactTestInstance {
  return view.root.findAllByType(View).find((node) => node.props.testID === testID)!;
}

function findAnnouncement(view: ReactTestRenderer): ReactTestInstance {
  return view.root.findAllByType(View).find(
    (node) =>
      node.props.accessible === true &&
      (node.props.accessibilityRole === "text" || node.props.accessibilityRole === "alert")
  )!;
}

function findButton(view: ReactTestRenderer, label: string): ReactTestInstance {
  return view.root.findAll(
    (node) =>
      node.props.accessibilityRole === "button" &&
      node.props.accessibilityLabel === label &&
      typeof node.props.style === "function"
  )[0]!;
}

describe("Feedback", () => {
  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it.each(toneExpectations)(
    "uses canonical semantic tokens for the %s tone",
    async (tone, expected) => {
      const title = `${tone} feedback`;
      let view!: ReactTestRenderer;
      await act(async () => {
        view = create(
          <Feedback
            message={`${tone} supporting copy`}
            testID={`feedback-${tone}`}
            title={title}
            tone={tone}
          />
        );
      });

      expect(StyleSheet.flatten(findRoot(view, `feedback-${tone}`).props.style)).toMatchObject({
        backgroundColor: expected.backgroundColor,
        borderColor: expected.borderColor,
        borderWidth: theme.border.default
      });
      const titleNode = view.root.findAllByType(Text).find((node) => node.props.children === title)!;
      expect(StyleSheet.flatten(titleNode.props.style)).toMatchObject({ color: expected.titleColor });
      const messageNode = view.root.findAllByType(Text).find(
        (node) => node.props.children === `${tone} supporting copy`
      )!;
      expect(StyleSheet.flatten(messageNode.props.style)).toMatchObject({
        color: expected.messageColor
      });
    }
  );

  it("supports inline by default and the screen presentation mode without fixed dimensions", async () => {
    let inlineView!: ReactTestRenderer;
    let screenView!: ReactTestRenderer;
    await act(async () => {
      inlineView = create(<Feedback testID="inline" title="Inline" />);
      screenView = create(<Feedback mode="screen" testID="screen" title="Screen" />);
    });

    const inlineStyle = StyleSheet.flatten(findRoot(inlineView, "inline").props.style);
    const screenStyle = StyleSheet.flatten(findRoot(screenView, "screen").props.style);
    expect(inlineStyle).toMatchObject({
      borderRadius: theme.radius.md,
      padding: theme.space[3]
    });
    expect(screenStyle).toMatchObject({
      borderRadius: theme.radius.lg,
      padding: theme.padding.card
    });
    for (const style of [inlineStyle, screenStyle]) {
      expect(style).not.toHaveProperty("height");
      expect(style).not.toHaveProperty("maxHeight");
    }
  });

  it.each([
    ["error", false, "alert", "assertive"],
    ["info", false, "text", "polite"],
    ["success", false, "text", "polite"],
    ["warning", false, "text", "polite"],
    ["neutral", true, "text", "polite"]
  ] as const)(
    "exposes announcement and busy semantics for %s feedback",
    async (tone, loading, role, liveRegion) => {
      let view!: ReactTestRenderer;
      await act(async () => {
        view = create(<Feedback loading={loading} title="Status update" tone={tone} />);
      });

      const announcement = findAnnouncement(view);
      expect(announcement.props).toMatchObject({
        accessibilityRole: role,
        accessibilityLiveRegion: liveRegion,
        accessibilityState: { busy: loading }
      });
      expect(view.root.findAllByType(ActivityIndicator)).toHaveLength(loading ? 1 : 0);
    }
  );

  it("keeps localized title and message visible, scalable, and untruncated", async () => {
    const title = "Не вдалося оновити дуже довгу назву робочої зміни";
    const message =
      "Перевірте з’єднання та спробуйте ще раз, коли мережа буде доступна.";
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<Feedback message={message} title={title} />);
    });

    for (const copy of [title, message]) {
      const text = view.root.findAllByType(Text).find((node) => node.props.children === copy)!;
      expect(text.props.allowFontScaling).toBe(true);
      expect(text.props.numberOfLines).toBeUndefined();
      expect(text.props.ellipsizeMode).toBeUndefined();
      expect(StyleSheet.flatten(text.props.style)).toMatchObject({ flexShrink: 1 });
      expect(StyleSheet.flatten(text.props.style)).not.toHaveProperty("height");
    }
    expect(findAnnouncement(view).props.accessibilityLabel).toContain(title);
    expect(findAnnouncement(view).props.accessibilityLabel).toContain(message);
  });

  it("adds visible copy when caller context contains it only as a substring", async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<Feedback accessibilityLabel="Not available" title="No" />);
    });

    expect(findAnnouncement(view).props.accessibilityLabel).toBe("Not available. No.");
    expect(view.root.findAllByType(Text).some((node) => node.props.children === "No")).toBe(true);
  });

  it("does not duplicate visible copy after full normalized equality", async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <Feedback accessibilityLabel="  status   update!  " title="Status update!" />
      );
    });

    expect(findAnnouncement(view).props.accessibilityLabel).toBe("status   update!");
  });

  it("invokes one enabled structured action and keeps it separate from announced copy", async () => {
    const onPress = jest.fn();
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <Feedback
          action={{
            label: "Спробувати ще раз",
            onPress,
            accessibilityLabel: "Recovery action",
            accessibilityHint: "Retries the request",
            testID: "retry-action"
          }}
          message="The request can be retried."
          title="Request failed"
          tone="error"
        />
      );
    });

    const buttonName = "Recovery action. Спробувати ще раз";
    const button = findButton(view, buttonName);
    expect(button.props).toMatchObject({
      disabled: false,
      testID: "retry-action",
      accessibilityHint: "Retries the request",
      accessibilityState: { disabled: false, busy: false }
    });
    expect(findAnnouncement(view).findAll((node) => node.props.accessibilityRole === "button"))
      .toHaveLength(0);
    expect(StyleSheet.flatten(button.props.style({ pressed: false }))).toMatchObject({
      minHeight: theme.height.control.min,
      minWidth: theme.target.min
    });

    await act(async () => {
      button.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("disables actions while feedback or the action is busy, and supports no action", async () => {
    const onPress = jest.fn();
    let feedbackBusy!: ReactTestRenderer;
    let actionBusy!: ReactTestRenderer;
    let disabled!: ReactTestRenderer;
    let noAction!: ReactTestRenderer;
    await act(async () => {
      feedbackBusy = create(
        <Feedback action={{ label: "Retry", onPress }} loading title="Loading" />
      );
      actionBusy = create(
        <Feedback action={{ label: "Retry", loading: true, onPress }} title="Retrying" />
      );
      disabled = create(
        <Feedback action={{ disabled: true, label: "Retry", onPress }} title="Unavailable" />
      );
      noAction = create(<Feedback title="Informational only" />);
    });

    expect(feedbackBusy.root.findByType(Button).props).toMatchObject({ disabled: true });
    expect(findButton(feedbackBusy, "Retry").props.accessibilityState).toMatchObject({
      disabled: true
    });
    expect(actionBusy.root.findByType(Button).props).toMatchObject({ loading: true });
    expect(findButton(actionBusy, "Retry").props.accessibilityState).toMatchObject({
      disabled: true,
      busy: true
    });
    expect(disabled.root.findByType(Button).props).toMatchObject({ disabled: true });
    expect(noAction.root.findAll((node) => node.props.accessibilityRole === "button"))
      .toHaveLength(0);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("whitelists metadata and filters accessibility-hiding props from wider runtime objects", async () => {
    const widerProps: ViewProps = {
      accessible: false,
      "aria-hidden": true,
      accessibilityElementsHidden: true,
      accessibilityHint: "Current request state",
      accessibilityLabel: "Request feedback",
      importantForAccessibility: "no-hide-descendants",
      nativeID: "feedback-native",
      testID: "safe-feedback"
    };
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <Feedback {...widerProps} message="Try again later" title="Request failed" tone="error" />
      );
    });

    const root = findRoot(view, "safe-feedback");
    expect(root.props).toMatchObject({ nativeID: "feedback-native", testID: "safe-feedback" });
    expect(root.props.accessible).toBeUndefined();
    expect(root.props["aria-hidden"]).toBeUndefined();
    expect(root.props.accessibilityElementsHidden).toBeUndefined();
    expect(root.props.importantForAccessibility).toBeUndefined();

    const announcement = findAnnouncement(view);
    expect(announcement.props.accessibilityHint).toBe("Current request state");
    expect(announcement.props.accessibilityLabel).toContain("Request feedback");
    expect(announcement.props.accessibilityLabel).toContain("Request failed");
    expect(announcement.props.accessibilityLabel).toContain("Try again later");
    expect(announcement.props["aria-hidden"]).toBeUndefined();
    expect(announcement.props.accessibilityElementsHidden).toBeUndefined();
    expect(announcement.props.importantForAccessibility).toBeUndefined();

  });
});
