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
import { isBlank } from "../utils/validation";

type CreateShiftScreenProps = NativeStackScreenProps<
  ForemanStackParamList,
  "CreateShift"
>;

type CreateShiftErrors = {
  title?: string;
  location?: string;
  plannedStartTime?: string;
  plannedEndTime?: string;
  defaultBreakMinutes?: string;
  defaultHourlyRate?: string;
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
  const { authenticatedRequest } = useAuth();
  const { refresh } = useForemanManagedShifts({ loadOnFocus: false });
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [plannedStartTime, setPlannedStartTime] = useState("");
  const [plannedEndTime, setPlannedEndTime] = useState("");
  const [defaultBreakMinutes, setDefaultBreakMinutes] = useState("60");
  const [defaultHourlyRate, setDefaultHourlyRate] = useState("");
  const [errors, setErrors] = useState<CreateShiftErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): {
    valid: boolean;
    breakMinutes: number;
    hourlyRate: number;
  } => {
    const nextErrors: CreateShiftErrors = {};
    const start = new Date(plannedStartTime);
    const end = new Date(plannedEndTime);
    const breakMinutes = parseInteger(defaultBreakMinutes);
    const hourlyRate = parseNumber(defaultHourlyRate);

    if (isBlank(title)) {
      nextErrors.title = "Enter a shift title.";
    }

    if (isBlank(location)) {
      nextErrors.location = "Enter a location.";
    }

    if (isBlank(plannedStartTime) || Number.isNaN(start.getTime())) {
      nextErrors.plannedStartTime = "Use a valid date and time.";
    }

    if (isBlank(plannedEndTime) || Number.isNaN(end.getTime())) {
      nextErrors.plannedEndTime = "Use a valid date and time.";
    }

    if (!nextErrors.plannedStartTime && !nextErrors.plannedEndTime && end <= start) {
      nextErrors.plannedEndTime = "End time must be after start time.";
    }

    if (breakMinutes === null || breakMinutes < 0) {
      nextErrors.defaultBreakMinutes = "Enter a whole number 0 or greater.";
    }

    if (hourlyRate === null || hourlyRate < 0) {
      nextErrors.defaultHourlyRate = "Enter a rate 0 or greater.";
    } else if (!/^\d+([.,]\d{1,2})?$/.test(defaultHourlyRate.trim())) {
      nextErrors.defaultHourlyRate = "Use up to two decimal places.";
    }

    setErrors(nextErrors);

    return {
      valid: Object.keys(nextErrors).length === 0,
      breakMinutes: breakMinutes ?? 0,
      hourlyRate: hourlyRate ?? 0
    };
  };

  const handleSubmit = () => {
    const result = validate();

    if (!result.valid) {
      return;
    }

    setSubmitting(true);
    setError(null);

    void authenticatedRequest((token) =>
      createShift(token, {
        title: title.trim(),
        location: location.trim(),
        plannedStartTime: plannedStartTime.trim(),
        plannedEndTime: plannedEndTime.trim(),
        defaultBreakMinutes: result.breakMinutes,
        defaultHourlyRate: result.hourlyRate
      })
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

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Foreman</Text>
          <Text style={styles.title}>Create shift</Text>
          <Text style={styles.subtitle}>Set the plan workers will join by code.</Text>
        </View>

        {error ? <StateMessage title="Could not create shift" message={error} tone="error" /> : null}

        <View style={styles.form}>
          <FormField
            autoCapitalize="sentences"
            error={errors.title}
            label="Title"
            onChangeText={setTitle}
            placeholder="Monday construction shift"
            value={title}
          />
          <FormField
            autoCapitalize="words"
            error={errors.location}
            label="Location"
            onChangeText={setLocation}
            placeholder="Cologne"
            value={location}
          />
          <FormField
            error={errors.plannedStartTime}
            label="Planned start"
            onChangeText={setPlannedStartTime}
            placeholder="2026-07-01T08:00:00"
            value={plannedStartTime}
          />
          <FormField
            error={errors.plannedEndTime}
            label="Planned end"
            onChangeText={setPlannedEndTime}
            placeholder="2026-07-01T17:00:00"
            value={plannedEndTime}
          />
          <FormField
            error={errors.defaultBreakMinutes}
            inputMode="numeric"
            keyboardType="number-pad"
            label="Default break minutes"
            onChangeText={setDefaultBreakMinutes}
            placeholder="60"
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
