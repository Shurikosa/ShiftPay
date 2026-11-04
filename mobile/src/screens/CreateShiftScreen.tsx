import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getMyCompany } from "../api/companies";
import { ApiError, getErrorMessage } from "../api/errors";
import { createShift } from "../api/shifts";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Feedback } from "../components/Feedback";
import { FormField } from "../components/FormField";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { useAuth } from "../context/AuthContext";
import { useForemanManagedShifts } from "../hooks/useForemanManagedShifts";
import type { CompanySettingsResponse } from "../types/company";
import type { ForemanStackParamList } from "../types/navigation";
import { theme } from "../utils/theme";

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
  if (normalized.length === 0) return null;

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
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function formatCompanyDefault(value: number | null, currencyLabel: string): string {
  return value === null ? "No company default" : `${String(value)} ${currencyLabel}`;
}

export function CreateShiftScreen({ navigation }: CreateShiftScreenProps) {
  const { authenticatedRequest, user } = useAuth();
  const { refresh } = useForemanManagedShifts({ loadOnFocus: false });
  const isForeman = user?.role === "FOREMAN";
  const company = isForeman ? user.company : null;
  const canAccess = isForeman && company !== null;
  const [location, setLocation] = useState("");
  const [defaultBreakMinutes, setDefaultBreakMinutes] = useState("");
  const [defaultHourlyRate, setDefaultHourlyRate] = useState("");
  const [foremanHourlyRate, setForemanHourlyRate] = useState("");
  const [companySettings, setCompanySettings] = useState<CompanySettingsResponse | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(canAccess);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [errors, setErrors] = useState<CreateShiftErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const loadSequenceRef = useRef(0);
  const submitSequenceRef = useRef(0);
  const submitInFlightRef = useRef(false);
  const settingsReadyRef = useRef(false);
  const workerRateEditedRef = useRef(false);
  const foremanRateEditedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadSequenceRef.current += 1;
      submitSequenceRef.current += 1;
      submitInFlightRef.current = false;
      settingsReadyRef.current = false;
    };
  }, []);

  const loadSettings = useCallback(async () => {
    if (!canAccess) return;

    const sequence = ++loadSequenceRef.current;
    settingsReadyRef.current = false;
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const settings = await authenticatedRequest((token) => getMyCompany(token));
      if (!mountedRef.current || sequence !== loadSequenceRef.current) return;
      if (settings.currencyLabel === null) {
        setCompanySettings(null);
        navigation.replace("ForemanCompanySettings", {
          notice: "Company currency label must be configured before creating a shift."
        });
        return;
      }

      settingsReadyRef.current = true;
      setCompanySettings(settings);
      if (!workerRateEditedRef.current) {
        setDefaultHourlyRate(
          settings.defaultWorkerHourlyRate === null
            ? ""
            : String(settings.defaultWorkerHourlyRate)
        );
      }
      if (!foremanRateEditedRef.current) {
        setForemanHourlyRate(
          settings.defaultForemanHourlyRate === null
            ? ""
            : String(settings.defaultForemanHourlyRate)
        );
      }
    } catch (caughtError) {
      if (mountedRef.current && sequence === loadSequenceRef.current) {
        setSettingsError(getErrorMessage(caughtError));
      }
    } finally {
      if (mountedRef.current && sequence === loadSequenceRef.current) {
        setSettingsLoading(false);
      }
    }
  }, [authenticatedRequest, canAccess, navigation]);

  useFocusEffect(
    useCallback(() => {
      if (canAccess) void loadSettings();
      return () => {
        loadSequenceRef.current += 1;
        settingsReadyRef.current = false;
      };
    }, [canAccess, loadSettings])
  );

  const clearSubmitFeedback = () => {
    setSubmitError(null);
    setSuccessMessage(null);
  };

  const validate = (): {
    valid: boolean;
    breakMinutes?: number;
    defaultRate: number | null;
    foremanRate: number | null;
  } => {
    const nextErrors: CreateShiftErrors = {};
    const trimmedBreakMinutes = defaultBreakMinutes.trim();
    const breakMinutes = trimmedBreakMinutes.length === 0 ? undefined : parseInteger(defaultBreakMinutes);
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
    if (submitInFlightRef.current) return;

    if (!canAccess) {
      setSubmitError(isForeman ? "Create your company before creating shifts." : "Only a foreman can create shifts.");
      return;
    }
    if (!settingsReadyRef.current || settingsLoading || !companySettings) {
      setSubmitError("Company settings must load before a shift can be created.");
      return;
    }

    const result = validate();
    if (!result.valid) return;

    const sequence = ++submitSequenceRef.current;
    submitInFlightRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    const payload = {
      location: location.trim(),
      ...(result.breakMinutes === undefined ? {} : { defaultBreakMinutes: result.breakMinutes }),
      ...(result.defaultRate === null ? {} : { defaultHourlyRate: result.defaultRate }),
      ...(result.foremanRate === null ? {} : { foremanHourlyRate: result.foremanRate })
    };

    void Promise.resolve()
      .then(() => authenticatedRequest((token) => createShift(token, payload)))
      .then((response) => {
        if (!mountedRef.current || sequence !== submitSequenceRef.current) return;
        setSuccessMessage("Shift created. Opening shift details.");
        void refresh().catch(() => undefined);
        navigation.replace("ForemanShiftDetails", { shiftId: response.id });
      })
      .catch((caughtError) => {
        if (!mountedRef.current || sequence !== submitSequenceRef.current) return;
        const message = getErrorMessage(caughtError);
        if (caughtError instanceof ApiError && caughtError.status === 409 && message.includes("currency label must be configured")) {
          navigation.replace("ForemanCompanySettings", { notice: message });
          return;
        }
        setSubmitError(message);
      })
      .finally(() => {
        if (sequence === submitSequenceRef.current) {
          submitInFlightRef.current = false;
          if (mountedRef.current) setSubmitting(false);
        }
      });
  };

  const handleWorkerRateChange = (value: string) => {
    workerRateEditedRef.current = true;
    setDefaultHourlyRate(value);
    setErrors((current) => ({ ...current, defaultHourlyRate: undefined }));
    clearSubmitFeedback();
  };

  const handleForemanRateChange = (value: string) => {
    foremanRateEditedRef.current = true;
    setForemanHourlyRate(value);
    setErrors((current) => ({ ...current, foremanHourlyRate: undefined }));
    clearSubmitFeedback();
  };

  if (!canAccess) {
    const title = isForeman ? "Company required" : "Foreman access required";
    const message = isForeman ? "Create your company before creating shifts." : "Only a foreman with a company can create shifts.";
    return (
      <Screen>
        <View style={styles.page} testID="create-shift-gate">
          <ScreenHeader backAction={{ label: "Back", onPress: navigation.goBack }} eyebrow="Foreman" subtitle="Set the shift details and rate overrides." title="Create shift" />
          <Feedback message={message} mode="screen" title={title} tone="error" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll scrollProps={{ accessibilityLabel: "Create shift form", keyboardDismissMode: "on-drag", testID: "create-shift-scroll" }}>
      <View style={styles.page} testID="create-shift-content">
        <ScreenHeader
          backAction={{ disabled: submitting, label: "Back", onPress: navigation.goBack }}
          eyebrow="Foreman"
          subtitle="Use company defaults or enter shift-specific rate overrides."
          title="Create shift"
        />

        {settingsLoading ? (
          <Feedback loading message="Fetching the company rate defaults required by this form." mode="screen" testID="create-shift-settings-loading" title="Loading company settings" />
        ) : settingsError || !companySettings || companySettings.currencyLabel === null ? (
          <Feedback
            action={{ accessibilityHint: "Reloads company settings before showing the form.", label: "Retry", onPress: () => { void loadSettings(); }, testID: "create-shift-settings-retry" }}
            message={settingsError ?? "Company settings are unavailable."}
            mode="screen"
            testID="create-shift-settings-error"
            title="Could not load company settings"
            tone="error"
          />
        ) : (
          <>
            <Card testID="create-shift-company-card">
              <View style={styles.cardContent}>
                <Text allowFontScaling style={styles.cardEyebrow}>Company</Text>
                <Text allowFontScaling style={styles.cardTitle}>{companySettings.name}</Text>
                <Text allowFontScaling style={styles.supportingText}>Currency label: {companySettings.currencyLabel}</Text>
              </View>
            </Card>

            <Card testID="create-shift-details-card">
              <View style={styles.cardContent} testID="create-shift-details-group">
                <View style={styles.sectionCopy}>
                  <Text accessibilityRole="header" allowFontScaling style={styles.sectionTitle}>Shift details</Text>
                  <Text allowFontScaling style={styles.supportingText}>Location and break are optional. A blank break uses the backend default of 0 minutes.</Text>
                </View>
                <FormField accessibilityHint="Optionally enter where this shift takes place." allowFontScaling autoCapitalize="words" editable={!submitting} label="Location" leadingIcon="location" onChangeText={(value) => { setLocation(value); clearSubmitFeedback(); }} placeholder="Optional location" testID="create-shift-location" value={location} />
                <FormField
                  accessibilityHint="Optionally enter a whole number of default break minutes."
                  allowFontScaling
                  editable={!submitting}
                  error={errors.defaultBreakMinutes}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  label="Default break minutes"
                  leadingIcon="time"
                  onChangeText={(value) => { setDefaultBreakMinutes(value); setErrors((current) => ({ ...current, defaultBreakMinutes: undefined })); clearSubmitFeedback(); }}
                  placeholder="0 if blank"
                  testID="create-shift-break"
                  value={defaultBreakMinutes}
                />
              </View>
            </Card>

            <Card testID="create-shift-rates-card">
              <View style={styles.cardContent} testID="create-shift-rates-group">
                <View style={styles.sectionCopy}>
                  <Text accessibilityRole="header" allowFontScaling style={styles.sectionTitle}>Hourly rates</Text>
                  <Text allowFontScaling style={styles.supportingText}>Prefilled values come from Company Settings. Change a value to override it for this shift, or clear it to use an available company default.</Text>
                </View>

                <View style={styles.defaultSummary} testID="create-shift-worker-default">
                  <Text allowFontScaling style={styles.defaultLabel}>Company worker default</Text>
                  <Text allowFontScaling style={styles.defaultValue}>{formatCompanyDefault(companySettings.defaultWorkerHourlyRate, companySettings.currencyLabel)}</Text>
                </View>
                <FormField
                  accessibilityHint="Enter a worker rate override, or clear it to use the company worker default. Zero is a valid rate."
                  allowFontScaling
                  editable={!submitting}
                  error={errors.defaultHourlyRate}
                  hint="Optional only when a company worker default exists. Zero is a valid override."
                  inputMode="decimal"
                  keyboardType="decimal-pad"
                  label={`Worker hourly rate (${companySettings.currencyLabel})`}
                  leadingIcon="person"
                  onChangeText={handleWorkerRateChange}
                  placeholder="Enter worker rate"
                  testID="create-shift-worker-rate"
                  value={defaultHourlyRate}
                />

                <View style={styles.defaultSummary} testID="create-shift-foreman-default">
                  <Text allowFontScaling style={styles.defaultLabel}>Company foreman default</Text>
                  <Text allowFontScaling style={styles.defaultValue}>{formatCompanyDefault(companySettings.defaultForemanHourlyRate, companySettings.currencyLabel)}</Text>
                </View>
                <FormField
                  accessibilityHint="Enter a foreman rate override, or clear it to use the company foreman default. Zero is a valid rate."
                  allowFontScaling
                  editable={!submitting}
                  error={errors.foremanHourlyRate}
                  hint="Optional only when a company foreman default exists. Zero is a valid override."
                  inputMode="decimal"
                  keyboardType="decimal-pad"
                  label={`Foreman hourly rate (${companySettings.currencyLabel})`}
                  leadingIcon="company"
                  onChangeText={handleForemanRateChange}
                  placeholder="Enter foreman rate"
                  testID="create-shift-foreman-rate"
                  value={foremanHourlyRate}
                />
              </View>
            </Card>

            {submitError ? <Feedback message={submitError} testID="create-shift-submit-error" title="Could not create shift" tone="error" /> : null}
            {successMessage ? <Feedback message={successMessage} testID="create-shift-success" title="Shift created" tone="success" /> : null}

            <View style={styles.actions}>
              <Button accessibilityHint="Creates this shift with the entered details and rate overrides." label="Create shift" leadingIcon="add" loading={submitting} onPress={handleSubmit} testID="create-shift-submit" />
              <Button disabled={submitting} label="Cancel" onPress={navigation.goBack} testID="create-shift-cancel" variant="ghost" />
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, gap: theme.gap.section },
  cardContent: { width: "100%", gap: theme.space[4] },
  cardEyebrow: { ...theme.typography.caption, color: theme.colors.ink.muted },
  cardTitle: { ...theme.typography.cardTitle, color: theme.colors.ink.primary, flexShrink: 1 },
  sectionCopy: { width: "100%", gap: theme.space[1] },
  sectionTitle: { ...theme.typography.sectionTitle, color: theme.colors.ink.primary, flexShrink: 1 },
  supportingText: { ...theme.typography.supporting, color: theme.colors.ink.secondary, flexShrink: 1 },
  defaultSummary: { width: "100%", flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: theme.space[2], padding: theme.space[3], borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface.subtle },
  defaultLabel: { ...theme.typography.supporting, color: theme.colors.ink.secondary, flexGrow: 1, flexShrink: 1 },
  defaultValue: { ...theme.typography.label, color: theme.colors.ink.primary, flexShrink: 1 },
  actions: { width: "100%", gap: theme.space[2] }
});
