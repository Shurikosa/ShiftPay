import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getMyPayPolicy, updateMyPayPolicy } from "../api/payPolicy";
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

const STACKING_OPTIONS: readonly SegmentedControlOption<PayPolicyStackingStrategy>[] = [
  { value: "ADD", label: "ADD" },
  { value: "HIGHEST_ONLY", label: "HIGHEST_ONLY" }
];

const WEEK_START_OPTIONS: readonly SegmentedControlOption<PayPolicyWeekday>[] =
  PAY_POLICY_WEEKDAYS.map((weekday) => ({
    value: weekday,
    label: weekday.slice(0, 3)
  }));

export function ForemanPayRulesScreen({ navigation }: ForemanPayRulesScreenProps) {
  const { authenticatedRequest, user } = useAuth();
  const [policy, setPolicy] = useState<PayPolicy | null>(null);
  const [editor, setEditor] = useState<PayPolicyEditorState>({
    form: null,
    fieldErrors: {}
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const { form, fieldErrors } = editor;

  const loadPolicy = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const nextPolicy = await authenticatedRequest((token) => getMyPayPolicy(token));
      setPolicy(nextPolicy);
      setEditor({
        form: hydratePayPolicyForm(nextPolicy),
        fieldErrors: {}
      });
      setSaveError(null);
      setSavedMessage(null);
    } catch {
      setLoadError("Could not load pay rules. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest]);

  useFocusEffect(
    useCallback(() => {
      void loadPolicy();
      return undefined;
    }, [loadPolicy])
  );

  const updateForm = (updater: (current: PayPolicyForm) => PayPolicyForm) => {
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
    if (!form || saving) {
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
    setSaving(true);
    setEditor((current) => ({ ...current, fieldErrors: {} }));
    setSaveError(null);
    setSavedMessage(null);

    void authenticatedRequest((token) => updateMyPayPolicy(token, payload))
      .then((updatedPolicy) => {
        setPolicy(updatedPolicy);
        setEditor({
          form: hydratePayPolicyForm(updatedPolicy),
          fieldErrors: {}
        });
        setSavedMessage(
          `Version ${updatedPolicy.version} is now current. Earlier versions remain unchanged.`
        );
      })
      .catch((caughtError) => {
        const mappedError = mapPayPolicySaveError(caughtError, form);
        setEditor((current) => ({
          ...current,
          fieldErrors: mappedError.fieldErrors
        }));
        setSaveError(mappedError.generalError ?? "Review the highlighted field.");
      })
      .finally(() => {
        setSaving(false);
      });
  };

  if (!user?.company) {
    return (
      <Screen>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.kicker}>Foreman settings</Text>
            <Text style={styles.title}>Pay rules</Text>
          </View>
          <StateMessage
            title="Company required"
            message="Create your company before configuring pay rules."
            tone="error"
          />
          <Button label="Back to dashboard" onPress={navigation.goBack} variant="ghost" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Foreman settings</Text>
          <Text style={styles.title}>Pay rules</Text>
          <Text style={styles.subtitle}>
            Configure percentage premiums. Pay results are calculated by the backend.
          </Text>
        </View>

        {loading ? (
          <StateMessage loading title="Loading pay rules" message="Fetching current policy." />
        ) : loadError || !form || !policy ? (
          <View style={styles.stateBlock}>
            <StateMessage
              title="Could not load pay rules"
              message={loadError ?? "The current policy was unavailable."}
              tone="error"
            />
            <Button label="Retry" onPress={() => void loadPolicy()} variant="secondary" />
            <Button label="Back to dashboard" onPress={navigation.goBack} variant="ghost" />
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

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Policy settings</Text>

              <View style={styles.controlBlock}>
                <Text style={styles.fieldLabel}>Week starts on</Text>
                <SegmentedControl
                  accessibilityLabel="Week starts on"
                  disabled={saving}
                  onChange={(weekStartsOn) => {
                    updateForm((current) => ({ ...current, weekStartsOn }));
                  }}
                  options={WEEK_START_OPTIONS}
                  value={form.weekStartsOn}
                  wrap
                />
                {fieldErrors.weekStartsOn ? (
                  <Text style={styles.error}>{fieldErrors.weekStartsOn}</Text>
                ) : null}
              </View>

              <View style={styles.controlBlock}>
                <Text style={styles.fieldLabel}>Stacking strategy</Text>
                <SegmentedControl
                  accessibilityLabel="Stacking strategy"
                  disabled={saving}
                  onChange={(stackingStrategy) => {
                    updateForm((current) => ({ ...current, stackingStrategy }));
                  }}
                  options={STACKING_OPTIONS}
                  value={form.stackingStrategy}
                />
                <Text style={styles.helpText}>
                  ADD combines matching premiums. HIGHEST_ONLY uses the largest matching
                  premium.
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
                  disabled={saving}
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
                      disabled={saving}
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
                      rule={rule}
                    />
                  ))}
                </View>
              )}
            </View>

            <View style={styles.actions}>
              <Button label="Save as new version" loading={saving} onPress={handleSave} />
              <Button
                disabled={saving}
                label="Reload current policy"
                onPress={() => void loadPolicy()}
                variant="secondary"
              />
              <Button
                disabled={saving}
                label="Back to dashboard"
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
