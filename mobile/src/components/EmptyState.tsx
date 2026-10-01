import type { ViewProps } from "react-native";
import { Feedback, type FeedbackAction } from "./Feedback";

export type EmptyStateProps = Pick<
  ViewProps,
  "accessibilityHint" | "accessibilityLabel" | "nativeID" | "testID"
> & {
  title: string;
  message: string;
  action?: FeedbackAction;
};

export function EmptyState({
  accessibilityHint,
  accessibilityLabel,
  action,
  message,
  nativeID,
  testID,
  title
}: EmptyStateProps) {
  return (
    <Feedback
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      action={action}
      message={message}
      mode="screen"
      nativeID={nativeID}
      testID={testID}
      title={title}
      tone="neutral"
    />
  );
}
