import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  View,
  type KeyboardEvent
} from "react-native";
import { createCompany } from "../api/companies";
import { getErrorMessage } from "../api/errors";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Feedback } from "../components/Feedback";
import { FormField } from "../components/FormField";
import { Screen } from "../components/Screen";
import { useAuth } from "../context/AuthContext";
import {
  getCompanySettingsFieldError,
  parseOptionalRate,
  trimCurrencyLabelBoundaries,
  validateCurrencyLabel
} from "../utils/companySettings";
import { theme } from "../utils/theme";
import { isBlank } from "../utils/validation";

function getPositiveFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function getKeyboardBottomInset(event: KeyboardEvent): number {
  return getPositiveFiniteNumber(event?.endCoordinates?.height) ?? 0;
}

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
  const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);
  const mountedRef = useRef(true);
  const submitInFlight = useRef(false);
  const keyboardScrollInset =
    Platform.OS === "android" && keyboardBottomInset > 0
      ? { paddingBottom: keyboardBottomInset }
      : undefined;

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    const showSubscription =
      Platform.OS === "android"
        ? Keyboard.addListener("keyboardDidShow", (event) => {
            if (active) {
              const nextKeyboardHeight = getKeyboardBottomInset(event);
              setKeyboardBottomInset(nextKeyboardHeight);
            }
          })
        : undefined;
    const hideSubscription =
      Platform.OS === "android"
        ? Keyboard.addListener("keyboardDidHide", () => {
            if (active) {
              setKeyboardBottomInset(0);
            }
          })
        : undefined;

    return () => {
      active = false;
      mountedRef.current = false;
      showSubscription?.remove();
      hideSubscription?.remove();
    };
  }, []);

  const clearFormFeedback = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const handleNameChange = (value: string) => {
    setName(value);
    setNameError(undefined);
    clearFormFeedback();
  };

  const handleCurrencyLabelChange = (value: string) => {
    setCurrencyLabel(value);
    setCurrencyLabelError(undefined);
    clearFormFeedback();
  };

  const handleWorkerRateChange = (value: string) => {
    setDefaultWorkerHourlyRate(value);
    setDefaultWorkerHourlyRateError(undefined);
    clearFormFeedback();
  };

  const handleForemanRateChange = (value: string) => {
    setDefaultForemanHourlyRate(value);
    setDefaultForemanHourlyRateError(undefined);
    clearFormFeedback();
  };

  const handleSubmit = () => {
    if (submitInFlight.current) {
      return;
    }

    const trimmedName = name.trim();
    const normalizedCurrencyLabel = trimCurrencyLabelBoundaries(currencyLabel);
    const currencyValidationError = validateCurrencyLabel(currencyLabel);
    const workerRate = parseOptionalRate(defaultWorkerHourlyRate);
    const foremanRate = parseOptionalRate(defaultForemanHourlyRate);
    let valid = true;

    if (isBlank(trimmedName)) {
      setNameError("Enter a company name.");
      valid = false;
    } else {
      setNameError(undefined);
    }

    setCurrencyLabelError(currencyValidationError);
    if (currencyValidationError) {
      valid = false;
    }

    const workerRateError =
      workerRate === undefined
        ? "Use a non-negative rate with up to two decimal places."
        : undefined;
    setDefaultWorkerHourlyRateError(workerRateError);
    if (workerRateError) {
      valid = false;
    }

    const foremanRateError =
      foremanRate === undefined
        ? "Use a non-negative rate with up to two decimal places."
        : undefined;
    setDefaultForemanHourlyRateError(foremanRateError);
    if (foremanRateError) {
      valid = false;
    }

    if (!valid) {
      return;
    }

    submitInFlight.current = true;
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    void Promise.resolve()
      .then(() =>
        authenticatedRequest((token) =>
          createCompany(token, {
            name: trimmedName,
            currencyLabel: normalizedCurrencyLabel,
            defaultWorkerHourlyRate: workerRate ?? undefined,
            defaultForemanHourlyRate: foremanRate ?? undefined
          })
        )
      )
      .then(async (company) => {
        if (!mountedRef.current) {
          return;
        }

        setSuccessMessage(`Company created. Worker join code: ${company.joinCode}.`);
        await applyCompany(company);

        try {
          await refreshCurrentUser();
        } catch (refreshError) {
          console.warn("Failed to refresh user after company creation.", refreshError);
        }
      })
      .catch((caughtError) => {
        if (!mountedRef.current) {
          return;
        }

        const fieldError = getCompanySettingsFieldError(getErrorMessage(caughtError));
        if (fieldError.field === "name") {
          setNameError(fieldError.message);
        } else if (fieldError.field === "currencyLabel") {
          setCurrencyLabelError(fieldError.message);
        } else if (fieldError.field === "defaultWorkerHourlyRate") {
          setDefaultWorkerHourlyRateError(fieldError.message);
        } else if (fieldError.field === "defaultForemanHourlyRate") {
          setDefaultForemanHourlyRateError(fieldError.message);
        } else {
          setError(fieldError.message);
        }
        setSuccessMessage(null);
      })
      .finally(() => {
        submitInFlight.current = false;
        if (mountedRef.current) {
          setSubmitting(false);
        }
      });
  };

  const handleLogout = () => {
    if (submitInFlight.current) {
      return;
    }

    void signOut();
  };

  return (
    <Screen scroll scrollContentStyle={keyboardScrollInset}>
      <View style={styles.page} testID="create-company-content">
        <View style={styles.header} testID="create-company-header">
          <Text allowFontScaling style={styles.brand}>
            ShiftPay
          </Text>
          <Text allowFontScaling style={styles.eyebrow}>
            Foreman setup
          </Text>
          <Text accessibilityRole="header" allowFontScaling style={styles.title}>
            Create company
          </Text>
          <Text allowFontScaling style={styles.supporting}>
            Create your company before opening shifts for workers.
          </Text>
        </View>

        <Card testID="create-company-card">
          <View style={styles.form} testID="create-company-form">
            <View style={styles.fieldGroup} testID="create-company-details-group">
              <Text allowFontScaling style={styles.groupTitle}>
                Company details
              </Text>
              <FormField
                accessibilityHint="Enter the company name workers will recognize."
                allowFontScaling
                autoCapitalize="words"
                editable={!submitting}
                error={nameError}
                label="Company name"
                leadingIcon="company"
                onChangeText={handleNameChange}
                placeholder="Acme Construction"
                testID="company-name-input"
                value={name}
              />
              <FormField
                accessibilityHint="Enter the display text shown beside monetary amounts."
                allowFontScaling
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
                error={currencyLabelError}
                hint="Free-form display text, not an ISO-only currency. ShiftPay does not convert money."
                label="Currency label"
                leadingIcon="wallet"
                onChangeText={handleCurrencyLabelChange}
                placeholder="EUR, €, долар, грн, 元"
                testID="currency-label-input"
                value={currencyLabel}
              />
            </View>

            <View style={styles.fieldGroup} testID="create-company-rates-group">
              <Text allowFontScaling style={styles.groupTitle}>
                Default rates
              </Text>
              <Text allowFontScaling style={styles.groupSupporting}>
                Both rates are optional and can be configured later. Without defaults, each new
                shift needs explicit worker and foreman rates.
              </Text>
              <FormField
                accessibilityHint="Optionally enter the default worker rate for future shifts."
                allowFontScaling
                editable={!submitting}
                error={defaultWorkerHourlyRateError}
                inputMode="decimal"
                keyboardType="decimal-pad"
                label="Default worker hourly rate"
                leadingIcon="person"
                onChangeText={handleWorkerRateChange}
                placeholder="Optional"
                testID="default-worker-rate-input"
                value={defaultWorkerHourlyRate}
              />
              <FormField
                accessibilityHint="Optionally enter the default foreman rate for future shifts."
                allowFontScaling
                editable={!submitting}
                error={defaultForemanHourlyRateError}
                inputMode="decimal"
                keyboardType="decimal-pad"
                label="Default foreman hourly rate"
                leadingIcon="role"
                onChangeText={handleForemanRateChange}
                onSubmitEditing={handleSubmit}
                placeholder="Optional"
                returnKeyType="done"
                submitBehavior="submit"
                testID="default-foreman-rate-input"
                value={defaultForemanHourlyRate}
              />
            </View>

            {successMessage ? (
              <Feedback
                message={successMessage}
                testID="create-company-success"
                title="Company ready"
                tone="success"
              />
            ) : null}
            {error ? (
              <Feedback
                message={error}
                testID="create-company-error"
                title="Could not create company"
                tone="error"
              />
            ) : null}

            <Button
              accessibilityHint="Creates this company with the entered settings."
              disabled={submitting}
              label="Create company"
              leadingIcon="create"
              loading={submitting}
              onPress={handleSubmit}
              testID="create-company-submit"
            />
          </View>
        </Card>

        <View style={styles.recovery} testID="create-company-recovery">
          <Button
            accessibilityHint="Signs out of this account and returns to the sign-in flow."
            disabled={submitting}
            label="Log out"
            leadingIcon="logout"
            onPress={handleLogout}
            testID="create-company-logout"
            variant="ghost"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    justifyContent: "center",
    gap: theme.gap.section,
    maxWidth: "100%",
    width: "100%"
  },
  header: {
    flexShrink: 1,
    gap: theme.space[2],
    maxWidth: "100%"
  },
  brand: {
    ...theme.typography.screenTitle,
    color: theme.colors.brand.primary,
    flexShrink: 1
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
  supporting: {
    ...theme.typography.body,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  form: {
    flexShrink: 1,
    gap: theme.space[6],
    maxWidth: "100%"
  },
  fieldGroup: {
    flexShrink: 1,
    gap: theme.space[3],
    maxWidth: "100%"
  },
  groupTitle: {
    ...theme.typography.sectionTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  groupSupporting: {
    ...theme.typography.supporting,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  recovery: {
    alignSelf: "stretch",
    flexShrink: 1,
    maxWidth: "100%"
  }
});
