import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getMyCompany } from "../api/companies";
import { ApiError, getErrorMessage } from "../api/errors";
import { createShift } from "../api/shifts";
import { Button } from "../components/Button";
import { FormField } from "../components/FormField";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { useAuth } from "../context/AuthContext";
import { useForemanManagedShifts } from "../hooks/useForemanManagedShifts";
import type { ForemanStackParamList } from "../types/navigation";
import type { CompanySettingsResponse } from "../types/company";
import { colors, spacing, typography } from "../utils/theme";

type CreateShiftScreenProps = NativeStackScreenProps<
  ForemanStackParamList,
  "CreateShift"
>;

type CreateShiftErrors = {
  defaultBreakMinutes?: string;
  defaultHourlyRate?: string;
  foremanHourlyRate?: string;
};

type RateOverride =
  | { state: "empty" }
  | { state: "valid"; value: number }
  | { state: "invalid" };

function parseNumber(value: string): number | null {
  const normalized = value.trim().replace(",", ".");

  if (normalized.length === 0) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRateOverride(value: string): RateOverride {
  const normalized = value.trim().replace(",", ".");
  if (normalized.length === 0) return { state: "empty" };
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return { state: "invalid" };

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || /^\d{11,}/.test(normalized)) {
    return { state: "invalid" };
  }

  return { state: "valid", value: parsed };
}

function parseInteger(value: string): number | null {
  const parsed = parseNumber(value);

  if (parsed === null || !Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

export function CreateShiftScreen({ navigation }: CreateShiftScreenProps) {
  const { authenticatedRequest, user } = useAuth();
  const { refresh } = useForemanManagedShifts({ loadOnFocus: false });
  const [location, setLocation] = useState("");
  const [defaultBreakMinutes, setDefaultBreakMinutes] = useState("");
  const [defaultHourlyRate, setDefaultHourlyRate] = useState("");
  const [foremanHourlyRate, setForemanHourlyRate] = useState("");
  const [companySettings, setCompanySettings] = useState<CompanySettingsResponse | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [errors, setErrors] = useState<CreateShiftErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSequenceRef = useRef(0);
  const workerRateEditedRef = useRef(false);
  const foremanRateEditedRef = useRef(false);

  const loadSettings = useCallback(async () => {
    const sequence = ++loadSequenceRef.current;
    setSettingsLoading(true);
    try {
      const settings = await authenticatedRequest((token) => getMyCompany(token));
      if (sequence !== loadSequenceRef.current) return;
      if (settings.currencyLabel === null) {
        navigation.replace("ForemanCompanySettings", {
          notice: "Company currency label must be configured before creating a shift."
        });
        return;
      }
      setCompanySettings(settings);
      if (!workerRateEditedRef.current && settings.defaultWorkerHourlyRate !== null) {
        setDefaultHourlyRate(String(settings.defaultWorkerHourlyRate));
      }
      if (!foremanRateEditedRef.current && settings.defaultForemanHourlyRate !== null) {
        setForemanHourlyRate(String(settings.defaultForemanHourlyRate));
      }
    } catch (caughtError) {
      if (sequence === loadSequenceRef.current) setError(getErrorMessage(caughtError));
    } finally {
      if (sequence === loadSequenceRef.current) setSettingsLoading(false);
    }
  }, [authenticatedRequest, navigation]);

  useFocusEffect(
    useCallback(() => {
      void loadSettings();
      return () => {
        loadSequenceRef.current += 1;
      };
    }, [loadSettings])
  );

  const validate = (): {
    valid: boolean;
    breakMinutes?: number;
    defaultRate: number | null;
    foremanRate: number | null;
  } => {
    const nextErrors: CreateShiftErrors = {};
    const trimmedBreakMinutes = defaultBreakMinutes.trim();
    const breakMinutes =
      trimmedBreakMinutes.length === 0 ? undefined : parseInteger(defaultBreakMinutes);
    const defaultRate = parseRateOverride(defaultHourlyRate);
    const foremanRate = parseRateOverride(foremanHourlyRate);

    if (breakMinutes === null || (breakMinutes !== undefined && breakMinutes < 0)) {
      nextErrors.defaultBreakMinutes = "Enter a whole number 0 or greater.";
    }

    if (defaultRate.state === "invalid") {
      nextErrors.defaultHourlyRate = "Use a non-negative rate with up to two decimal places.";
    } else if (defaultRate.state === "empty" && companySettings?.defaultWorkerHourlyRate === null) {
      nextErrors.defaultHourlyRate = "Enter a worker rate or set a company default.";
    }

    if (foremanRate.state === "invalid") {
      nextErrors.foremanHourlyRate = "Use a non-negative rate with up to two decimal places.";
    } else if (foremanRate.state === "empty" && companySettings?.defaultForemanHourlyRate === null) {
      nextErrors.foremanHourlyRate = "Enter a foreman rate or set a company default.";
    }

    setErrors(nextErrors);

    return {
      valid: Object.keys(nextErrors).length === 0,
      breakMinutes: breakMinutes ?? undefined,
      defaultRate: defaultRate.state === "valid" ? defaultRate.value : null,
      foremanRate: foremanRate.state === "valid" ? foremanRate.value : null
    };
  };

  const handleSubmit = () => {
    if (!user?.company) {
      setError("Create your company before creating shifts.");
      return;
    }

    if (!companySettings) {
      setError("Company settings are still loading. Try again in a moment.");
      return;
    }

    const result = validate();

    if (!result.valid) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      location: location.trim(),
      ...(result.breakMinutes === undefined
        ? {}
        : { defaultBreakMinutes: result.breakMinutes }),
      ...(result.defaultRate === null ? {} : { defaultHourlyRate: result.defaultRate }),
      ...(result.foremanRate === null ? {} : { foremanHourlyRate: result.foremanRate })
    };

    void authenticatedRequest((token) =>
      createShift(token, payload)
    )
      .then((response) => {
        void refresh().catch(() => undefined);
        navigation.replace("ForemanShiftDetails", {
          shiftId: response.id
        });
      })
      .catch((caughtError) => {
        if (
          caughtError instanceof ApiError &&
          caughtError.status === 409 &&
          getErrorMessage(caughtError).includes("currency label must be configured")
        ) {
          navigation.replace("ForemanCompanySettings", { notice: getErrorMessage(caughtError) });
          return;
        }
        setError(getErrorMessage(caughtError));
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
            <Text style={styles.kicker}>Foreman</Text>
            <Text style={styles.title}>Create shift</Text>
            <Text style={styles.subtitle}>A company is required before shifts can be created.</Text>
          </View>

          <StateMessage
            title="Company required"
            message="Create your company first, then come back to create shifts."
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
          <Text style={styles.kicker}>Foreman</Text>
          <Text style={styles.title}>Create shift</Text>
          <Text style={styles.subtitle}>Set worker and foreman rates for this shift.</Text>
        </View>

        {settingsLoading ? <StateMessage loading title="Loading company settings" message="Fetching rate defaults." /> : null}
        {error ? <StateMessage title="Could not create shift" message={error} tone="error" /> : null}

        <View style={styles.form}>
          <FormField
            autoCapitalize="words"
            label="Location"
            onChangeText={setLocation}
            placeholder="Optional location"
            value={location}
          />
          <FormField
            error={errors.defaultBreakMinutes}
            inputMode="numeric"
            keyboardType="number-pad"
            label="Default break minutes"
            onChangeText={setDefaultBreakMinutes}
            placeholder="Backend default: 0"
            value={defaultBreakMinutes}
          />
          <FormField
            error={errors.defaultHourlyRate}
            inputMode="decimal"
            keyboardType="decimal-pad"
            label={`Default hourly rate (${companySettings?.currencyLabel ?? "currency unavailable"})`}
            onChangeText={(value) => {
              workerRateEditedRef.current = true;
              setDefaultHourlyRate(value);
            }}
            placeholder="15.00"
            value={defaultHourlyRate}
          />
          <FormField
            error={errors.foremanHourlyRate}
            inputMode="decimal"
            keyboardType="decimal-pad"
            label={`Foreman hourly rate (${companySettings?.currencyLabel ?? "currency unavailable"})`}
            onChangeText={(value) => {
              foremanRateEditedRef.current = true;
              setForemanHourlyRate(value);
            }}
            placeholder="25.00"
            value={foremanHourlyRate}
          />

          <Button label="Create shift" loading={submitting} onPress={handleSubmit} />
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
