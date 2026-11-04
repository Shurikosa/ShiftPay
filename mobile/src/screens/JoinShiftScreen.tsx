import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ApiError, getErrorMessage } from "../api/errors";
import { joinShiftByCode } from "../api/shifts";
import { AppIcon } from "../components/AppIcon";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Feedback } from "../components/Feedback";
import { FormField } from "../components/FormField";
import { Screen } from "../components/Screen";
import { useAuth } from "../context/AuthContext";
import { useWorkerShiftHistoryPagesContext } from "../context/WorkerShiftHistoryPagesContext";
import type { WorkerStackParamList } from "../types/navigation";
import { theme } from "../utils/theme";
import { isBlank } from "../utils/validation";

type JoinShiftScreenProps = NativeStackScreenProps<WorkerStackParamList, "JoinShift">;

function getJoinShiftErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    if (error.message.toLowerCase().includes("already joined")) {
      return error.message;
    }

    return "This shift can no longer be joined.";
  }

  return getErrorMessage(error);
}

export function JoinShiftScreen({ navigation }: JoinShiftScreenProps) {
  const { authenticatedRequest, user } = useAuth();
  const { refreshAfterMutation } = useWorkerShiftHistoryPagesContext();
  const [joinCode, setJoinCode] = useState("");
  const [joinCodeError, setJoinCodeError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const submitInFlight = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleJoinCodeChange = (value: string) => {
    setJoinCode(value.toUpperCase());
    setJoinCodeError(undefined);
    setError(null);
    setSuccessMessage(null);
  };

  const refreshHistorySafely = () => {
    try {
      void Promise.resolve(refreshAfterMutation()).catch(() => undefined);
    } catch {
      // Joining succeeded; a later history refresh can recover the list.
    }
  };

  const handleBackToDashboard = () => {
    navigation.popTo("WorkerTabs", { screen: "WorkerDashboard" });
  };

  const handleSubmit = () => {
    if (submitInFlight.current) {
      return;
    }

    if (user?.role !== "WORKER" || !user.company) {
      setError("Join your company before joining shifts.");
      return;
    }

    const normalizedJoinCode = joinCode.trim().toUpperCase();
    if (isBlank(normalizedJoinCode)) {
      setJoinCodeError("Enter a join code.");
      return;
    }

    submitInFlight.current = true;
    setSubmitting(true);
    setJoinCodeError(undefined);
    setError(null);
    setSuccessMessage(null);

    void Promise.resolve()
      .then(() =>
        authenticatedRequest((token) =>
          joinShiftByCode(token, { joinCode: normalizedJoinCode })
        )
      )
      .then((response) => {
        if (!mountedRef.current) {
          return;
        }

        setSuccessMessage(`Joined shift ${response.shiftId}. Waiting for foreman approval.`);
        setJoinCode("");
        refreshHistorySafely();
        navigation.popTo("WorkerTabs", { screen: "WorkerDashboard" });
      })
      .catch((caughtError) => {
        if (!mountedRef.current) {
          return;
        }

        setError(getJoinShiftErrorMessage(caughtError));
      })
      .finally(() => {
        submitInFlight.current = false;
        if (mountedRef.current) {
          setSubmitting(false);
        }
      });
  };

  const isWorker = user?.role === "WORKER";
  const company = isWorker ? user.company : null;

  if (!company) {
    const missingCompany = isWorker;

    return (
      <Screen
        scroll
        scrollProps={{
          keyboardDismissMode: "on-drag",
          testID: "join-shift-scroll"
        }}
      >
        <View style={styles.page} testID="join-shift-content">
          <View style={styles.header} testID="join-shift-header">
            <Button
              accessibilityHint="Returns to the worker dashboard."
              disabled={submitting}
              label="Back to dashboard"
              leadingIcon="back"
              onPress={handleBackToDashboard}
              style={styles.backAction}
              testID="join-shift-back"
              variant="ghost"
            />
            <View style={styles.headerCopy}>
              <Text allowFontScaling style={styles.eyebrow}>
                Worker
              </Text>
              <Text accessibilityRole="header" allowFontScaling style={styles.title}>
                Join shift
              </Text>
              <Text allowFontScaling style={styles.subtitle}>
                {missingCompany
                  ? "A company is required before shifts can be joined."
                  : "Only a worker with a company can join a shift."}
              </Text>
            </View>
          </View>

          <Feedback
            message={
              missingCompany
                ? "Join your company first, then enter the shift join code from your foreman."
                : "This action is available only in the worker company flow."
            }
            mode="screen"
            testID="join-shift-company-required"
            title={missingCompany ? "Company required" : "Worker access required"}
            tone="error"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      scrollProps={{
        keyboardDismissMode: "on-drag",
        testID: "join-shift-scroll"
      }}
    >
      <View style={styles.page} testID="join-shift-content">
        <View style={styles.header} testID="join-shift-header">
          <Button
            accessibilityHint="Returns to the worker dashboard."
            disabled={submitting}
            label="Back to dashboard"
            leadingIcon="back"
            onPress={handleBackToDashboard}
            style={styles.backAction}
            testID="join-shift-back"
            variant="ghost"
          />
          <View style={styles.headerCopy}>
            <Text allowFontScaling style={styles.eyebrow}>
              Worker
            </Text>
            <Text accessibilityRole="header" allowFontScaling style={styles.title}>
              Join shift
            </Text>
            <Text allowFontScaling style={styles.subtitle}>
              Enter the code shared by your foreman to join your next shift.
            </Text>
          </View>
        </View>

        <Card testID="join-shift-card">
          <View style={styles.form} testID="join-shift-form">
            <View style={styles.cardIntro} testID="join-shift-card-intro">
              <View style={styles.cardIcon}>
                <AppIcon name="code" size="tile" tone="brand" />
              </View>
              <View style={styles.cardCopy}>
                <Text allowFontScaling style={styles.cardTitle}>
                  Enter shift code
                </Text>
                <Text allowFontScaling style={styles.cardDescription}>
                  Codes are formatted in uppercase. Spaces around the code are removed.
                </Text>
              </View>
            </View>

            <FormField
              accessibilityHint="Enter the shift code shared by your foreman."
              allowFontScaling
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!submitting}
              error={joinCodeError}
              label="Join code"
              leadingIcon="code"
              onChangeText={handleJoinCodeChange}
              onSubmitEditing={handleSubmit}
              placeholder="ABCD12"
              returnKeyType="done"
              submitBehavior="submit"
              testID="join-shift-code-input"
              value={joinCode}
            />

            <View style={styles.eligibility} testID="join-shift-eligibility">
              <AppIcon name="info" tone="info" />
              <View style={styles.eligibilityCopy}>
                <Text allowFontScaling style={styles.eligibilityTitle}>
                  Open or active shifts
                </Text>
                <Text allowFontScaling style={styles.eligibilityMessage}>
                  The code must belong to an open or active shift at {company.name}.
                </Text>
              </View>
            </View>

            {successMessage ? (
              <Feedback
                message={successMessage}
                testID="join-shift-success"
                title="Shift joined"
                tone="success"
              />
            ) : null}
            {error ? (
              <Feedback
                message={error}
                testID="join-shift-error"
                title="Could not join shift"
                tone="error"
              />
            ) : null}

            <Button
              accessibilityHint="Joins the open or active shift using this code."
              disabled={submitting}
              label="Join shift"
              leadingIcon="join"
              loading={submitting}
              onPress={handleSubmit}
              testID="join-shift-submit"
            />
          </View>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    gap: theme.gap.section,
    maxWidth: "100%",
    width: "100%"
  },
  header: {
    flexShrink: 1,
    gap: theme.space[3],
    maxWidth: "100%",
    width: "100%"
  },
  headerCopy: {
    flexShrink: 1,
    gap: theme.space[2],
    maxWidth: "100%"
  },
  backAction: {
    alignSelf: "flex-start"
  },
  eyebrow: {
    ...theme.typography.label,
    color: theme.colors.brand.primary,
    flexShrink: 1
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  cardIntro: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexShrink: 1,
    gap: theme.space[3],
    maxWidth: "100%"
  },
  cardIcon: {
    alignItems: "center",
    backgroundColor: theme.colors.brand.tint,
    borderRadius: theme.radius.md,
    justifyContent: "center",
    padding: theme.space[2]
  },
  cardCopy: {
    flex: 1,
    flexShrink: 1,
    gap: theme.space[1],
    minWidth: 0
  },
  cardTitle: {
    ...theme.typography.sectionTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  cardDescription: {
    ...theme.typography.supporting,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  eligibility: {
    alignItems: "flex-start",
    backgroundColor: theme.colors.info.bg,
    borderColor: theme.colors.info.fg,
    borderRadius: theme.radius.md,
    borderWidth: theme.border.default,
    flexDirection: "row",
    flexShrink: 1,
    gap: theme.space[2],
    maxWidth: "100%",
    padding: theme.space[3]
  },
  eligibilityCopy: {
    flex: 1,
    flexShrink: 1,
    gap: theme.space[1],
    minWidth: 0
  },
  eligibilityTitle: {
    ...theme.typography.label,
    color: theme.colors.info.fg,
    flexShrink: 1
  },
  eligibilityMessage: {
    ...theme.typography.supporting,
    color: theme.colors.info.fg,
    flexShrink: 1
  },
  form: {
    flexShrink: 1,
    gap: theme.space[4],
    maxWidth: "100%"
  }
});
