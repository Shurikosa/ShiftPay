import { Feedback } from "./Feedback";

type StateMessageProps = {
  title: string;
  message?: string;
  loading?: boolean;
  tone?: "neutral" | "error" | "success";
};

export function StateMessage({
  title,
  message,
  loading = false,
  tone = "neutral"
}: StateMessageProps) {
  return <Feedback loading={loading} message={message} title={title} tone={tone} />;
}
