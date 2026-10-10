import type { ComponentProps } from "react";
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer
} from "react-test-renderer";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { StatusTone } from "../../utils/status";
import { theme } from "../../utils/theme";
import { StatusBadge } from "../StatusBadge";

const toneExpectations: readonly (
  readonly [
    StatusTone,
    { backgroundColor: string; borderColor: string; color: string }
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
    "info",
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
    "danger",
    {
      backgroundColor: theme.colors.danger.bg,
      borderColor: theme.colors.danger.fg,
      color: theme.colors.danger.fg
    }
  ]
];

async function renderBadge(
  props: ComponentProps<typeof StatusBadge>
): Promise<ReactTestRenderer> {
  let view!: ReactTestRenderer;
  await act(async () => {
    view = create(<StatusBadge {...props} />);
  });
  return view;
}

function findBadge(view: ReactTestRenderer, testID: string): ReactTestInstance {
  return view.root
    .findAllByType(View)
    .find((node) => node.props.testID === testID)!;
}

function expectNoFixedOrClippingStyle(style: unknown): void {
  const flattened = StyleSheet.flatten(style) as ViewStyle | undefined;
  expect(flattened).not.toHaveProperty("height");
  expect(flattened).not.toHaveProperty("maxHeight");
  expect(flattened?.overflow).not.toBe("hidden");
}

describe("StatusBadge", () => {
  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it.each(toneExpectations)(
    "renders visible status copy with canonical %s tokens",
    async (tone, expected) => {
      const label = `Visible ${tone} status`;
      const view = await renderBadge({ label, testID: `badge-${tone}`, tone });
      const badge = findBadge(view, `badge-${tone}`);
      const labelNode = view.root.findByProps({ children: label });

      expect(badge.props).toMatchObject({
        accessible: true,
        accessibilityElementsHidden: false,
        accessibilityLabel: label,
        accessibilityRole: "text",
        "aria-hidden": false,
        importantForAccessibility: "yes"
      });
      expect(StyleSheet.flatten(badge.props.style)).toMatchObject({
        backgroundColor: expected.backgroundColor,
        borderColor: expected.borderColor,
        borderWidth: theme.border.default
      });
      expect(labelNode.type).toBe(Text);
      expect(StyleSheet.flatten(labelNode.props.style)).toMatchObject({
        color: expected.color
      });
    }
  );

  it.each([
    ["default name", "Paid", undefined, "Paid"],
    ["context", "Paid", "Payment status", "Payment status: Paid"],
    [
      "precomposed exact part",
      "Pending approval",
      "Payout request status: Pending approval",
      "Payout request status: Pending approval"
    ],
    ["substring is not a part", "No", "Not available", "Not available: No"],
    ["normalized exact part", "Paid", "  pAID!  ", "pAID!"],
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
    ]
  ])(
    "preserves the visible label in the accessible name for %s",
    async (_case, label, accessibilityLabel, expectedName) => {
      const view = await renderBadge({
        accessibilityLabel,
        label,
        testID: "named-status"
      });
      const badge = findBadge(view, "named-status");

      expect(badge.props.accessibilityLabel).toBe(expectedName);
      expect(view.root.findByProps({ children: label }).type).toBe(Text);
    }
  );

  it.each([
    ["blank", ""],
    ["whitespace", "   "],
    ["number", 42],
    ["object", { text: "Paid" }]
  ])("fails closed for a %s runtime label", async (_case, label) => {
    const unsafeProps = {
      label,
      testID: "invalid-status"
    } as unknown as ComponentProps<typeof StatusBadge>;
    const view = await renderBadge(unsafeProps);

    expect(view.toJSON()).toBeNull();
  });

  it.each(["error", "#ff00ff", "unknown", 42, null, { tone: "danger" }])(
    "falls back to the canonical neutral palette for invalid runtime tone %p",
    async (tone) => {
      const unsafeProps = {
        label: "Safe status",
        testID: "safe-status",
        tone
      } as unknown as ComponentProps<typeof StatusBadge>;
      const view = await renderBadge(unsafeProps);
      const badge = findBadge(view, "safe-status");
      const labelNode = view.root.findByProps({ children: "Safe status" });

      expect(StyleSheet.flatten(badge.props.style)).toMatchObject({
        backgroundColor: theme.colors.surface.subtle,
        borderColor: theme.colors.border
      });
      expect(StyleSheet.flatten(labelNode.props.style)).toMatchObject({
        color: theme.colors.ink.secondary
      });
    }
  );

  it("maps the one production legacy primary input to canonical info presentation", async () => {
    const view = await renderBadge({
      label: "Pay breakdown",
      testID: "legacy-primary",
      tone: "primary"
    });
    const badge = findBadge(view, "legacy-primary");

    expect(StyleSheet.flatten(badge.props.style)).toMatchObject({
      backgroundColor: theme.colors.info.bg,
      borderColor: theme.colors.info.fg
    });
  });

  it("keeps long Ukrainian, English, and currency copy scalable and unclipped", async () => {
    const label =
      "Очікує підтвердження виплати € 1 234,56 for an unusually long payroll period";
    const view = await renderBadge({ label, testID: "localized-badge" });
    const badge = findBadge(view, "localized-badge");
    const labelNode = view.root.findByProps({ children: label });

    expectNoFixedOrClippingStyle(badge.props.style);
    expectNoFixedOrClippingStyle(labelNode.props.style);
    expect(StyleSheet.flatten(badge.props.style)).toMatchObject({
      flexShrink: 1,
      maxWidth: "100%"
    });
    expect(labelNode.props).toMatchObject({ allowFontScaling: true });
    expect(labelNode.props.numberOfLines).toBeUndefined();
    expect(labelNode.props.ellipsizeMode).toBeUndefined();
  });

  it("does not forward hostile visibility, semantics, interaction, content, or style props", async () => {
    const onLongPress = jest.fn();
    const onPress = jest.fn();
    const hostileProps = {
      accessible: false,
      accessibilityElementsHidden: true,
      accessibilityLabel: "Payment status",
      accessibilityRole: "button",
      "aria-hidden": true,
      children: <Text>Injected</Text>,
      importantForAccessibility: "no-hide-descendants",
      label: "Paid",
      onLongPress,
      onPress,
      role: "button",
      style: { display: "none", height: 1, overflow: "hidden" },
      testID: "authoritative-status"
    } as unknown as ComponentProps<typeof StatusBadge>;
    const view = await renderBadge(hostileProps);
    const badge = findBadge(view, "authoritative-status");

    expect(badge.props).toMatchObject({
      accessible: true,
      accessibilityElementsHidden: false,
      accessibilityLabel: "Payment status: Paid",
      accessibilityRole: "text",
      "aria-hidden": false,
      importantForAccessibility: "yes"
    });
    expect(badge.props.onPress).toBeUndefined();
    expect(badge.props.onLongPress).toBeUndefined();
    expect(badge.props.role).toBeUndefined();
    expect(view.root.findAllByProps({ children: "Injected" })).toHaveLength(0);
    expectNoFixedOrClippingStyle(badge.props.style);
    expect(onPress).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("keeps canonical tone and non-interactive public contracts narrow", () => {
    type Props = ComponentProps<typeof StatusBadge>;
    const canonical: StatusTone = "danger";
    const primaryCompatibility: Props = { label: "Pay breakdown", tone: "primary" };

    // @ts-expect-error `primary` is not a canonical status tone.
    const primaryCanonical: StatusTone = "primary";
    // @ts-expect-error `error` is replaced by canonical `danger`.
    const errorCanonical: StatusTone = "error";
    // @ts-expect-error The unused legacy error input is not part of StatusBadge.
    const legacyError: Props = { label: "Rejected", tone: "error" };
    // @ts-expect-error StatusBadge owns its status content.
    const children: Props = { children: "Hidden", label: "Paid" };
    // @ts-expect-error StatusBadge has no raw style escape hatch.
    const style: Props = { label: "Paid", style: { backgroundColor: "red" } };
    // @ts-expect-error StatusBadge is not interactive.
    const onPress: Props = { label: "Paid", onPress: jest.fn() };
    // @ts-expect-error Callers cannot hide status semantics.
    const inaccessible: Props = { accessible: false, label: "Paid" };

    expect({
      canonical,
      children,
      errorCanonical,
      inaccessible,
      legacyError,
      onPress,
      primaryCanonical,
      primaryCompatibility,
      style
    }).toBeTruthy();
  });
});
