import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getMyPayPolicy, updateMyPayPolicy } from "../api/payPolicy";
import { getMyCompany } from "../api/companies";
import { ApiError } from "../api/errors";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { DetailRow } from "../components/DetailRow";
import { Feedback } from "../components/Feedback";
import { PayPolicyRuleEditor } from "../components/PayPolicyRuleEditor";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import {
  SegmentedControl,
  type SegmentedControlOption
} from "../components/SegmentedControl";
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
import { theme } from "../utils/theme";

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
  editGeneration: number;
  draftGeneration: number;
  preserveDirtyDraft: boolean;
}

interface QueuedPayPolicyLoad {
  focusGeneration: number;
  required: boolean;
}

interface ConfirmedPayPolicySave {
  draftGeneration: number;
  policy: PayPolicy;
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

type ForemanPayRulesContentProps = ForemanPayRulesScreenProps & {
  auth: ReturnType<typeof useAuth>;
};

export function ForemanPayRulesScreen(props: ForemanPayRulesScreenProps) {
  const auth = useAuth();
  const scopeKey = [
    auth.user?.role ?? "no-role",
    auth.user?.id ?? "anonymous",
    auth.user?.company?.id ?? "no-company"
  ].join(":");

  return (
    <ForemanPayRulesContent
      {...props}
      auth={auth}
      key={`foreman-pay-rules:${scopeKey}`}
    />
  );
}

function ForemanPayRulesContent({ auth, navigation }: ForemanPayRulesContentProps) {
  const { authenticatedRequest, user } = auth;
  const isForeman = user?.role === "FOREMAN";
  const company = isForeman ? user.company : null;
  const canAccess = company !== null;
  const [policy, setPolicy] = useState<PayPolicy | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettingsResponse | null>(null);
  const [editor, setEditor] = useState<PayPolicyEditorState>({
    form: null,
    fieldErrors: {}
  });
  const [visualLoadMode, setVisualLoadMode] = useState<VisualLoadMode>(
    canAccess ? "blocking" : "idle"
  );
  const [freshnessState, setFreshnessState] = useState<FreshnessState>("required-pending");
  const [dirty, setDirty] = useState(false);
  const [saveTransportInFlight, setSaveTransportInFlight] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const operationSequenceRef = useRef(0);
  const editGenerationRef = useRef(0);
  const draftGenerationRef = useRef(0);
  const dirtyRef = useRef(false);
  const activeOperationRef = useRef<PayPolicyOperation | null>(null);
  const saveOwnerRef = useRef<PayPolicyOperation | null>(null);
  const pendingConfirmedSaveRef = useRef<ConfirmedPayPolicySave | null>(null);
  const focusedRef = useRef(false);
  const focusGenerationRef = useRef(0);
  const hasCoherentPairRef = useRef(false);
  const freshnessRef = useRef<FreshnessState>("required-pending");
  const loadTransportSequencesRef = useRef(new Set<number>());
  const saveInFlightRef = useRef(false);
  const queuedLoadRef = useRef<QueuedPayPolicyLoad | null>(null);
  const savedPolicyVersionRef = useRef<number | null>(null);
  const { form, fieldErrors } = editor;
  const renderedEditGeneration = editGenerationRef.current;
  const editingDisabled =
    saveTransportInFlight || freshnessState !== "current" || !isFocused;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      focusedRef.current = false;
      operationSequenceRef.current += 1;
      activeOperationRef.current = null;
      saveOwnerRef.current = null;
      pendingConfirmedSaveRef.current = null;
      queuedLoadRef.current = null;
    };
  }, []);

  const publishConfirmedSave = useCallback(() => {
    if (!mountedRef.current || !focusedRef.current) return;

    const confirmedSave = pendingConfirmedSaveRef.current;
    if (!confirmedSave) return;
    pendingConfirmedSaveRef.current = null;

    const draftUnchanged =
      draftGenerationRef.current === confirmedSave.draftGeneration;
    hasCoherentPairRef.current = true;
    setPolicy(confirmedSave.policy);

    if (!draftUnchanged) return;

    editGenerationRef.current += 1;
    draftGenerationRef.current += 1;
    dirtyRef.current = false;
    setEditor({
      form: hydratePayPolicyForm(confirmedSave.policy),
      fieldErrors: {}
    });
    setDirty(false);
    setSavedMessage(
      `Version ${confirmedSave.policy.version} is now current. Earlier versions remain unchanged.`
    );
    savedPolicyVersionRef.current = confirmedSave.policy.version;
  }, []);

  const loadPolicy = useCallback(async (requestedRequired = false) => {
    if (!focusedRef.current || !canAccess || !company) return;

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
      focusGeneration,
      editGeneration: editGenerationRef.current,
      draftGeneration: draftGenerationRef.current,
      preserveDirtyDraft: requestedRequired && dirtyRef.current
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
      if (
        nextPolicy.companyId !== company.id ||
        nextCompanySettings.id !== company.id
      ) {
        throw new Error("Pay rules were returned for a different company.");
      }
      if (operation.editGeneration !== editGenerationRef.current) {
        return;
      }
      hasCoherentPairRef.current = true;
      if (requiredFreshness) {
        freshnessRef.current = "current";
        setFreshnessState("current");
      }
      setPolicy(nextPolicy);
      setCompanySettings(nextCompanySettings);
      if (!operation.preserveDirtyDraft) {
        editGenerationRef.current += 1;
        draftGenerationRef.current += 1;
        dirtyRef.current = false;
        setEditor({
          form: hydratePayPolicyForm(nextPolicy),
          fieldErrors: {}
        });
        setDirty(false);
      }
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
  }, [authenticatedRequest, canAccess, company]);

  useFocusEffect(
    useCallback(() => {
      const focusGeneration = ++focusGenerationRef.current;
      editGenerationRef.current += 1;
      focusedRef.current = true;
      setIsFocused(true);
      setSaveTransportInFlight(saveInFlightRef.current);
      publishConfirmedSave();
      if (canAccess) {
        void loadPolicy(true);
      }
      return () => {
        if (focusGeneration !== focusGenerationRef.current) return;
        focusedRef.current = false;
        setIsFocused(false);
        queuedLoadRef.current = null;
        operationSequenceRef.current += 1;
        activeOperationRef.current = null;
      };
    }, [canAccess, loadPolicy, publishConfirmedSave])
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
    editGenerationRef.current += 1;
    draftGenerationRef.current += 1;
    dirtyRef.current = true;
    setDirty(true);
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
      !company ||
      renderedEditGeneration !== editGenerationRef.current ||
      saveInFlightRef.current ||
      !dirtyRef.current ||
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
    const saveCompanyId = company.id;
    const operation: PayPolicyOperation = {
      sequence: ++operationSequenceRef.current,
      type: "save",
      focusGeneration: focusGenerationRef.current,
      editGeneration: editGenerationRef.current,
      draftGeneration: draftGenerationRef.current,
      preserveDirtyDraft: false
    };
    activeOperationRef.current = operation;
    saveOwnerRef.current = operation;
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
          !mountedRef.current ||
          saveOwnerRef.current !== operation
        ) return;
        if (updatedPolicy.companyId !== saveCompanyId) {
          throw new Error("Pay rules were saved for a different company.");
        }
        pendingConfirmedSaveRef.current = {
          draftGeneration: operation.draftGeneration,
          policy: updatedPolicy
        };
        publishConfirmedSave();
      })
      .catch((caughtError) => {
        if (
          !mountedRef.current ||
          saveOwnerRef.current !== operation ||
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
        if (caughtError instanceof ApiError && caughtError.status === 409) {
          freshnessRef.current = "required-pending";
          setFreshnessState("required-pending");
          queuedLoadRef.current = {
            focusGeneration: focusGenerationRef.current,
            required: true
          };
        }
      })
      .finally(() => {
        const ownsSave = saveOwnerRef.current === operation;
        saveInFlightRef.current = false;

        if (activeOperationRef.current === operation) {
          activeOperationRef.current = null;
        }
        if (ownsSave) {
          saveOwnerRef.current = null;
        }
        if (ownsSave && mountedRef.current && focusedRef.current) {
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

  if (!canAccess) {
    const gateTitle = isForeman ? "Company required" : "Foreman access required";
    const gateMessage = isForeman
      ? "Create your company before configuring pay rules."
      : "Only a foreman with a company can configure pay rules.";

    return (
      <Screen>
        <View style={styles.page} testID="pay-rules-access-gate">
          <ScreenHeader
            backAction={{ label: "Back", onPress: navigation.goBack }}
            eyebrow="Company settings"
            title="Pay rules"
          />
          <Feedback
            title={gateTitle}
            message={gateMessage}
            mode="screen"
            tone="error"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      scrollProps={{
        accessibilityLabel: "Pay rules form",
        keyboardDismissMode: "on-drag",
        testID: "pay-rules-scroll"
      }}
    >
      <View style={styles.page} testID="pay-rules-content">
        <ScreenHeader
          backAction={{
            disabled: saveTransportInFlight,
            label: "Back",
            onPress: navigation.goBack
          }}
          eyebrow="Company settings"
          subtitle="Configure versioned percentage premiums. Actual pay and rule matching are calculated by the backend."
          title="Pay rules"
        />

        {visualLoadMode === "blocking" ? (
          <Feedback
            loading
            message="Fetching the current policy and company reference settings."
            mode="screen"
            testID="pay-rules-loading"
            title="Loading pay rules"
          />
        ) : loadError || !form || !policy || !companySettings ? (
          <View style={styles.stateBlock}>
            <Feedback
              action={{
                label: "Retry",
                onPress: () => void loadPolicy(true),
                testID: "pay-rules-retry"
              }}
              title="Could not load pay rules"
              message={loadError ?? "The current policy was unavailable."}
              mode="screen"
              testID="pay-rules-load-error"
              tone="error"
            />
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <SectionHeader
                supportingText="Policy boundaries and examples use backend-returned company context, never the device timezone."
                title="Current policy"
              />
              <Card subtle testID="pay-rules-policy-summary">
                <View style={styles.readOnlyRows}>
                  <DetailRow label="Company" value={companySettings.name} />
                  <DetailRow label="Policy timezone" value={policy.timeZone} />
                  <DetailRow label="Current policy" value={`Version ${policy.version}`} />
                  <DetailRow
                    label="Worker default hourly rate"
                    value={
                      companySettings.defaultWorkerHourlyRate === null
                        ? "Not configured"
                        : String(companySettings.defaultWorkerHourlyRate)
                    }
                  />
                  <DetailRow
                    label="Currency label"
                    value={companySettings.currencyLabel ?? "Not configured"}
                  />
                </View>
              </Card>
            </View>

            {savedMessage ? (
              <Feedback
                title="Pay rules saved"
                message={savedMessage}
                testID="pay-rules-save-success"
                tone="success"
              />
            ) : null}
            {saveError ? (
              <Feedback
                title="Could not save pay rules"
                message={saveError}
                testID="pay-rules-save-error"
                tone="error"
              />
            ) : null}
            {visualLoadMode === "refreshing" ? (
              <Feedback
                loading
                title="Refreshing pay rules"
                message="Checking for the latest policy and company settings."
                testID="pay-rules-refreshing"
              />
            ) : null}
            {refreshError ? (
              <Feedback
                action={
                  freshnessState === "required-failed"
                    ? {
                        label: "Retry refresh",
                        onPress: () => void loadPolicy(true),
                        testID: "pay-rules-refresh-retry"
                      }
                    : undefined
                }
                title="Could not refresh pay rules"
                message={refreshError}
                testID="pay-rules-refresh-error"
                tone="error"
              />
            ) : null}
            {dirty ? (
              <Feedback
                message="Saving creates a new immutable policy version. Reloading may replace this draft with the current backend version."
                testID="pay-rules-dirty"
                title="Unsaved pay-rule changes"
                tone="warning"
              />
            ) : null}

            <View style={styles.section}>
              <SectionHeader
                supportingText="Choose the company-local working week and how matching premiums combine."
                title="Policy settings"
              />
              <Card testID="pay-rules-policy-settings">
                <View style={styles.cardContent}>
                  <View style={styles.controlBlock}>
                    <Text allowFontScaling style={styles.fieldLabel}>Week starts on</Text>
                    <SegmentedControl
                      accessibilityHint="Selects the first day of the working week in the policy timezone."
                      accessibilityLabel="Week starts on"
                      disabled={editingDisabled}
                      onChange={(weekStartsOn) => {
                        updateForm((current) => ({ ...current, weekStartsOn }));
                      }}
                      options={WEEK_START_OPTIONS}
                      value={form.weekStartsOn}
                      wrap
                    />
                    <Text allowFontScaling style={styles.helpText}>
                      This is the first day of the working week. Weekly overtime resets at the beginning of that day in {policy.timeZone}.
                    </Text>
                    {fieldErrors.weekStartsOn ? (
                      <Text allowFontScaling style={styles.error}>{fieldErrors.weekStartsOn}</Text>
                    ) : null}
                  </View>

                  <View style={styles.controlBlock}>
                    <Text allowFontScaling style={styles.fieldLabel}>Stacking strategy</Text>
                    <SegmentedControl
                      accessibilityHint="Selects how multiple matching premium percentages are applied."
                      accessibilityLabel="Stacking strategy"
                      disabled={editingDisabled}
                      onChange={(stackingStrategy) => {
                        updateForm((current) => ({ ...current, stackingStrategy }));
                      }}
                      options={STACKING_OPTIONS}
                      value={form.stackingStrategy}
                      wrap
                    />
                    <Text allowFontScaling style={styles.helpText}>
                      Combine all premiums adds every matching percentage to the same base rate. Use highest premium only applies the largest matching percentage.
                    </Text>
                    {fieldErrors.stackingStrategy ? (
                      <Text allowFontScaling style={styles.error}>{fieldErrors.stackingStrategy}</Text>
                    ) : null}
                  </View>
                </View>
              </Card>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionLead}>
                <SectionHeader
                  supportingText="Each card defines one backend-evaluated premium rule. Saving creates a new immutable policy version."
                  title="Premium rules"
                />
                <Button
                  accessibilityHint="Adds a new time-of-day premium rule to this draft."
                  disabled={editingDisabled}
                  label="Add rule"
                  onPress={() => {
                    updateForm((current) => ({
                      ...current,
                      rules: [...current.rules, createEmptyPayPolicyRule()]
                    }));
                  }}
                  testID="pay-rules-add-rule"
                  variant="secondary"
                />
              </View>

              {form.rules.length === 0 ? (
                <Feedback
                  title="No premium rules"
                  message="This policy applies no premiums. Add a rule to configure one."
                  testID="pay-rules-empty-rules"
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
                accessibilityHint="Validates this draft and creates a new immutable pay-policy version."
                disabled={editingDisabled || !dirty}
                label="Save as new version"
                loading={saveTransportInFlight}
                onPress={handleSave}
                testID="pay-rules-save"
              />
              <Button
                accessibilityHint="Reloads the current policy and company reference settings from the backend."
                disabled={saveTransportInFlight}
                label="Reload current policy"
                onPress={() => void loadPolicy()}
                testID="pay-rules-reload"
                variant="secondary"
              />
              <Text allowFontScaling style={styles.actionNote}>
                Actual shift premiums, salary, payroll, and payout totals remain backend-authoritative.
              </Text>
            </View>
          </>
        )}
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
  sectionLead: {
    gap: theme.space[3],
    alignItems: "flex-start"
  },
  cardContent: {
    gap: theme.space[4]
  },
  readOnlyRows: {
    gap: theme.space[1]
  },
  controlBlock: {
    gap: theme.space[2]
  },
  fieldLabel: {
    ...theme.typography.label,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  helpText: {
    ...theme.typography.supporting,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  error: {
    ...theme.typography.supporting,
    color: theme.colors.danger.fg,
    flexShrink: 1
  },
  stateBlock: {
    gap: theme.space[3]
  },
  ruleList: {
    gap: theme.space[4]
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
