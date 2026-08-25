import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getErrorMessage } from "../api/errors";
import { createShift } from "../api/shifts";
import { Button } from "../components/Button";
import { FormField } from "../components/FormField";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { useAuth } from "../context/AuthContext";
import { useForemanManagedShifts } from "../hooks/useForemanManagedShifts";
import type { ForemanStackParamList } from "../types/navigation";
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

function parseNumber(value: string): number | null {
  const normalized = value.trim().replace(",", ".");

  if (normalized.length === 0) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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
  const [errors, setErrors] = useState<CreateShiftErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): {
    valid: boolean;
    breakMinutes?: number;
    defaultRate: number;
    foremanRate: number;
  } => {
    const nextErrors: CreateShiftErrors = {};
    const trimmedBreakMinutes = defaultBreakMinutes.trim();
    const breakMinutes =
      trimmedBreakMinutes.length === 0 ? undefined : parseInteger(defaultBreakMinutes);
    const defaultRate = parseNumber(defaultHourlyRate);
    const foremanRate = parseNumber(foremanHourlyRate);

    if (breakMinutes === null || (breakMinutes !== undefined && breakMinutes < 0)) {
      nextErrors.defaultBreakMinutes = "Enter a whole number 0 or greater.";
    }

    if (defaultRate === null || defaultRate < 0) {
      nextErrors.defaultHourlyRate = "Enter a rate 0 or greater.";
    } else if (!/^\d+([.,]\d{1,2})?$/.test(defaultHourlyRate.trim())) {
      nextErrors.defaultHourlyRate = "Use up to two decimal places.";
    }

    if (foremanRate === null || foremanRate < 0) {
      nextErrors.foremanHourlyRate = "Enter a rate 0 or greater.";
    } else if (!/^\d+([.,]\d{1,2})?$/.test(foremanHourlyRate.trim())) {
      nextErrors.foremanHourlyRate = "Use up to two decimal places.";
    }

    setErrors(nextErrors);

    return {
      valid: Object.keys(nextErrors).length === 0,
      breakMinutes: breakMinutes ?? undefined,
      defaultRate: defaultRate ?? 0,
      foremanRate: foremanRate ?? 0
    };
  };

  const handleSubmit = () => {
    if (!user?.company) {
      setError("Create your company before creating shifts.");
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
      defaultHourlyRate: result.defaultRate,
      foremanHourlyRate: result.foremanRate
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
            label="Default hourly rate"
            onChangeText={setDefaultHourlyRate}
            placeholder="15.00"
            value={defaultHourlyRate}
          />
          <FormField
            error={errors.foremanHourlyRate}
            inputMode="decimal"
            keyboardType="decimal-pad"
            label="Foreman hourly rate"
            onChangeText={setForemanHourlyRate}
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
