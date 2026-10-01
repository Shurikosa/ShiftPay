import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewProps
} from "react-native";
import { theme } from "../utils/theme";
import { Button } from "./Button";

export type FeedbackTone = "neutral" | "info" | "warning" | "error" | "success";
export type FeedbackMode = "inline" | "screen";

export type FeedbackAction = {
  label: string;
  onPress: NonNullable<PressableProps["onPress"]>;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

export type FeedbackProps = Pick<
  ViewProps,
  "accessibilityHint" | "accessibilityLabel" | "nativeID" | "testID"
> & {
  title: string;
  message?: string;
  loading?: boolean;
  tone?: FeedbackTone;
  mode?: FeedbackMode;
  action?: FeedbackAction;
};

type TonePresentation = {
  backgroundColor: string;
  borderColor: string;
  titleColor: string;
  messageColor: string;
};

const tonePresentation: Record<FeedbackTone, TonePresentation> = {
  neutral: {
    backgroundColor: theme.colors.surface.subtle,
    borderColor: theme.colors.border,
    titleColor: theme.colors.ink.primary,
    messageColor: theme.colors.ink.secondary
  },
  info: {
    backgroundColor: theme.colors.info.bg,
    borderColor: theme.colors.info.fg,
    titleColor: theme.colors.info.fg,
    messageColor: theme.colors.info.fg
  },
  warning: {
    backgroundColor: theme.colors.warning.bg,
    borderColor: theme.colors.warning.fg,
    titleColor: theme.colors.warning.fg,
    messageColor: theme.colors.warning.fg
  },
  error: {
    backgroundColor: theme.colors.danger.bg,
    borderColor: theme.colors.danger.fg,
    titleColor: theme.colors.danger.fg,
    messageColor: theme.colors.danger.fg
  },
  success: {
    backgroundColor: theme.colors.success.bg,
    borderColor: theme.colors.success.fg,
    titleColor: theme.colors.success.fg,
    messageColor: theme.colors.success.fg
  }
};

function normalizeAccessiblePart(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLowerCase();
}

function appendVisibleCopy(
  context: string | undefined,
  visibleCopy: readonly string[],
  terminate = true
): string {
  const normalizedContext = context?.trim();
  const parts = normalizedContext ? [normalizedContext] : [];

  for (const copy of visibleCopy) {
    const normalizedCopy = normalizeAccessiblePart(copy);
    if (!parts.some((part) => normalizeAccessiblePart(part) === normalizedCopy)) {
      parts.push(copy);
    }
  }

  if (!terminate) {
    return parts.join(". ");
  }

  return parts.map((part) => (/[.!?…]$/u.test(part) ? part : `${part}.`)).join(" ");
}

function getLiveRegion(
  tone: FeedbackTone,
  loading: boolean
): ViewProps["accessibilityLiveRegion"] {
  if (tone === "error") {
    return "assertive";
  }

  if (loading || tone === "info" || tone === "warning" || tone === "success") {
    return "polite";
  }

  return "none";
}

export function Feedback({
  accessibilityHint,
  accessibilityLabel,
  action,
  loading = false,
  message,
  mode = "inline",
  nativeID,
  testID,
  title,
  tone = "neutral"
}: FeedbackProps) {
  const palette = tonePresentation[tone];
  const contentName = appendVisibleCopy(
    accessibilityLabel,
    message ? [title, message] : [title]
  );
  const actionName = action
    ? appendVisibleCopy(action.accessibilityLabel, [action.label], false)
    : undefined;

  return (
    <View
      nativeID={nativeID}
      style={[
        styles.container,
        styles[mode],
        { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }
      ]}
      testID={testID}
    >
      <View
        accessible
        accessibilityHint={accessibilityHint}
        accessibilityLabel={contentName}
        accessibilityLiveRegion={getLiveRegion(tone, loading)}
        accessibilityRole={tone === "error" ? "alert" : "text"}
        accessibilityState={{ busy: loading }}
        style={styles.content}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.brand.primary} style={styles.spinner} />
        ) : null}
        <View style={styles.copy}>
          <Text
            allowFontScaling
            style={[styles.title, { color: palette.titleColor }]}
          >
            {title}
          </Text>
          {message ? (
            <Text
              allowFontScaling
              style={[styles.message, { color: palette.messageColor }]}
            >
              {message}
            </Text>
          ) : null}
        </View>
      </View>

      {action ? (
        <Button
          accessibilityHint={action.accessibilityHint}
          accessibilityLabel={actionName}
          disabled={loading || action.disabled === true}
          label={action.label}
          loading={action.loading}
          onPress={action.onPress}
          testID={action.testID}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: "100%",
    flexShrink: 1,
    borderWidth: theme.border.default,
    gap: theme.space[3]
  },
  inline: {
    borderRadius: theme.radius.md,
    padding: theme.space[3]
  },
  screen: {
    borderRadius: theme.radius.lg,
    padding: theme.padding.card
  },
  content: {
    width: "100%",
    flexShrink: 1,
    gap: theme.space[2]
  },
  spinner: {
    alignSelf: "flex-start"
  },
  copy: {
    width: "100%",
    flexShrink: 1,
    gap: theme.space[1]
  },
  title: {
    ...theme.typography.cardTitle,
    flexShrink: 1
  },
  message: {
    ...theme.typography.supporting,
    flexShrink: 1
  }
});
