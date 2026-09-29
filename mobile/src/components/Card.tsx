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
  style?: StyleProp<ViewStyle>;
};

type PressableOnlyPropKeys = Exclude<
  keyof PressableProps,
  keyof ViewProps | "children" | "style"
>;

type PassiveCardProps = CardBaseProps &
  Omit<ViewProps, "children" | "style"> &
  Partial<Record<PressableOnlyPropKeys, never>> & {
    onPress?: never;
    onLongPress?: never;
    disabled?: never;
  };

type ActionableCardProps = CardBaseProps &
  Omit<PressableProps, "children" | "style" | "onPress"> & {
    onPress: NonNullable<PressableProps["onPress"]>;
  };

type CardProps = PassiveCardProps | ActionableCardProps;

function isActionableCard(props: CardProps): props is ActionableCardProps {
  return typeof props.onPress === "function";
}

export function Card(props: CardProps) {
  if (isActionableCard(props)) {
    const {
      children,
      subtle = false,
      style,
      onPress,
      disabled = false,
      accessibilityState,
      ...pressableProps
    } = props;
    const isDisabled = disabled === true;

    return (
      <Pressable
        {...pressableProps}
        accessibilityRole="button"
        accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
        disabled={isDisabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.actionTarget,
          pressed && !isDisabled && styles.pressed,
          isDisabled && styles.disabled
        ]}
      >
        <View style={[styles.surface, subtle && styles.subtle, style]}>{children}</View>
      </Pressable>
    );
  }

  const { children, subtle = false, style, ...viewProps } = props;
  return (
    <View {...viewProps} style={[styles.surface, subtle && styles.subtle, style]}>
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
  subtle: {
    backgroundColor: theme.colors.surface.subtle
  },
  pressed: {
    opacity: 0.86
  },
  disabled: {
    opacity: 0.6
  }
});
