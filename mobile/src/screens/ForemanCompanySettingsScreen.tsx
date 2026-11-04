import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getMyCompany, updateMyCompany } from "../api/companies";
import { getErrorMessage } from "../api/errors";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { DetailRow } from "../components/DetailRow";
import { Feedback } from "../components/Feedback";
import { FormField } from "../components/FormField";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import { useAuth } from "../context/AuthContext";
import type { CompanySettingsResponse } from "../types/company";
import type { ForemanStackParamList } from "../types/navigation";
import {
  getCompanySettingsFieldError,
  parseOptionalRate,
  trimCurrencyLabelBoundaries,
  validateCurrencyLabel
} from "../utils/companySettings";
import { theme } from "../utils/theme";

type Props = NativeStackScreenProps<
  ForemanStackParamList,
  "ForemanCompanySettings"
>;

type ContentProps = Props & {
  auth: ReturnType<typeof useAuth>;
};

type EditableField =
  | "name"
  | "currencyLabel"
  | "defaultWorkerHourlyRate"
  | "defaultForemanHourlyRate";

type FieldErrors = Partial<Record<EditableField, string>>;

type PendingSaveFeedback =
  | { type: "success" }
  | { type: "error"; field?: EditableField; message: string };

function rateInput(value: number | null): string {
  return value === null ? "" : String(value);
}

function isFormDirty(
  settings: CompanySettingsResponse | null,
  values: {
    name: string;
    currencyLabel: string;
    workerRate: string;
    foremanRate: string;
  }
): boolean {
  if (!settings) return false;

  return (
    values.name !== settings.name ||
    values.currencyLabel !== (settings.currencyLabel ?? "") ||
    values.workerRate !== rateInput(settings.defaultWorkerHourlyRate) ||
    values.foremanRate !== rateInput(settings.defaultForemanHourlyRate)
  );
}

export function ForemanCompanySettingsScreen(props: Props) {
  const auth = useAuth();
  const scopeKey = [
    auth.user?.id ?? "anonymous",
    auth.user?.company?.id ?? "no-company",
    auth.user?.role ?? "no-role"
  ].join(":");

  return (
    <ForemanCompanySettingsContent
      {...props}
      auth={auth}
      key={`foreman-company-settings:${scopeKey}`}
    />
  );
}

function ForemanCompanySettingsContent({ auth, navigation, route }: ContentProps) {
  const {
    authenticatedRequest,
    applyCompany,
    refreshCurrentUser,
    user
  } = auth;
  const canAccess = user?.role === "FOREMAN" && user.company !== null;
  const company = canAccess ? user.company : null;
  const accessScope = canAccess && company ? `${user.id}:${company.id}` : null;

  const [settings, setSettings] = useState<CompanySettingsResponse | null>(null);
  const [name, setName] = useState("");
  const [currencyLabel, setCurrencyLabel] = useState("");
  const [workerRate, setWorkerRate] = useState("");
  const [foremanRate, setForemanRate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [initialLoading, setInitialLoading] = useState(canAccess);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const focusedRef = useRef(false);
  const settingsRef = useRef<CompanySettingsResponse | null>(null);
  const dirtyRef = useRef(false);
  const loadSequenceRef = useRef(0);
  const saveTokenRef = useRef(0);
  const saveOwnerRef = useRef<number | null>(null);
  const postSaveSyncOwnerRef = useRef<number | null>(null);
  const reconciliationRequiredRef = useRef(false);
  const pendingSavedSettingsRef = useRef<CompanySettingsResponse | null>(null);
  const pendingSaveFeedbackRef = useRef<PendingSaveFeedback | null>(null);

  const dirty = isFormDirty(settings, {
    name,
    currencyLabel,
    workerRate,
    foremanRate
  });
  const requiresCurrencyLabel = settings?.currencyLabel === null;
  const routeNotice = route.params?.notice ?? null;

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      focusedRef.current = false;
      loadSequenceRef.current += 1;
      saveTokenRef.current += 1;
      saveOwnerRef.current = null;
      postSaveSyncOwnerRef.current = null;
    };
  }, []);

  const hydrate = useCallback((next: CompanySettingsResponse) => {
    settingsRef.current = next;
    dirtyRef.current = false;
    setSettings(next);
    setName(next.name);
    setCurrencyLabel(next.currencyLabel ?? "");
    setWorkerRate(rateInput(next.defaultWorkerHourlyRate));
    setForemanRate(rateInput(next.defaultForemanHourlyRate));
    setFieldErrors({});
  }, []);

  const publishPendingSaveState = useCallback(() => {
    if (!mountedRef.current || !focusedRef.current) return;

    const pendingSavedSettings = pendingSavedSettingsRef.current;
    pendingSavedSettingsRef.current = null;
    if (pendingSavedSettings) {
      hydrate(pendingSavedSettings);
    }

    const pendingFeedback = pendingSaveFeedbackRef.current;
    pendingSaveFeedbackRef.current = null;
    if (pendingFeedback?.type === "success") {
      setSuccess("Company settings saved. Defaults apply to new shifts only.");
    } else if (pendingFeedback?.type === "error") {
      if (pendingFeedback.field) {
        setFieldErrors((current) => ({
          ...current,
          [pendingFeedback.field!]: pendingFeedback.message
        }));
      } else {
        setSaveError(pendingFeedback.message);
      }
    }
  }, [hydrate]);

  const loadSettings = useCallback(async (
    options: { force?: boolean; reconciliation?: boolean } = {}
  ): Promise<boolean> => {
    if (!mountedRef.current || !focusedRef.current || !canAccess) return false;
    if (
      dirtyRef.current &&
      options.force !== true &&
      options.reconciliation !== true
    ) {
      return false;
    }

    const sequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = sequence;
    const isInitial = settingsRef.current === null;
    if (isInitial) setInitialLoading(true);
    setLoadError(null);

    const isCurrent = () =>
      mountedRef.current &&
      focusedRef.current &&
      sequence === loadSequenceRef.current;

    try {
      const next = await authenticatedRequest((token) => getMyCompany(token));
      if (!isCurrent()) return false;
      if (
        dirtyRef.current &&
        options.force !== true &&
        options.reconciliation !== true
      ) {
        return false;
      }

      if (options.reconciliation === true && dirtyRef.current) {
        settingsRef.current = next;
        setSettings(next);
      } else {
        hydrate(next);
      }
      if (options.reconciliation === true) {
        reconciliationRequiredRef.current = false;
      }
      setLoadError(null);
      return true;
    } catch (caughtError) {
      if (!isCurrent()) return false;
      setLoadError(getErrorMessage(caughtError));
      return false;
    } finally {
      if (isCurrent() && isInitial) setInitialLoading(false);
    }
  }, [authenticatedRequest, canAccess, hydrate]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      setSaving(saveOwnerRef.current !== null);
      publishPendingSaveState();

      if (canAccess) {
        const reconciliation = reconciliationRequiredRef.current;
        if (
          saveOwnerRef.current === null &&
          (reconciliation || settingsRef.current === null || !dirtyRef.current)
        ) {
          void loadSettings({ reconciliation });
        }
      }

      return () => {
        if (postSaveSyncOwnerRef.current !== null) {
          reconciliationRequiredRef.current = true;
        }
        focusedRef.current = false;
        loadSequenceRef.current += 1;
      };
    }, [canAccess, loadSettings, publishPendingSaveState])
  );

  const edit = (
    field: EditableField,
    value: string,
    setter: (next: string) => void
  ) => {
    setter(value);
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSaveError(null);
    setSuccess(null);
  };

  const handleSave = () => {
    if (
      !canAccess ||
      !focusedRef.current ||
      settingsRef.current === null ||
      saveOwnerRef.current !== null ||
      (!dirtyRef.current && settingsRef.current.currencyLabel !== null)
    ) {
      return;
    }

    const nextErrors: FieldErrors = {};
    const nextName = name.trim();
    const nextCurrencyLabel = trimCurrencyLabelBoundaries(currencyLabel);
    const currencyError = validateCurrencyLabel(currencyLabel);
    const nextWorkerRate = parseOptionalRate(workerRate);
    const nextForemanRate = parseOptionalRate(foremanRate);

    if (nextName.length === 0) nextErrors.name = "Enter a company name.";
    if (currencyError) nextErrors.currencyLabel = currencyError;
    if (nextWorkerRate === undefined) {
      nextErrors.defaultWorkerHourlyRate =
        "Use a non-negative rate with up to two decimal places.";
    }
    if (nextForemanRate === undefined) {
      nextErrors.defaultForemanHourlyRate =
        "Use a non-negative rate with up to two decimal places.";
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const token = saveTokenRef.current + 1;
    saveTokenRef.current = token;
    saveOwnerRef.current = token;
    loadSequenceRef.current += 1;
    setSaving(true);
    setSaveError(null);
    setSuccess(null);

    const isOwned = () =>
      mountedRef.current &&
      saveOwnerRef.current === token &&
      accessScope !== null;

    const runSave = async () => {
      let updated: CompanySettingsResponse;
      try {
        updated = await authenticatedRequest((authToken) =>
          updateMyCompany(authToken, {
            name: nextName,
            currencyLabel: nextCurrencyLabel,
            defaultWorkerHourlyRate: nextWorkerRate ?? null,
            defaultForemanHourlyRate: nextForemanRate ?? null
          })
        );
      } catch (caughtError: unknown) {
        if (!isOwned()) return;
        const mapped = getCompanySettingsFieldError(getErrorMessage(caughtError));
        if (!focusedRef.current) {
          pendingSaveFeedbackRef.current = {
            type: "error",
            field: mapped.field,
            message: mapped.message
          };
          return;
        }

        if (mapped.field) {
          setFieldErrors((current) => ({
            ...current,
            [mapped.field!]: mapped.message
          }));
        } else {
          setSaveError(mapped.message);
        }
        return;
      }

      if (!isOwned()) return;

      // The backend save is authoritative before auth/session synchronization.
      // Publish or retain it immediately so a refocus inside either await cannot
      // revive the pre-save baseline or permit a duplicate PUT.
      postSaveSyncOwnerRef.current = token;
      pendingSavedSettingsRef.current = updated;
      pendingSaveFeedbackRef.current = { type: "success" };
      if (!focusedRef.current) {
        reconciliationRequiredRef.current = true;
      }
      publishPendingSaveState();

      let syncFailed = false;
      try {
        await applyCompany(updated);
      } catch {
        syncFailed = true;
      }
      if (!isOwned()) return;

      try {
        await refreshCurrentUser();
      } catch {
        syncFailed = true;
      }
      if (!isOwned()) return;

      if (postSaveSyncOwnerRef.current === token) {
        postSaveSyncOwnerRef.current = null;
      }
      if (syncFailed || !focusedRef.current) {
        reconciliationRequiredRef.current = true;
      }

      publishPendingSaveState();
      if (focusedRef.current && reconciliationRequiredRef.current) {
        void loadSettings({ reconciliation: true });
      }
    };

    void runSave().finally(() => {
      if (postSaveSyncOwnerRef.current === token) {
        postSaveSyncOwnerRef.current = null;
      }
      if (saveOwnerRef.current !== token) return;
      saveOwnerRef.current = null;
      if (mountedRef.current && focusedRef.current) setSaving(false);
    });
  };

  if (!canAccess) {
    return (
      <Screen>
        <View style={styles.page} testID="company-settings-access-gate">
          <ScreenHeader
            backAction={{ label: "Back", onPress: navigation.goBack }}
            eyebrow="Foreman settings"
            title="Company settings"
          />
          <Feedback
            message="Only a foreman with a company can manage company settings."
            mode="screen"
            title="Foreman company access required"
            tone="error"
          />
        </View>
      </Screen>
    );
  }

  const showBlockingLoad = initialLoading && settings === null;
  const showBlockingError = !initialLoading && settings === null && loadError !== null;
  const saveDisabled =
    saving || (!dirty && !requiresCurrencyLabel) || settings === null;

  return (
    <Screen
      scroll
      scrollProps={{
        accessibilityLabel: "Company settings form",
        keyboardDismissMode: "on-drag",
        testID: "company-settings-scroll"
      }}
    >
      <View style={styles.page} testID="company-settings-content">
        <ScreenHeader
          backAction={{
            disabled: saving,
            label: "Back",
            onPress: navigation.goBack
          }}
          eyebrow="Foreman settings"
          subtitle="Manage company defaults for future shifts and open the separate Pay Rules policy editor."
          title="Company settings"
        />

        {routeNotice ? (
          <Feedback
            message={routeNotice}
            testID="company-settings-route-notice"
            title="Company settings notice"
            tone="warning"
          />
        ) : null}
        {success ? (
          <Feedback
            message={success}
            testID="company-settings-success"
            title="Company settings saved"
            tone="success"
          />
        ) : null}
        {saveError ? (
          <Feedback
            message={saveError}
            testID="company-settings-save-error"
            title="Could not update company settings"
            tone="error"
          />
        ) : null}
        {settings && loadError ? (
          <Feedback
            action={{
              disabled: saving,
              label: "Retry load",
              onPress: () => void loadSettings({ reconciliation: true }),
              testID: "company-settings-load-retry"
            }}
            message={loadError}
            testID="company-settings-refresh-error"
            title="Could not refresh company settings"
            tone="error"
          />
        ) : null}
        {dirty ? (
          <Feedback
            message="Review and save this form before leaving."
            testID="company-settings-dirty"
            title="Unsaved changes"
            tone="warning"
          />
        ) : null}

        {showBlockingLoad ? (
          <Feedback
            loading
            message="Fetching the authoritative company defaults before editing."
            mode="screen"
            testID="company-settings-loading"
            title="Loading company settings"
          />
        ) : showBlockingError ? (
          <Feedback
            action={{
              label: "Retry",
              onPress: () => void loadSettings({ force: true }),
              testID: "company-settings-retry"
            }}
            message={loadError}
            mode="screen"
            testID="company-settings-load-error"
            title="Could not load company settings"
            tone="error"
          />
        ) : settings ? (
          <>
            <View style={styles.section}>
              <SectionHeader
                supportingText="This is the company name shown in current company and shift context."
                title="Company identity"
              />
              <Card>
                <FormField
                  accessibilityHint="Updates the current company name."
                  autoCapitalize="words"
                  editable={!saving}
                  error={fieldErrors.name}
                  label="Company name"
                  onChangeText={(value) => edit("name", value, setName)}
                  testID="company-settings-name"
                  value={name}
                />
              </Card>
            </View>

            <View style={styles.section}>
              <SectionHeader
                supportingText="The label is displayed beside monetary values. It does not select an ISO currency or convert money."
                title="Currency and localization"
              />
              <Card>
                <View style={styles.cardContent}>
                  {requiresCurrencyLabel ? (
                    <Feedback
                      message="This migrated company has no current currency label. Enter a valid label before saving or creating a new shift. Existing history remains unchanged."
                      testID="company-settings-null-label"
                      title="Currency label required"
                      tone="warning"
                    />
                  ) : null}
                  <FormField
                    accessibilityHint="Free-form display text. Boundary whitespace is removed only when saving."
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!saving}
                    error={fieldErrors.currencyLabel}
                    hint="Examples: EUR, €, долар, грн, 元. Case and other Unicode text are preserved."
                    label="Currency label"
                    onChangeText={(value) =>
                      edit("currencyLabel", value, setCurrencyLabel)
                    }
                    placeholder="EUR, €, долар, грн, 元"
                    testID="company-settings-currency-label"
                    value={currencyLabel}
                  />
                  <Text allowFontScaling style={styles.explanation}>
                    Saving a new label affects new shifts only. It never relabels existing shifts, payroll, or payout history.
                  </Text>
                </View>
              </Card>
            </View>

            <View style={styles.section}>
              <SectionHeader
                supportingText="Each optional default is independent. Empty clears that default; zero is a valid value."
                title="Default hourly rates"
              />
              <Card>
                <View style={styles.cardContent}>
                  <FormField
                    accessibilityHint="Optional worker default for newly created shifts."
                    editable={!saving}
                    error={fieldErrors.defaultWorkerHourlyRate}
                    hint="Non-negative, with at most two decimal places."
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    label="Default worker hourly rate"
                    onChangeText={(value) =>
                      edit("defaultWorkerHourlyRate", value, setWorkerRate)
                    }
                    placeholder="Optional"
                    testID="company-settings-worker-rate"
                    value={workerRate}
                  />
                  <FormField
                    accessibilityHint="Optional foreman default for newly created shifts."
                    editable={!saving}
                    error={fieldErrors.defaultForemanHourlyRate}
                    hint="Non-negative, with at most two decimal places."
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    label="Default foreman hourly rate"
                    onChangeText={(value) =>
                      edit("defaultForemanHourlyRate", value, setForemanRate)
                    }
                    placeholder="Optional"
                    testID="company-settings-foreman-rate"
                    value={foremanRate}
                  />
                  <Text allowFontScaling style={styles.explanation}>
                    Defaults are fallbacks for new shifts. They do not change existing shifts, attendance, salary, payroll, or payouts.
                  </Text>
                </View>
              </Card>
            </View>

            <View style={styles.section}>
              <SectionHeader
                supportingText="These company values are returned by the backend and are read-only here."
                title="Company details"
              />
              <Card subtle>
                <View style={styles.readOnlyRows}>
                  <DetailRow label="Worker join code" value={settings.joinCode} />
                  <DetailRow label="Company timezone" value={settings.timeZone} />
                </View>
              </Card>
            </View>

            <View style={styles.section}>
              <SectionHeader
                supportingText="Premium and overtime policy is versioned and saved separately from these company defaults."
                title="Pay Rules"
              />
              <Card>
                <View style={styles.cardContent}>
                  <Text allowFontScaling style={styles.rowTitle}>
                    Configure premium pay policy
                  </Text>
                  <Text allowFontScaling style={styles.explanation}>
                    Open the existing Pay Rules editor for week, stacking, time-of-day, overtime, weekday, and manual holiday rules.
                  </Text>
                  <Button
                    accessibilityHint="Opens the nested Pay Rules screen."
                    disabled={saving}
                    label="Open Pay Rules"
                    onPress={() => navigation.navigate("ForemanPayRules")}
                    testID="company-settings-pay-rules"
                    trailingIcon="forward"
                    variant="secondary"
                  />
                </View>
              </Card>
            </View>

            <View style={styles.actions}>
              <Button
                accessibilityHint="Validates and saves all editable company settings."
                disabled={saveDisabled}
                label="Save company settings"
                loading={saving}
                onPress={handleSave}
                testID="company-settings-save"
              />
              <Text allowFontScaling style={styles.actionNote}>
                Company name, currency label, and both default-rate values are sent together.
              </Text>
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    gap: theme.gap.section
  },
  section: {
    gap: theme.space[3]
  },
  cardContent: {
    gap: theme.space[4]
  },
  explanation: {
    ...theme.typography.supporting,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  rowTitle: {
    ...theme.typography.cardTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  readOnlyRows: {
    gap: theme.space[1]
  },
  actions: {
    gap: theme.space[2]
  },
  actionNote: {
    ...theme.typography.caption,
    color: theme.colors.ink.muted,
    flexShrink: 1,
    textAlign: "center"
  }
});
