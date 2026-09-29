import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { StyleSheet, Text, View, type ViewProps } from "react-native";
import type { StatusTone } from "../../utils/status";
import { theme } from "../../utils/theme";
import { StatusBadge } from "../StatusBadge";

const toneExpectations: readonly (
  readonly [
    StatusTone,
    {
      backgroundColor: string;
      borderColor: string;
      color: string;
    }
  ]
)[] = [
  [
    "neutral",
    {
      backgroundColor: theme.colors.surface.subtle,
      borderColor: theme.colors.border,
      color: theme.colors.ink.secondary
    }
  ],
  [
    "primary",
    {
      backgroundColor: theme.colors.info.bg,
      borderColor: theme.colors.info.fg,
      color: theme.colors.info.fg
    }
  ],
  [
    "success",
    {
      backgroundColor: theme.colors.success.bg,
      borderColor: theme.colors.success.fg,
      color: theme.colors.success.fg
    }
  ],
  [
    "warning",
    {
      backgroundColor: theme.colors.warning.bg,
      borderColor: theme.colors.warning.fg,
      color: theme.colors.warning.fg
    }
  ],
  [
    "error",
    {
      backgroundColor: theme.colors.danger.bg,
      borderColor: theme.colors.danger.fg,
      color: theme.colors.danger.fg
    }
  ]
];

describe("StatusBadge", () => {
  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it.each(toneExpectations)(
    "renders visible status copy with canonical %s tone tokens",
    async (tone, expected) => {
      const label = `Visible ${tone} status`;
      let view!: ReactTestRenderer;
      await act(async () => {
        view = create(<StatusBadge label={label} tone={tone} testID={`badge-${tone}`} />);
      });

      const badge = view.root
        .findAllByType(View)
        .find((node) => node.props.testID === `badge-${tone}`)!;
      expect(StyleSheet.flatten(badge.props.style)).toMatchObject({
        backgroundColor: expected.backgroundColor,
        borderColor: expected.borderColor,
        borderWidth: theme.border.default
      });

      const text = view.root.findAllByType(Text).find((node) => node.props.children === label)!;
      expect(text).toBeTruthy();
      expect(StyleSheet.flatten(text.props.style)).toMatchObject({ color: expected.color });
      expect(badge.props.accessibilityLabel).toBe(label);
    }
  );

  it("grows and wraps for a long localized label without truncation", async () => {
    const label =
      "Очікує на підтвердження виплати за дуже довгий локалізований період роботи";
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<StatusBadge label={label} testID="localized-badge" />);
    });

    const badge = view.root
      .findAllByType(View)
      .find((node) => node.props.testID === "localized-badge")!;
    const badgeStyle = StyleSheet.flatten(badge.props.style);
    expect(badgeStyle).toMatchObject({ maxWidth: "100%", flexShrink: 1 });
    expect(badgeStyle).not.toHaveProperty("height");
    expect(badgeStyle).not.toHaveProperty("maxHeight");

    const text = view.root.findAllByType(Text).find((node) => node.props.children === label)!;
    expect(text.props).toMatchObject({ allowFontScaling: true });
    expect(text.props.numberOfLines).toBeUndefined();
    expect(text.props.ellipsizeMode).toBeUndefined();
    expect(StyleSheet.flatten(text.props.style)).toMatchObject({ flexShrink: 1 });
    expect(StyleSheet.flatten(text.props.style)).not.toHaveProperty("height");
  });

  it("adds caller context to the visible label in its accessible name", async () => {
    const label = "Pending approval";
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <StatusBadge
          accessibilityHint="This request still needs review"
          accessibilityLabel="Payout request status: Pending approval"
          label={label}
          nativeID="request-status"
          testID="request-status-badge"
          tone="warning"
        />
      );
    });

    const badge = view.root
      .findAllByType(View)
      .find((node) => node.props.testID === "request-status-badge")!;
    expect(badge.props).toMatchObject({
      accessible: true,
      accessibilityRole: "text",
      accessibilityLabel: "Payout request status: Pending approval",
      accessibilityHint: "This request still needs review",
      nativeID: "request-status"
    });
    expect(view.root.findAllByType(Text).some((node) => node.props.children === label)).toBe(true);
  });

  it("keeps the exact visible label in a contextual accessible name", async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <StatusBadge
          accessibilityLabel="Payment status"
          label="Paid"
          testID="paid-status"
          tone="success"
        />
      );
    });

    const badge = view.root
      .findAllByType(View)
      .find((node) => node.props.testID === "paid-status")!;
    expect(badge.props.accessibilityLabel).toContain("Payment status");
    expect(badge.props.accessibilityLabel).toContain("Paid");
    expect(view.root.findAllByType(Text).some((node) => node.props.children === "Paid")).toBe(true);
  });

  it("does not support disabling accessibility through its public type contract", () => {
    // @ts-expect-error StatusBadge is always an accessible status element.
    const inaccessibleBadge = <StatusBadge accessible={false} label="Paid" />;

    expect(inaccessibleBadge).toBeTruthy();
  });

  it("keeps the actual root accessible after a wider ViewProps runtime bypass", async () => {
    const widerViewProps: ViewProps = {
      accessible: false,
      "aria-hidden": true,
      accessibilityElementsHidden: true,
      accessibilityLabel: "Payment status",
      accessibilityHint: "Current payment state",
      importantForAccessibility: "no-hide-descendants",
      nativeID: "runtime-bypass-native",
      testID: "runtime-bypass-status"
    };
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<StatusBadge {...widerViewProps} label="Paid" />);
    });

    const badge = view.root
      .findAllByType(View)
      .find((node) => node.props.testID === "runtime-bypass-status")!;
    expect(badge.props.accessible).toBe(true);
    expect(badge.props.accessibilityRole).toBe("text");
    expect(badge.props.accessibilityLabel).toContain("Payment status");
    expect(badge.props.accessibilityLabel).toContain("Paid");
    expect(badge.props).toMatchObject({
      accessibilityHint: "Current payment state",
      nativeID: "runtime-bypass-native",
      testID: "runtime-bypass-status"
    });
    expect(badge.props["aria-hidden"]).toBeUndefined();
    expect(badge.props.accessibilityElementsHidden).toBeUndefined();
    expect(badge.props.importantForAccessibility).toBeUndefined();
  });

  it("uses the exact visible label as the default accessible name", async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<StatusBadge label="Paid" testID="default-name-status" />);
    });

    const badge = view.root
      .findAllByType(View)
      .find((node) => node.props.testID === "default-name-status")!;
    expect(badge.props.accessibilityLabel).toBe("Paid");
  });
});
