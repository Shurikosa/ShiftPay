import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ApiError, getErrorMessage } from "../api/errors";
import { joinShiftByCode } from "../api/shifts";
import { Button } from "../components/Button";
import { FormField } from "../components/FormField";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { useAuth } from "../context/AuthContext";
import { useWorkerShiftHistory } from "../hooks/useWorkerShiftHistory";
import type { WorkerStackParamList } from "../types/navigation";
import { colors, spacing, typography } from "../utils/theme";
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
  const { refresh } = useWorkerShiftHistory({ loadOnFocus: false });
  const [joinCode, setJoinCode] = useState("");
  const [joinCodeError, setJoinCodeError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const normalizedJoinCode = joinCode.trim().toUpperCase();

  const handleJoinCodeChange = (value: string) => {
    setJoinCode(value.toUpperCase());
    setJoinCodeError(undefined);
    setError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = () => {
    if (!user?.company) {
      setError("Join your company before joining shifts.");
      return;
    }

    if (isBlank(normalizedJoinCode)) {
      setJoinCodeError("Enter a join code.");
      return;
    }

    setSubmitting(true);
    setJoinCodeError(undefined);
    setError(null);
    setSuccessMessage(null);

    void authenticatedRequest((token) =>
      joinShiftByCode(token, {
        joinCode: normalizedJoinCode
      })
    )
      .then((response) => {
        setSuccessMessage(`Joined shift ${response.shiftId}. Waiting for foreman approval.`);
        setJoinCode("");
        void refresh().catch(() => undefined);
        navigation.replace("WorkerDashboard");
      })
      .catch((caughtError) => {
        setError(getJoinShiftErrorMessage(caughtError));
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  if (!user?.company) {
    return (
      <Screen>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.kicker}>Worker</Text>
            <Text style={styles.title}>Join shift</Text>
            <Text style={styles.subtitle}>A company is required before shifts can be joined.</Text>
          </View>

          <StateMessage
            title="Company required"
            message="Join your company first, then enter the shift join code from your foreman."
            tone="error"
          />

          <Button
            label="Back to dashboard"
            onPress={() => {
              navigation.goBack();
            }}
            variant="ghost"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Worker</Text>
          <Text style={styles.title}>Join shift</Text>
          <Text style={styles.subtitle}>
            Enter the code shared by your foreman for an open or active shift.
          </Text>
        </View>

        {successMessage ? (
          <StateMessage title="Shift joined" message={successMessage} tone="success" />
        ) : null}
        {error ? <StateMessage title="Could not join shift" message={error} tone="error" /> : null}

        <View style={styles.form}>
          <FormField
            autoCapitalize="characters"
            autoCorrect={false}
            error={joinCodeError}
            label="Join code"
            onChangeText={handleJoinCodeChange}
            placeholder="ABCD12"
            value={joinCode}
          />
          <Button label="Join shift" loading={submitting} onPress={handleSubmit} />
          <Button
            label="Back to dashboard"
            onPress={() => {
              navigation.goBack();
            }}
            variant="ghost"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.xl
  },
  header: {
    gap: spacing.sm
  },
  kicker: {
    ...typography.label,
    color: colors.primary
  },
  title: {
    ...typography.screenTitle,
    color: colors.text
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary
  },
  form: {
    gap: spacing.md
  }
});
