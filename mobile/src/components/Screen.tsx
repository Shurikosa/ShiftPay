import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { theme } from "../utils/theme";

type SafeScrollProps = Pick<
  ScrollViewProps,
  | "accessibilityHint"
  | "accessibilityLabel"
  | "accessibilityRole"
  | "accessibilityState"
  | "accessible"
  | "keyboardDismissMode"
  | "nativeID"
  | "onContentSizeChange"
  | "onMomentumScrollBegin"
  | "onMomentumScrollEnd"
  | "onScroll"
  | "onScrollBeginDrag"
  | "onScrollEndDrag"
  | "refreshControl"
  | "scrollEventThrottle"
  | "showsVerticalScrollIndicator"
  | "testID"
>;

type ScreenInsetStyle = Pick<
  ViewStyle,
  | "padding"
  | "paddingBottom"
  | "paddingEnd"
  | "paddingHorizontal"
  | "paddingLeft"
  | "paddingRight"
  | "paddingStart"
  | "paddingTop"
  | "paddingVertical"
>;

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ScreenInsetStyle>;
  scrollContentStyle?: StyleProp<ScreenInsetStyle>;
  safeAreaEdges?: Edge[];
  keyboardVerticalOffset?: number;
  scrollProps?: SafeScrollProps;
};

function normalizeInsetStyle(style: StyleProp<ScreenInsetStyle>): ScreenInsetStyle | undefined {
  const flattened = StyleSheet.flatten(style);

  if (!flattened) {
    return undefined;
  }

  const normalized: ScreenInsetStyle = {};
  const insetKeys: (keyof ScreenInsetStyle)[] = [
    "padding",
    "paddingBottom",
    "paddingEnd",
    "paddingHorizontal",
    "paddingLeft",
    "paddingRight",
    "paddingStart",
    "paddingTop",
    "paddingVertical"
  ];

  for (const key of insetKeys) {
    const value = flattened[key];
    if (value !== undefined) {
      normalized[key] = value;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function Screen({ children, scroll = true, contentStyle, scrollContentStyle, safeAreaEdges, keyboardVerticalOffset, scrollProps }: ScreenProps) {
  const {
    accessibilityHint,
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
    accessible,
    keyboardDismissMode,
    nativeID,
    onContentSizeChange,
    onMomentumScrollBegin,
    onMomentumScrollEnd,
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    refreshControl,
    scrollEventThrottle,
    showsVerticalScrollIndicator,
    testID
  } = scrollProps ?? {};
  const normalizedContentStyle = normalizeInsetStyle(contentStyle);
  const normalizedScrollContentStyle = normalizeInsetStyle(scrollContentStyle);
  const content = <View style={[styles.content, normalizedContentStyle]}>{children}</View>;

  return (
    <SafeAreaView edges={safeAreaEdges} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={styles.keyboardAvoiding}
      >
        {scroll ? (
          <ScrollView
            accessibilityHint={accessibilityHint}
            accessibilityLabel={accessibilityLabel}
            accessibilityRole={accessibilityRole}
            accessibilityState={accessibilityState}
            accessible={accessible}
            contentContainerStyle={[normalizedScrollContentStyle, styles.scrollContent]}
            horizontal={false}
            keyboardDismissMode={keyboardDismissMode}
            keyboardShouldPersistTaps="handled"
            nativeID={nativeID}
            onContentSizeChange={onContentSizeChange}
            onMomentumScrollBegin={onMomentumScrollBegin}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onScroll={onScroll}
            onScrollBeginDrag={onScrollBeginDrag}
            onScrollEndDrag={onScrollEndDrag}
            refreshControl={refreshControl}
            scrollEventThrottle={scrollEventThrottle}
            scrollEnabled
            showsVerticalScrollIndicator={showsVerticalScrollIndicator}
            testID={testID}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.canvas
  },
  keyboardAvoiding: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.inset.screen,
    paddingVertical: theme.space[6]
  }
});
