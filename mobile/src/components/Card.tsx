import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle
} from "react-native";
import { theme } from "../utils/theme";

type CardBaseProps = {
  children: ReactNode;
  subtle?: boolean;
  style?: StyleProp<CardLayoutStyle>;
};

type CardLayoutStyle = Pick<
  ViewStyle,
  | "alignSelf"
  | "margin"
  | "marginBottom"
  | "marginEnd"
  | "marginHorizontal"
  | "marginLeft"
  | "marginRight"
  | "marginStart"
  | "marginTop"
  | "marginVertical"
>;

type PassiveContainerProps = Pick<
  ViewProps,
  | "accessibilityHint"
  | "accessibilityLabel"
  | "accessible"
  | "nativeID"
  | "onLayout"
  | "testID"
>;

type PassiveForbiddenNativePropKeys = Exclude<
  keyof ViewProps | keyof PressableProps,
  keyof PassiveContainerProps | "children" | "style"
>;

type PassiveCardProps = CardBaseProps &
  PassiveContainerProps &
  Partial<Record<PassiveForbiddenNativePropKeys, never>> & {
    onPress?: never;
    onLongPress?: never;
    disabled?: never;
  };

type ActionableCardProps = CardBaseProps &
  Omit<PressableProps, "accessibilityLabel" | "children" | "style" | "onPress"> & {
    accessibilityLabel: string;
    onPress: NonNullable<PressableProps["onPress"]>;
  };

type CardProps = PassiveCardProps | ActionableCardProps;

function isActionableCard(props: CardProps): props is ActionableCardProps {
  return (
    typeof props.onPress === "function" &&
    typeof props.accessibilityLabel === "string" &&
    props.accessibilityLabel.trim().length > 0
  );
}

function filterCardLayoutStyle(
  style: StyleProp<CardLayoutStyle> | undefined
): CardLayoutStyle | undefined {
  const flattened = StyleSheet.flatten(style);
  if (!flattened || typeof flattened !== "object") {
    return undefined;
  }

  const safeStyle: CardLayoutStyle = {};
  const allowedEntries = {
    alignSelf: flattened.alignSelf,
    margin: flattened.margin,
    marginBottom: flattened.marginBottom,
    marginEnd: flattened.marginEnd,
    marginHorizontal: flattened.marginHorizontal,
    marginLeft: flattened.marginLeft,
    marginRight: flattened.marginRight,
    marginStart: flattened.marginStart,
    marginTop: flattened.marginTop,
    marginVertical: flattened.marginVertical
  } satisfies CardLayoutStyle;

  for (const [key, value] of Object.entries(allowedEntries)) {
    if (value !== undefined) {
      Object.assign(safeStyle, { [key]: value });
    }
  }

  return Object.keys(safeStyle).length > 0 ? safeStyle : undefined;
}

export function Card(props: CardProps) {
  if (isActionableCard(props)) {
    const {
      children,
      subtle = false,
      style,
      onPress,
      onLongPress,
      disabled = false,
      accessibilityLabel,
      accessibilityState,
      ...pressableProps
    } = props;
    const isDisabled = disabled === true;
    const safeLayoutStyle = filterCardLayoutStyle(style);
    const busy = accessibilityState?.busy ?? pressableProps["aria-busy"];
    const checked = accessibilityState?.checked ?? pressableProps["aria-checked"];
    const expanded = accessibilityState?.expanded ?? pressableProps["aria-expanded"];
    const selected = accessibilityState?.selected ?? pressableProps["aria-selected"];

    return (
      <Pressable
        {...pressableProps}
        accessible
        accessibilityElementsHidden={false}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{
          ...accessibilityState,
          busy,
          checked,
          disabled: isDisabled,
          expanded,
          selected
        }}
        aria-busy={busy}
        aria-checked={checked}
        aria-disabled={isDisabled}
        aria-expanded={expanded}
        aria-hidden={false}
        aria-label={accessibilityLabel}
        aria-selected={selected}
        disabled={isDisabled}
        importantForAccessibility="yes"
        onLongPress={isDisabled ? undefined : onLongPress}
        onPress={isDisabled ? undefined : onPress}
        pointerEvents="auto"
        role="button"
        style={({ pressed }) => [
          styles.actionTarget,
          pressed && !isDisabled && styles.pressed,
          isDisabled && styles.disabled
        ]}
      >
        <View
          style={[
            styles.surface,
            subtle ? styles.subtle : styles.elevated,
            safeLayoutStyle,
            isDisabled && styles.disabledSurface
          ]}
        >
          {children}
        </View>
      </Pressable>
    );
  }

  const {
    accessibilityHint,
    accessibilityLabel,
    accessible,
    children,
    nativeID,
    onLayout,
    style,
    subtle = false,
    testID
  } = props;
  const safeLayoutStyle = filterCardLayoutStyle(style);
  return (
    <View
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessible={accessible}
      nativeID={nativeID}
      onLayout={onLayout}
      style={[styles.surface, subtle ? styles.subtle : styles.elevated, safeLayoutStyle]}
      testID={testID}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  actionTarget: {
    minWidth: theme.target.min,
    minHeight: theme.target.min
  },
  surface: {
    backgroundColor: theme.colors.surface.default,
    borderWidth: theme.border.default,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.padding.card
  },
  elevated: {
    ...theme.elevation.overlay
  },
  subtle: {
    backgroundColor: theme.colors.surface.subtle,
    borderRadius: theme.radius.md
  },
  pressed: {
    opacity: 0.9,
    transform: [{ translateY: theme.border.default }]
  },
  disabled: {
    opacity: 0.6
  },
  disabledSurface: {
    borderStyle: "dashed"
  }
});
