import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getMyPayPolicy, updateMyPayPolicy } from "../api/payPolicy";
import { getMyCompany } from "../api/companies";
import { Button } from "../components/Button";
import { DetailRow } from "../components/DetailRow";
import { PayPolicyRuleEditor } from "../components/PayPolicyRuleEditor";
import { Screen } from "../components/Screen";
import {
  SegmentedControl,
  type SegmentedControlOption
} from "../components/SegmentedControl";
import { StateMessage } from "../components/StateMessage";
import { useAuth } from "../context/AuthContext";
import type { ForemanStackParamList } from "../types/navigation";
import type {
  PayPolicy,
  PayPolicyStackingStrategy,
  PayPolicyWeekday
} from "../types/payPolicy";
import type { CompanySettingsResponse } from "../types/company";
import { PAY_POLICY_WEEKDAYS } from "../types/payPolicy";
import {
  createEmptyPayPolicyRule,
  hydratePayPolicyForm,
  mapPayPolicySaveError,
  reconcilePayPolicyFormErrors,
  serializePayPolicyForm,
  validatePayPolicyForm,
  type PayPolicyForm,
  type PayPolicyFormErrors,
  type PayPolicyRuleForm
} from "../utils/payPolicyForm";
import { colors, radii, spacing, typography } from "../utils/theme";

type ForemanPayRulesScreenProps = NativeStackScreenProps<
  ForemanStackParamList,
  "ForemanPayRules"
>;

interface PayPolicyEditorState {
  form: PayPolicyForm | null;
  fieldErrors: PayPolicyFormErrors;
}

interface PayPolicyOperation {
  sequence: number;
  type: "load" | "save";
  focusGeneration: number;
}

interface QueuedPayPolicyLoad {
  focusGeneration: number;
  required: boolean;
}

type VisualLoadMode = "blocking" | "refreshing" | "idle";
type FreshnessState = "current" | "required-pending" | "required-failed";

const STACKING_OPTIONS: readonly SegmentedControlOption<PayPolicyStackingStrategy>[] = [
  { value: "ADD", label: "Combine all premiums" },
  { value: "HIGHEST_ONLY", label: "Use highest premium only" }
];

const WEEK_START_OPTIONS: readonly SegmentedControlOption<PayPolicyWeekday>[] =
  PAY_POLICY_WEEKDAYS.map((weekday) => ({
    value: weekday,
    label: weekday.slice(0, 3)
  }));

export function ForemanPayRulesScreen({ navigation }: ForemanPayRulesScreenProps) {
  const { authenticatedRequest, user } = useAuth();
  const [policy, setPolicy] = useState<PayPolicy | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettingsResponse | null>(null);
  const [editor, setEditor] = useState<PayPolicyEditorState>({
    form: null,
    fieldErrors: {}
  });
  const [visualLoadMode, setVisualLoadMode] = useState<VisualLoadMode>("blocking");
  const [freshnessState, setFreshnessState] = useState<FreshnessState>("required-pending");
  const [saveTransportInFlight, setSaveTransportInFlight] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const operationSequenceRef = useRef(0);
  const activeOperationRef = useRef<PayPolicyOperation | null>(null);
  const focusedRef = useRef(false);
  const focusGenerationRef = useRef(0);
  const hasCoherentPairRef = useRef(false);
  const freshnessRef = useRef<FreshnessState>("required-pending");
  const loadTransportSequencesRef = useRef(new Set<number>());
  const saveInFlightRef = useRef(false);
  const queuedLoadRef = useRef<QueuedPayPolicyLoad | null>(null);
  const savedPolicyVersionRef = useRef<number | null>(null);
  const { form, fieldErrors } = editor;
  const editingDisabled =
    saveTransportInFlight || freshnessState !== "current" || !isFocused;

  const loadPolicy = useCallback(async (requestedRequired = false) => {
    if (!focusedRef.current) return;

    const focusGeneration = focusGenerationRef.current;
    const requiredFreshness =
      requestedRequired || freshnessRef.current !== "current";
    const blockingVisual = !hasCoherentPairRef.current;

    if (requiredFreshness) {
      freshnessRef.current = "required-pending";
      setFreshnessState("required-pending");
    }

    if (saveInFlightRef.current) {
      const queuedLoad = queuedLoadRef.current;
      queuedLoadRef.current = {
        focusGeneration,
        required:
          queuedLoad?.focusGeneration === focusGeneration
            ? queuedLoad.required || requiredFreshness
            : requiredFreshness
      };
      if (blockingVisual) {
        setVisualLoadMode("blocking");
        setLoadError(null);
      } else {
        setVisualLoadMode("refreshing");
        setRefreshError(null);
      }
      return;
    }

    const operation: PayPolicyOperation = {
      sequence: ++operationSequenceRef.current,
      type: "load",
      focusGeneration
    };

    activeOperationRef.current = operation;
    loadTransportSequencesRef.current.add(operation.sequence);
    setSaveTransportInFlight(saveInFlightRef.current);
    if (blockingVisual) {
      setVisualLoadMode("blocking");
      setLoadError(null);
    } else {
      setVisualLoadMode("refreshing");
      setRefreshError(null);
    }

    try {
      const [nextPolicy, nextCompanySettings] = await authenticatedRequest((token) =>
        Promise.all([getMyPayPolicy(token), getMyCompany(token)])
      );
      if (
        activeOperationRef.current !== operation ||
        operation.sequence !== operationSequenceRef.current ||
        operation.focusGeneration !== focusGenerationRef.current ||
        !focusedRef.current
      ) return;
      hasCoherentPairRef.current = true;
      if (requiredFreshness) {
        freshnessRef.current = "current";
        setFreshnessState("current");
      }
      setPolicy(nextPolicy);
      setCompanySettings(nextCompanySettings);
      setEditor({
        form: hydratePayPolicyForm(nextPolicy),
        fieldErrors: {}
      });
      setLoadError(null);
      setRefreshError(null);
      if (
        savedPolicyVersionRef.current !== null &&
        savedPolicyVersionRef.current !== nextPolicy.version
      ) {
        savedPolicyVersionRef.current = null;
        setSavedMessage(null);
      }
    } catch {
      if (
        activeOperationRef.current !== operation ||
        operation.sequence !== operationSequenceRef.current ||
        operation.focusGeneration !== focusGenerationRef.current ||
        !focusedRef.current
      ) return;
      if (blockingVisual) {
        setLoadError("Could not load pay rules. Check your connection and try again.");
      } else {
        setRefreshError("Existing policy and company settings are still shown.");
      }
      if (requiredFreshness) {
        freshnessRef.current = "required-failed";
        setFreshnessState("required-failed");
      }
    } finally {
      loadTransportSequencesRef.current.delete(operation.sequence);
      if (
        activeOperationRef.current !== operation ||
        operation.sequence !== operationSequenceRef.current ||
        operation.focusGeneration !== focusGenerationRef.current ||
        !focusedRef.current
      ) return;
      activeOperationRef.current = null;
      setSaveTransportInFlight(saveInFlightRef.current);
      setVisualLoadMode("idle");
    }
  }, [authenticatedRequest]);

  useFocusEffect(
    useCallback(() => {
      const focusGeneration = ++focusGenerationRef.current;
      focusedRef.current = true;
      setIsFocused(true);
      setSaveTransportInFlight(saveInFlightRef.current);
      void loadPolicy(true);
      return () => {
        if (focusGeneration !== focusGenerationRef.current) return;
        focusedRef.current = false;
        setIsFocused(false);
        queuedLoadRef.current = null;
        operationSequenceRef.current += 1;
        activeOperationRef.current = null;
      };
    }, [loadPolicy])
  );

  const updateForm = (updater: (current: PayPolicyForm) => PayPolicyForm) => {
    if (
      !focusedRef.current ||
      saveInFlightRef.current ||
      freshnessRef.current !== "current"
    ) {
      return;
    }

    setEditor((current) => {
      if (!current.form) {
        return current;
      }

      const nextForm = updater(current.form);
      return {
        form: nextForm,
        fieldErrors: reconcilePayPolicyFormErrors(
          current.form,
          nextForm,
          current.fieldErrors
        )
      };
    });
    setSaveError(null);
    setSavedMessage(null);
    savedPolicyVersionRef.current = null;
  };

  const updateRule = (index: number, rule: PayPolicyRuleForm) => {
    updateForm((current) => ({
      ...current,
      rules: current.rules.map((currentRule, ruleIndex) =>
        ruleIndex === index ? rule : currentRule
      )
    }));
  };

  const handleSave = () => {
    if (
      !form ||
      saveInFlightRef.current ||
      freshnessRef.current !== "current" ||
      !focusedRef.current
    ) {
      return;
    }

    const validationErrors = validatePayPolicyForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setEditor((current) => ({ ...current, fieldErrors: validationErrors }));
      setSaveError("Review the highlighted pay rule fields before saving.");
      setSavedMessage(null);
      return;
    }

    const payload = serializePayPolicyForm(form);
    const operation: PayPolicyOperation = {
      sequence: ++operationSequenceRef.current,
      type: "save",
      focusGeneration: focusGenerationRef.current
    };
    activeOperationRef.current = operation;
    saveInFlightRef.current = true;
    setSaveTransportInFlight(true);
    setVisualLoadMode("idle");
    setRefreshError(null);
    setEditor((current) => ({ ...current, fieldErrors: {} }));
    setSaveError(null);
    setSavedMessage(null);
    savedPolicyVersionRef.current = null;

    void authenticatedRequest((token) => updateMyPayPolicy(token, payload))
      .then((updatedPolicy) => {
        if (
          activeOperationRef.current !== operation ||
          operation.sequence !== operationSequenceRef.current ||
          operation.focusGeneration !== focusGenerationRef.current ||
          !focusedRef.current
        ) return;
        hasCoherentPairRef.current = true;
        setPolicy(updatedPolicy);
        setEditor({
          form: hydratePayPolicyForm(updatedPolicy),
          fieldErrors: {}
        });
        setSavedMessage(
          `Version ${updatedPolicy.version} is now current. Earlier versions remain unchanged.`
        );
        savedPolicyVersionRef.current = updatedPolicy.version;
      })
      .catch((caughtError) => {
        if (
          activeOperationRef.current !== operation ||
          operation.sequence !== operationSequenceRef.current ||
          operation.focusGeneration !== focusGenerationRef.current ||
          !focusedRef.current
        ) return;
        const mappedError = mapPayPolicySaveError(caughtError, form);
        setEditor((current) => ({
          ...current,
          fieldErrors: mappedError.fieldErrors
        }));
        const fieldErrorDetails = Object.entries(mappedError.fieldErrors)
          .map(([path, message]) => `${path}: ${message}`)
          .join(" ");
        setSaveError(
          mappedError.generalError ??
            (fieldErrorDetails
              ? `Could not save pay rules: ${fieldErrorDetails}`
              : "Could not save pay rules. Review the form and try again.")
        );
      })
      .finally(() => {
        const isCurrentFocusedOperation =
          activeOperationRef.current === operation &&
          operation.sequence === operationSequenceRef.current &&
          operation.focusGeneration === focusGenerationRef.current &&
          focusedRef.current;
        saveInFlightRef.current = false;

        if (isCurrentFocusedOperation) {
          activeOperationRef.current = null;
          setSaveTransportInFlight(false);
        }

        const queuedLoad = queuedLoadRef.current;
        if (!focusedRef.current) {
          if (queuedLoad?.focusGeneration === operation.focusGeneration) {
            queuedLoadRef.current = null;
          }
          return;
        }

        if (
          queuedLoad?.focusGeneration === focusGenerationRef.current &&
          activeOperationRef.current === null
        ) {
          queuedLoadRef.current = null;
          void loadPolicy(queuedLoad.required);
        }
      });
  };

  if (!user?.company) {
    return (
      <Screen>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.kicker}>Company settings</Text>
            <Text style={styles.title}>Pay rules</Text>
          </View>
          <StateMessage
            title="Company required"
            message="Create your company before configuring pay rules."
            tone="error"
          />
          <Button label="Back to company settings" onPress={navigation.goBack} variant="ghost" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Company settings</Text>
          <Text style={styles.title}>Pay rules</Text>
          <Text style={styles.subtitle}>
            Configure percentage premiums. Pay results are calculated by the backend.
          </Text>
        </View>

        {visualLoadMode === "blocking" ? (
          <StateMessage loading title="Loading pay rules" message="Fetching current policy." />
        ) : loadError || !form || !policy || !companySettings ? (
          <View style={styles.stateBlock}>
            <StateMessage
              title="Could not load pay rules"
              message={loadError ?? "The current policy was unavailable."}
              tone="error"
            />
            <Button label="Retry" onPress={() => void loadPolicy(true)} variant="secondary" />
            <Button label="Back to company settings" onPress={navigation.goBack} variant="ghost" />
          </View>
        ) : (
          <>
            <View style={styles.metadataPanel}>
              <DetailRow label="Company" value={user.company.name} />
              <DetailRow label="Company timezone" value={policy.timeZone} />
              <DetailRow label="Current version" value={`Version ${policy.version}`} />
            </View>

            {savedMessage ? (
              <StateMessage title="Pay rules saved" message={savedMessage} tone="success" />
            ) : null}
            {saveError ? (
              <StateMessage title="Could not save pay rules" message={saveError} tone="error" />
            ) : null}
            {visualLoadMode === "refreshing" ? (
              <StateMessage
                loading
                title="Refreshing pay rules"
                message="Checking for the latest policy and company settings."
              />
            ) : null}
            {refreshError ? (
              <StateMessage
                title="Could not refresh pay rules"
                message={refreshError}
                tone="error"
              />
            ) : null}
            {freshnessState === "required-failed" ? (
              <Button
                label="Retry refresh"
                onPress={() => void loadPolicy(true)}
                variant="secondary"
              />
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Policy settings</Text>

              <View style={styles.controlBlock}>
                <Text style={styles.fieldLabel}>Week starts on</Text>
                <SegmentedControl
                  accessibilityLabel="Week starts on"
                  disabled={editingDisabled}
                  onChange={(weekStartsOn) => {
                    updateForm((current) => ({ ...current, weekStartsOn }));
                  }}
                  options={WEEK_START_OPTIONS}
                  value={form.weekStartsOn}
                  wrap
                />
                <Text style={styles.helpText}>
                  Weekly overtime resets at the selected week start in the company timezone.
                </Text>
                {fieldErrors.weekStartsOn ? (
                  <Text style={styles.error}>{fieldErrors.weekStartsOn}</Text>
                ) : null}
              </View>

              <View style={styles.controlBlock}>
                <Text style={styles.fieldLabel}>Stacking strategy</Text>
                <SegmentedControl
                  accessibilityLabel="Stacking strategy"
                  disabled={editingDisabled}
                  onChange={(stackingStrategy) => {
                    updateForm((current) => ({ ...current, stackingStrategy }));
                  }}
                  options={STACKING_OPTIONS}
                  value={form.stackingStrategy}
                />
                <Text style={styles.helpText}>
                  Combine all premiums adds every matching premium. Use highest premium only
                  applies just the largest matching premium.
                </Text>
                {fieldErrors.stackingStrategy ? (
                  <Text style={styles.error}>{fieldErrors.stackingStrategy}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>Premium rules</Text>
                  <Text style={styles.helpText}>
                    Saving creates a new immutable policy version.
                  </Text>
                </View>
                <Button
                  disabled={editingDisabled}
                  label="Add rule"
                  onPress={() => {
                    updateForm((current) => ({
                      ...current,
                      rules: [...current.rules, createEmptyPayPolicyRule()]
                    }));
                  }}
                  variant="secondary"
                />
              </View>

              {form.rules.length === 0 ? (
                <StateMessage
                  title="No premium rules"
                  message="This policy applies no premiums. Add a rule to configure one."
                />
              ) : (
                <View style={styles.ruleList}>
                  {form.rules.map((rule, index) => (
                    <PayPolicyRuleEditor
                      disabled={editingDisabled}
                      errors={fieldErrors}
                      index={index}
                      key={rule.clientId}
                      onChange={(nextRule) => {
                        updateRule(index, nextRule);
                      }}
                      onRemove={() => {
                        updateForm((current) => ({
                          ...current,
                          rules: current.rules.filter(
                            (_, ruleIndex) => ruleIndex !== index
                          )
                        }));
                      }}
                      onOpenCompanySettings={navigation.goBack}
                      companyDefaultWorkerHourlyRate={companySettings?.defaultWorkerHourlyRate ?? null}
                      currencyLabel={companySettings?.currencyLabel ?? null}
                      rule={rule}
                    />
                  ))}
                </View>
              )}
            </View>

            <View style={styles.actions}>
              <Button
                disabled={editingDisabled}
                label="Save as new version"
                loading={saveTransportInFlight}
                onPress={handleSave}
              />
              <Button
                disabled={false}
                label="Reload current policy"
                onPress={() => void loadPolicy()}
                variant="secondary"
              />
              <Button
                label="Back to company settings"
                onPress={navigation.goBack}
                variant="ghost"
              />
            </View>
          </>
        )}
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
  metadataPanel: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md
  },
  section: {
    gap: spacing.md
  },
  sectionHeader: {
    gap: spacing.md
  },
  sectionHeaderText: {
    gap: spacing.xs
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.text
  },
  controlBlock: {
    gap: spacing.sm
  },
  fieldLabel: {
    ...typography.label,
    color: colors.text
  },
  helpText: {
    ...typography.caption,
    color: colors.textSecondary
  },
  error: {
    ...typography.caption,
    color: colors.error
  },
  stateBlock: {
    gap: spacing.md
  },
  ruleList: {
    gap: spacing.md
  },
  actions: {
    gap: spacing.md
  }
});
