import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { createCompany } from "../api/companies";
import { getErrorMessage } from "../api/errors";
import { Button } from "../components/Button";
import { FormField } from "../components/FormField";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { useAuth } from "../context/AuthContext";
import {
  getCompanySettingsFieldError,
  parseOptionalRate,
  trimCurrencyLabelBoundaries,
  validateCurrencyLabel
} from "../utils/companySettings";
import { colors, spacing, typography } from "../utils/theme";
import { isBlank } from "../utils/validation";

export function CreateCompanyScreen() {
  const { applyCompany, authenticatedRequest, refreshCurrentUser, signOut } = useAuth();
  const [name, setName] = useState("");
  const [currencyLabel, setCurrencyLabel] = useState("");
  const [defaultWorkerHourlyRate, setDefaultWorkerHourlyRate] = useState("");
  const [defaultForemanHourlyRate, setDefaultForemanHourlyRate] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [currencyLabelError, setCurrencyLabelError] = useState<string | undefined>();
  const [defaultWorkerHourlyRateError, setDefaultWorkerHourlyRateError] = useState<string | undefined>();
  const [defaultForemanHourlyRateError, setDefaultForemanHourlyRateError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleNameChange = (value: string) => {
    setName(value);
    setNameError(undefined);
    setError(null);
    setSuccessMessage(null);
  };

  const clearFormFeedback = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = () => {
    const trimmedName = name.trim();
    const normalizedCurrencyLabel = trimCurrencyLabelBoundaries(currencyLabel);
    const currencyValidationError = validateCurrencyLabel(currencyLabel);
    const workerRate = parseOptionalRate(defaultWorkerHourlyRate);
    const foremanRate = parseOptionalRate(defaultForemanHourlyRate);
    let valid = true;

    if (isBlank(trimmedName)) {
      setNameError("Enter a company name.");
      valid = false;
    }

    setCurrencyLabelError(currencyValidationError);
    if (currencyValidationError) valid = false;
    setDefaultWorkerHourlyRateError(
      workerRate === undefined ? "Use a non-negative rate with up to two decimal places." : undefined
    );
    if (workerRate === undefined) valid = false;
    setDefaultForemanHourlyRateError(
      foremanRate === undefined ? "Use a non-negative rate with up to two decimal places." : undefined
    );
    if (foremanRate === undefined) valid = false;

    if (!valid) return;

    setSubmitting(true);
    setNameError(undefined);
    setError(null);
    setSuccessMessage(null);

    void authenticatedRequest((token) =>
      createCompany(token, {
        name: trimmedName,
        currencyLabel: normalizedCurrencyLabel,
        defaultWorkerHourlyRate: workerRate ?? undefined,
        defaultForemanHourlyRate: foremanRate ?? undefined
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
        const fieldError = getCompanySettingsFieldError(getErrorMessage(caughtError));
        if (fieldError.field === "name") setNameError(fieldError.message);
        if (fieldError.field === "currencyLabel") setCurrencyLabelError(fieldError.message);
        if (fieldError.field === "defaultWorkerHourlyRate") {
          setDefaultWorkerHourlyRateError(fieldError.message);
        }
        if (fieldError.field === "defaultForemanHourlyRate") {
          setDefaultForemanHourlyRateError(fieldError.message);
        }
        if (!fieldError.field) setError(fieldError.message);
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
          <FormField
            error={currencyLabelError}
            label="Currency label"
            onChangeText={(value) => {
              setCurrencyLabel(value);
              setCurrencyLabelError(undefined);
              clearFormFeedback();
            }}
            placeholder="EUR, €, долар, грн, 元"
            value={currencyLabel}
          />
          <Text style={styles.helpText}>
            Free-form display text only. ShiftPay does not convert money or require an ISO code.
          </Text>
          <FormField
            error={defaultWorkerHourlyRateError}
            inputMode="decimal"
            keyboardType="decimal-pad"
            label="Default worker hourly rate"
            onChangeText={(value) => {
              setDefaultWorkerHourlyRate(value);
              setDefaultWorkerHourlyRateError(undefined);
              clearFormFeedback();
            }}
            placeholder="Optional"
            value={defaultWorkerHourlyRate}
          />
          <FormField
            error={defaultForemanHourlyRateError}
            inputMode="decimal"
            keyboardType="decimal-pad"
            label="Default foreman hourly rate"
            onChangeText={(value) => {
              setDefaultForemanHourlyRate(value);
              setDefaultForemanHourlyRateError(undefined);
              clearFormFeedback();
            }}
            placeholder="Optional"
            value={defaultForemanHourlyRate}
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
  },
  helpText: {
    ...typography.caption,
    color: colors.textSecondary
  }
});
