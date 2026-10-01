import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { StyleSheet, Text, View, type ViewProps } from "react-native";
import { theme } from "../../utils/theme";
import { Button } from "../Button";
import { EmptyState } from "../EmptyState";
import { Feedback } from "../Feedback";

function findRoot(view: ReactTestRenderer, testID: string): ReactTestInstance {
  return view.root.findAllByType(View).find((node) => node.props.testID === testID)!;
}

function findButton(view: ReactTestRenderer, label: string): ReactTestInstance {
  return view.root.findAll(
    (node) =>
      node.props.accessibilityRole === "button" &&
      node.props.accessibilityLabel === label &&
      typeof node.props.style === "function"
  )[0]!;
}

describe("EmptyState", () => {
  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("renders required title and explanation on a neutral screen-level semantic surface", async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <EmptyState
          message="Closed unpaid work will appear here."
          testID="empty-state"
          title="No unpaid attendance"
        />
      );
    });

    expect(view.root.findByType(Feedback).props).toMatchObject({
      message: "Closed unpaid work will appear here.",
      mode: "screen",
      title: "No unpaid attendance",
      tone: "neutral"
    });
    expect(view.root.findAllByType(Text).map((node) => node.props.children)).toEqual(
      expect.arrayContaining(["No unpaid attendance", "Closed unpaid work will appear here."])
    );
    expect(StyleSheet.flatten(findRoot(view, "empty-state").props.style)).toMatchObject({
      backgroundColor: theme.colors.surface.subtle,
      borderColor: theme.colors.border,
      borderWidth: theme.border.default
    });
    expect(view.root.findAll((node) => node.props.accessibilityRole === "button")).toHaveLength(0);
  });

  it("keeps one enabled action separately accessible and invokes only its callback", async () => {
    const onPress = jest.fn();
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <EmptyState
          action={{ label: "Join a shift", onPress, testID: "join-action" }}
          message="Use the code shared by your foreman."
          title="No joined shifts"
        />
      );
    });

    const announcement = view.root.findAllByType(View).find(
      (node) => node.props.accessible === true && node.props.accessibilityRole === "text"
    )!;
    expect(announcement.props.accessibilityLabel).toBe(
      "No joined shifts. Use the code shared by your foreman."
    );
    expect(announcement.findAll((node) => node.props.accessibilityRole === "button"))
      .toHaveLength(0);

    const button = findButton(view, "Join a shift");
    expect(button.props).toMatchObject({
      testID: "join-action",
      accessibilityState: { disabled: false, busy: false }
    });
    expect(StyleSheet.flatten(button.props.style({ pressed: false }))).toMatchObject({
      minHeight: theme.height.control.min,
      minWidth: theme.target.min
    });
    await act(async () => {
      button.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("exposes disabled and loading action semantics without treating them as enabled", async () => {
    const onPress = jest.fn();
    let disabled!: ReactTestRenderer;
    let loading!: ReactTestRenderer;
    await act(async () => {
      disabled = create(
        <EmptyState
          action={{ disabled: true, label: "Create shift", onPress }}
          message="Create the first managed shift."
          title="No managed shifts"
        />
      );
      loading = create(
        <EmptyState
          action={{ label: "Create shift", loading: true, onPress }}
          message="Create the first managed shift."
          title="No managed shifts"
        />
      );
    });

    expect(disabled.root.findByType(Button).props).toMatchObject({ disabled: true });
    expect(findButton(disabled, "Create shift").props.accessibilityState).toMatchObject({
      disabled: true,
      busy: false
    });
    expect(loading.root.findByType(Button).props).toMatchObject({ loading: true });
    expect(findButton(loading, "Create shift").props.accessibilityState).toMatchObject({
      disabled: true,
      busy: true
    });
    expect(onPress).not.toHaveBeenCalled();
  });

  it("wraps long localized title, explanation, and action copy without ellipsis", async () => {
    const title = "Ще немає змін, до яких ви приєдналися як працівник";
    const message =
      "Введіть код зміни, наданий вашим бригадиром, щоб побачити її в історії.";
    const actionLabel = "Приєднатися до зміни за отриманим кодом";
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <EmptyState
          action={{ label: actionLabel, onPress: jest.fn() }}
          message={message}
          title={title}
        />
      );
    });

    for (const copy of [title, message, actionLabel]) {
      const text = view.root.findAllByType(Text).find((node) => node.props.children === copy)!;
      expect(text.props.numberOfLines).toBeUndefined();
      expect(text.props.ellipsizeMode).toBeUndefined();
      expect(StyleSheet.flatten(text.props.style)).toMatchObject({ flexShrink: 1 });
      expect(StyleSheet.flatten(text.props.style)).not.toHaveProperty("height");
    }
  });

  it("whitelists metadata and cannot be hidden through wider runtime ViewProps", async () => {
    const widerProps: ViewProps = {
      accessible: false,
      "aria-hidden": true,
      accessibilityElementsHidden: true,
      accessibilityHint: "Empty list guidance",
      accessibilityLabel: "Payroll empty state",
      importantForAccessibility: "no-hide-descendants",
      nativeID: "empty-native",
      testID: "safe-empty"
    };
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <EmptyState
          {...widerProps}
          message="Create a request after work closes."
          title="No payout requests"
        />
      );
    });

    const root = findRoot(view, "safe-empty");
    expect(root.props).toMatchObject({ nativeID: "empty-native", testID: "safe-empty" });
    expect(root.props.accessible).toBeUndefined();
    expect(root.props["aria-hidden"]).toBeUndefined();
    expect(root.props.accessibilityElementsHidden).toBeUndefined();
    expect(root.props.importantForAccessibility).toBeUndefined();

    const announcement = view.root.findAllByType(View).find(
      (node) => node.props.accessible === true && node.props.accessibilityRole === "text"
    )!;
    expect(announcement.props.accessibilityHint).toBe("Empty list guidance");
    expect(announcement.props.accessibilityLabel).toContain("Payroll empty state");
    expect(announcement.props.accessibilityLabel).toContain("No payout requests");
    expect(announcement.props.accessibilityLabel).toContain("Create a request after work closes.");
  });

  it("rejects arbitrary children, missing explanations, and multiple actions", () => {
    // @ts-expect-error EmptyState requires a specific explanation.
    const missingExplanation = <EmptyState title="No shifts" />;
    // @ts-expect-error EmptyState does not accept arbitrary children.
    const arbitraryChildren = <EmptyState message="None yet" title="No shifts">Extra</EmptyState>;
    const actions = [
      { label: "First", onPress: jest.fn() },
      { label: "Second", onPress: jest.fn() }
    ];
    // @ts-expect-error EmptyState accepts at most one structured action.
    const multipleActions = <EmptyState action={actions} message="None yet" title="No shifts" />;

    expect(missingExplanation).toBeTruthy();
    expect(arbitraryChildren).toBeTruthy();
    expect(multipleActions).toBeTruthy();
  });
});
