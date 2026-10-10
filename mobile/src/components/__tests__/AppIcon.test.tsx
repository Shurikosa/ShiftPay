import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { theme } from "../../utils/theme";
import { AppIcon, isAppIconName, type AppIconName } from "../AppIcon";

jest.mock("@expo/vector-icons/Ionicons", () => {
  const actualReact = jest.requireActual<typeof import("react")>("react");
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  const MockIonicons = jest.fn((props: Record<string, unknown>) =>
    actualReact.createElement(Text, props as ComponentProps<typeof Text>)
  );

  return { __esModule: true, default: MockIonicons };
});

const expectedGlyphs = {
  email: "mail-outline",
  password: "lock-closed-outline",
  visibilityOn: "eye-outline",
  visibilityOff: "eye-off-outline",
  person: "person-outline",
  role: "id-card-outline",
  company: "business-outline",
  calendar: "calendar-outline",
  date: "calendar-outline",
  time: "time-outline",
  location: "location-outline",
  wallet: "wallet-outline",
  payroll: "wallet-outline",
  document: "document-text-outline",
  rules: "document-text-outline",
  join: "enter-outline",
  code: "qr-code-outline",
  scan: "scan-outline",
  add: "add-outline",
  create: "create-outline",
  back: "arrow-back-outline",
  forward: "arrow-forward-outline",
  refresh: "refresh-outline",
  settings: "settings-outline",
  logout: "log-out-outline",
  success: "checkmark-circle-outline",
  info: "information-circle-outline",
  warning: "warning-outline",
  error: "alert-circle-outline",
  play: "play-outline",
  pause: "pause-outline",
  stop: "stop-outline"
} as const satisfies Record<AppIconName, ComponentProps<typeof Ionicons>["name"]>;

async function renderIcon(
  props: ComponentProps<typeof AppIcon>
): Promise<ReactTestRenderer> {
  let view!: ReactTestRenderer;
  await act(async () => {
    view = create(<AppIcon {...props} />);
  });
  return view;
}

describe("AppIcon", () => {
  it("recognizes every documented semantic name from the canonical runtime map", () => {
    for (const name of Object.keys(expectedGlyphs)) {
      expect(isAppIconName(name)).toBe(true);
    }
  });

  it.each([
    ["unknown", "not-a-semantic-icon"],
    ["blank", ""],
    ["whitespace", "   "],
    ["raw Ionicons glyph", "mail-outline"],
    ["number", 1],
    ["null", null],
    ["undefined", undefined],
    ["object", { name: "email" }],
    ["prototype key __proto__", "__proto__"],
    ["prototype key constructor", "constructor"],
    ["prototype key toString", "toString"]
  ])("rejects %s as a semantic icon name", (_case, value) => {
    expect(isAppIconName(value)).toBe(false);
  });

  it.each(Object.entries(expectedGlyphs) as [AppIconName, string][])(
    "maps %s to the canonical Ionicons glyph",
    async (name, glyph) => {
      const view = await renderIcon({ name });
      expect(view.root.findByType(Ionicons).props.name).toBe(glyph);
    }
  );

  it("uses the default semantic size and tone", async () => {
    const view = await renderIcon({ name: "email" });
    expect(view.root.findByType(Ionicons).props).toMatchObject({
      size: theme.icon.size.control,
      color: theme.colors.ink.primary
    });
  });

  it.each([
    ["metadata", theme.icon.size.metadata],
    ["control", theme.icon.size.control],
    ["tile", theme.icon.size.tile]
  ] as const)("maps the %s semantic size", async (size, expectedSize) => {
    const view = await renderIcon({ name: "email", size });
    expect(view.root.findByType(Ionicons).props.size).toBe(expectedSize);
  });

  it.each([
    ["primary", theme.colors.ink.primary],
    ["secondary", theme.colors.ink.secondary],
    ["muted", theme.colors.ink.muted],
    ["brand", theme.colors.brand.primary],
    ["success", theme.colors.success.fg],
    ["info", theme.colors.info.fg],
    ["warning", theme.colors.warning.fg],
    ["error", theme.colors.danger.fg],
    ["inverse", theme.colors.surface.default]
  ] as const)("maps the %s semantic tone", async (tone, expectedColor) => {
    const view = await renderIcon({ name: "info", tone });
    expect(view.root.findByType(Ionicons).props.color).toBe(expectedColor);
  });

  it("is decorative and hidden from accessibility by default", async () => {
    const view = await renderIcon({ name: "settings" });
    expect(view.root.findByType(Ionicons).props).toMatchObject({
      accessible: false,
      accessibilityElementsHidden: true,
      importantForAccessibility: "no-hide-descendants",
      "aria-hidden": true
    });
    expect(view.root.findByType(Ionicons).props.accessibilityLabel).toBeUndefined();
    expect(view.root.findByType(Ionicons).props.accessibilityRole).toBeUndefined();
  });

  it("exposes an explicitly labelled informative icon", async () => {
    const view = await renderIcon({
      accessibilityLabel: "Payment information",
      name: "info"
    });
    expect(view.root.findByType(Ionicons).props).toMatchObject({
      accessible: true,
      accessibilityElementsHidden: false,
      accessibilityLabel: "Payment information",
      accessibilityRole: "image",
      importantForAccessibility: "yes",
      "aria-hidden": false
    });
  });

  it("does not forward unsupported props from a wider runtime object", async () => {
    const onPress = jest.fn();
    const widerProps = {
      name: "email" as const,
      color: "#FF00FF",
      style: { margin: 99 },
      children: "unsafe child",
      onPress,
      accessible: true,
      accessibilityRole: "button" as const,
      accessibilityElementsHidden: false,
      importantForAccessibility: "yes" as const,
      "aria-hidden": false,
      testID: "unsafe-icon"
    };
    const view = await renderIcon(widerProps);
    const icon = view.root.findByType(Ionicons);

    expect(icon.props.color).toBe(theme.colors.ink.primary);
    expect(icon.props.accessible).toBe(false);
    expect(icon.props.accessibilityRole).toBeUndefined();
    expect(icon.props.accessibilityElementsHidden).toBe(true);
    expect(icon.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(icon.props["aria-hidden"]).toBe(true);
    expect(icon.props.style).toBeUndefined();
    expect(icon.props.children).toBeUndefined();
    expect(icon.props.onPress).toBeUndefined();
    expect(icon.props.testID).toBeUndefined();
  });

  it("fails closed before calling Ionicons for an invalid runtime name", async () => {
    const ioniconsMock = Ionicons as unknown as jest.Mock;
    ioniconsMock.mockClear();
    const unsafeProps = {
      accessibilityLabel: "Forged image",
      name: "mail-outline"
    } as unknown as ComponentProps<typeof AppIcon>;
    const view = await renderIcon(unsafeProps);

    expect(view.toJSON()).toBeNull();
    expect(ioniconsMock).not.toHaveBeenCalled();
  });

  it("keeps raw presentation and interaction props out of the public contract", () => {
    type Props = ComponentProps<typeof AppIcon>;

    // @ts-expect-error Callers use a semantic name, not an Ionicons glyph.
    const rawGlyph: Props = { name: "mail-outline" };
    // @ts-expect-error Callers use a semantic size token, not a number.
    const numericSize: Props = { name: "email", size: 24 };
    // @ts-expect-error Raw colors are selected by semantic tone.
    const rawColor: Props = { name: "email", color: "#000000" };
    // @ts-expect-error AppIcon does not accept arbitrary styles.
    const rawStyle: Props = { name: "email", style: { margin: 1 } };
    // @ts-expect-error AppIcon has no children slot.
    const children: Props = { name: "email", children: "child" };
    // @ts-expect-error Interactive behavior belongs to the labelled control wrapper.
    const onPress: Props = { name: "email", onPress: jest.fn() };

    expect({ rawGlyph, numericSize, rawColor, rawStyle, children, onPress }).toBeTruthy();
  });
});
