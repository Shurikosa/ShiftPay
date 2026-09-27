import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getMyCompany, updateMyCompany } from "../api/companies";
import { getErrorMessage } from "../api/errors";
import { Button } from "../components/Button";
import { DetailRow } from "../components/DetailRow";
import { FormField } from "../components/FormField";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { useAuth } from "../context/AuthContext";
import type { ForemanStackParamList } from "../types/navigation";
import type { CompanySettingsResponse } from "../types/company";
import {
  getCompanySettingsFieldError,
  parseOptionalRate,
  trimCurrencyLabelBoundaries,
  validateCurrencyLabel
} from "../utils/companySettings";
import { colors, radii, spacing, typography } from "../utils/theme";

type Props = NativeStackScreenProps<ForemanStackParamList, "ForemanCompanySettings">;
type FieldErrors = Partial<Record<"name" | "currencyLabel" | "defaultWorkerHourlyRate" | "defaultForemanHourlyRate", string>>;

function rateInput(value: number | null): string {
  return value === null ? "" : String(value);
}

export function ForemanCompanySettingsScreen({ navigation, route }: Props) {
  const { authenticatedRequest, applyCompany, refreshCurrentUser, user } = useAuth();
  const [settings, setSettings] = useState<CompanySettingsResponse | null>(null);
  const [name, setName] = useState("");
  const [currencyLabel, setCurrencyLabel] = useState("");
  const [workerRate, setWorkerRate] = useState("");
  const [foremanRate, setForemanRate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // A navigation notice describes why this screen was opened; it is not a GET/PUT status.
  const [routeNotice] = useState<string | null>(route.params?.notice ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const loadSequenceRef = useRef(0);
  const screenActiveRef = useRef(true);

  const hydrate = (next: CompanySettingsResponse) => {
    setSettings(next);
    setName(next.name);
    setCurrencyLabel(next.currencyLabel ?? "");
    setWorkerRate(rateInput(next.defaultWorkerHourlyRate));
    setForemanRate(rateInput(next.defaultForemanHourlyRate));
    setFieldErrors({});
  };

  const loadSettings = useCallback(async () => {
    const sequence = ++loadSequenceRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const next = await authenticatedRequest((token) => getMyCompany(token));
      if (sequence === loadSequenceRef.current) hydrate(next);
    } catch (caughtError) {
      if (sequence === loadSequenceRef.current) setLoadError(getErrorMessage(caughtError));
    } finally {
      if (sequence === loadSequenceRef.current) setLoading(false);
    }
  }, [authenticatedRequest]);

  useFocusEffect(
    useCallback(() => {
      screenActiveRef.current = true;
      void loadSettings();
      return () => {
        screenActiveRef.current = false;
        loadSequenceRef.current += 1;
      };
    }, [loadSettings])
  );

  const edit = (field: keyof FieldErrors, value: string, setter: (next: string) => void) => {
    setter(value);
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSaveError(null);
    setSuccess(null);
  };

  const handleSave = () => {
    const nextErrors: FieldErrors = {};
    const nextName = name.trim();
    const nextCurrencyLabel = trimCurrencyLabelBoundaries(currencyLabel);
    const currencyError = validateCurrencyLabel(currencyLabel);
    const nextWorkerRate = parseOptionalRate(workerRate);
    const nextForemanRate = parseOptionalRate(foremanRate);

    if (nextName.length === 0) nextErrors.name = "Enter a company name.";
    if (currencyError) nextErrors.currencyLabel = currencyError;
    if (nextWorkerRate === undefined) {
      nextErrors.defaultWorkerHourlyRate = "Use a non-negative rate with up to two decimal places.";
    }
    if (nextForemanRate === undefined) {
      nextErrors.defaultForemanHourlyRate = "Use a non-negative rate with up to two decimal places.";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || saving) return;

    setSaving(true);
    setSaveError(null);
    setSuccess(null);
    void authenticatedRequest((token) =>
      updateMyCompany(token, {
        name: nextName,
        currencyLabel: nextCurrencyLabel,
        defaultWorkerHourlyRate: nextWorkerRate ?? null,
        defaultForemanHourlyRate: nextForemanRate ?? null
      })
    )
      .then(async (updated) => {
        if (!screenActiveRef.current) return;
        hydrate(updated);
        await applyCompany(updated);
        await refreshCurrentUser().catch(() => undefined);
        if (!screenActiveRef.current) return;
        setSuccess("Company settings saved. Defaults apply to new shifts only.");
      })
      .catch((caughtError) => {
        if (!screenActiveRef.current) return;
        const mapped = getCompanySettingsFieldError(getErrorMessage(caughtError));
        if (mapped.field) setFieldErrors((current) => ({ ...current, [mapped.field!]: mapped.message }));
        else setSaveError(mapped.message);
      })
      .finally(() => {
        if (screenActiveRef.current) setSaving(false);
      });
  };

  if (user?.role !== "FOREMAN") {
    return (
      <Screen><StateMessage title="Company settings unavailable" message="Only foremen can manage company settings." tone="error" /></Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Foreman settings</Text>
          <Text style={styles.title}>Company settings</Text>
          <Text style={styles.subtitle}>Defaults affect new shifts only. Historical shifts keep their snapshots.</Text>
        </View>
        {loading ? <StateMessage loading title="Loading company settings" message="Fetching company defaults." /> : null}
        {routeNotice ? <StateMessage title="Company settings notice" message={routeNotice} tone="error" /> : null}
        {loadError ? <StateMessage title="Could not load company settings" message={loadError} tone="error" /> : null}
        {saveError ? <StateMessage title="Could not update company settings" message={saveError} tone="error" /> : null}
        {success ? <StateMessage title="Company settings saved" message={success} tone="success" /> : null}
        {!loading && settings ? <>
          <View style={styles.readOnlyPanel}>
            <DetailRow label="Worker join code" value={settings.joinCode} />
            <DetailRow label="Company timezone" value={settings.timeZone} />
          </View>
          <View style={styles.form}>
            <FormField autoCapitalize="words" error={fieldErrors.name} label="Company name" onChangeText={(value) => edit("name", value, setName)} value={name} />
            <FormField error={fieldErrors.currencyLabel} label="Currency label" onChangeText={(value) => edit("currencyLabel", value, setCurrencyLabel)} placeholder="EUR, €, долар, грн, 元" value={currencyLabel} />
            <Text style={styles.helpText}>Currency label is display text only. ShiftPay does not convert money.</Text>
            <FormField error={fieldErrors.defaultWorkerHourlyRate} inputMode="decimal" keyboardType="decimal-pad" label="Default worker hourly rate" onChangeText={(value) => edit("defaultWorkerHourlyRate", value, setWorkerRate)} placeholder="Optional" value={workerRate} />
            <FormField error={fieldErrors.defaultForemanHourlyRate} inputMode="decimal" keyboardType="decimal-pad" label="Default foreman hourly rate" onChangeText={(value) => edit("defaultForemanHourlyRate", value, setForemanRate)} placeholder="Optional" value={foremanRate} />
          </View>
          <View style={styles.actions}>
            <Button label="Save company settings" loading={saving} onPress={handleSave} />
            <Button disabled={saving} label="Pay rules" onPress={() => navigation.navigate("ForemanPayRules")} variant="secondary" />
            <Button disabled={saving} label="Reload" onPress={() => void loadSettings()} variant="secondary" />
            <Button disabled={saving} label="Back to dashboard" onPress={navigation.goBack} variant="ghost" />
          </View>
        </> : !loading ? (
          <View style={styles.actions}>
            <Button label="Reload" onPress={() => void loadSettings()} variant="secondary" />
            <Button label="Back to dashboard" onPress={navigation.goBack} variant="ghost" />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.xl },
  header: { gap: spacing.sm },
  kicker: { ...typography.label, color: colors.primary },
  title: { ...typography.screenTitle, color: colors.text },
  subtitle: { ...typography.body, color: colors.textSecondary },
  readOnlyPanel: { borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: spacing.md },
  form: { gap: spacing.md },
  helpText: { ...typography.caption, color: colors.textSecondary },
  actions: { gap: spacing.md }
});
