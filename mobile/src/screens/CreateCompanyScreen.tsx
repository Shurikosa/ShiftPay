import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { createCompany } from "../api/companies";
import { getErrorMessage } from "../api/errors";
import { Button } from "../components/Button";
import { FormField } from "../components/FormField";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, typography } from "../utils/theme";
import { isBlank } from "../utils/validation";

export function CreateCompanyScreen() {
  const { applyCompany, authenticatedRequest, refreshCurrentUser, signOut } = useAuth();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleNameChange = (value: string) => {
    setName(value);
    setNameError(undefined);
    setError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = () => {
    const trimmedName = name.trim();

    if (isBlank(trimmedName)) {
      setNameError("Enter a company name.");
      return;
    }

    setSubmitting(true);
    setNameError(undefined);
    setError(null);
    setSuccessMessage(null);

    void authenticatedRequest((token) =>
      createCompany(token, {
        name: trimmedName
      })
    )
      .then((company) => {
        setSuccessMessage(`Company created. Worker join code: ${company.joinCode}.`);
        setSubmitting(false);
        return applyCompany(company).then(() =>
          refreshCurrentUser().catch((refreshError) => {
            console.warn("Failed to refresh user after company creation.", refreshError);
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
          <Text style={styles.kicker}>Foreman setup</Text>
          <Text style={styles.title}>Create company</Text>
          <Text style={styles.subtitle}>
            Create your company before opening shifts for workers.
          </Text>
        </View>

        {successMessage ? (
          <StateMessage title="Company ready" message={successMessage} tone="success" />
        ) : null}
        {error ? (
          <StateMessage title="Could not create company" message={error} tone="error" />
        ) : null}

        <View style={styles.form}>
          <FormField
            autoCapitalize="words"
            error={nameError}
            label="Company name"
            onChangeText={handleNameChange}
            placeholder="Acme Construction"
            value={name}
          />
          <Button label="Create company" loading={submitting} onPress={handleSubmit} />
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
