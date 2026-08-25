import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { joinCompany } from "../api/companies";
import { getErrorMessage } from "../api/errors";
import { Button } from "../components/Button";
import { FormField } from "../components/FormField";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, typography } from "../utils/theme";
import { isBlank } from "../utils/validation";

export function JoinCompanyScreen() {
  const { applyCompany, authenticatedRequest, refreshCurrentUser, signOut } = useAuth();
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
    if (isBlank(normalizedJoinCode)) {
      setJoinCodeError("Enter a company join code.");
      return;
    }

    setSubmitting(true);
    setJoinCodeError(undefined);
    setError(null);
    setSuccessMessage(null);

    void authenticatedRequest((token) =>
      joinCompany(token, {
        joinCode: normalizedJoinCode
      })
    )
      .then((company) => {
        setSuccessMessage(`Joined ${company.name}.`);
        setSubmitting(false);
        return applyCompany(company).then(() =>
          refreshCurrentUser().catch((refreshError) => {
            console.warn("Failed to refresh user after company join.", refreshError);
          })
        );
      })
      .catch((caughtError) => {
        setError(getErrorMessage(caughtError));
        setSubmitting(false);
      });
  };

  const handleLogout = () => {
    void signOut();
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Worker setup</Text>
          <Text style={styles.title}>Join company</Text>
          <Text style={styles.subtitle}>
            Enter the company join code shared by your foreman.
          </Text>
        </View>

        {successMessage ? (
          <StateMessage title="Company joined" message={successMessage} tone="success" />
        ) : null}
        {error ? (
          <StateMessage title="Could not join company" message={error} tone="error" />
        ) : null}

        <View style={styles.form}>
          <FormField
            autoCapitalize="characters"
            autoCorrect={false}
            error={joinCodeError}
            label="Company join code"
            onChangeText={handleJoinCodeChange}
            placeholder="CMP123"
            value={joinCode}
          />
          <Button label="Join company" loading={submitting} onPress={handleSubmit} />
          <Button label="Log out" onPress={handleLogout} variant="ghost" />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
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
