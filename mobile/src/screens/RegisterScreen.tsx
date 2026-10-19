import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  View,
  type KeyboardEvent
} from "react-native";
import { getErrorMessage } from "../api/errors";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Feedback } from "../components/Feedback";
import { FormField } from "../components/FormField";
import {
  SegmentedControl,
  type SegmentedControlOption
} from "../components/SegmentedControl";
import { Screen } from "../components/Screen";
import { useAuth } from "../context/AuthContext";
import type { MobileRegistrationRole } from "../types/auth";
import type { AuthStackParamList } from "../types/navigation";
import { theme } from "../utils/theme";
import {
  isBlank,
  isMobileRegistrationRole,
  isValidEmail
} from "../utils/validation";

type RegisterScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  "Register"
>;

type RegisterErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
};

const registrationRoleOptions: readonly SegmentedControlOption<MobileRegistrationRole>[] = [
  {
    accessibilityLabel: "Role",
    accessibilityHint: "Registers an account for working shifts.",
    label: "Worker",
    testID: "register-role-worker",
    value: "WORKER"
  },
  {
    accessibilityLabel: "Role",
    accessibilityHint: "Registers an account for managing shifts.",
    label: "Foreman",
    testID: "register-role-foreman",
    value: "FOREMAN"
  }
];

function getPositiveFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function getKeyboardBottomInset(event: KeyboardEvent): number {
  return getPositiveFiniteNumber(event?.endCoordinates?.height) ?? 0;
}

export function RegisterScreen({ navigation, route }: RegisterScreenProps) {
  const requestedInitialRole: unknown = route.params?.initialRole;
  const initialRole =
    typeof requestedInitialRole === "string" &&
    isMobileRegistrationRole(requestedInitialRole)
    ? requestedInitialRole
    : "WORKER";
  const { register, error: authError, clearError } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<MobileRegistrationRole>(initialRole);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);
  const mounted = useRef(true);
  const submitInFlight = useRef(false);
  const keyboardScrollInset =
    Platform.OS === "android" && keyboardBottomInset > 0
      ? { paddingBottom: keyboardBottomInset }
      : undefined;

  useEffect(() => {
    mounted.current = true;
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
      mounted.current = false;
      showSubscription?.remove();
      hideSubscription?.remove();
    };
  }, []);

  const validate = (): boolean => {
    const nextErrors: RegisterErrors = {};

    if (isBlank(firstName)) {
      nextErrors.firstName = "Enter your first name.";
    }

    if (isBlank(lastName)) {
      nextErrors.lastName = "Enter your last name.";
    }

    if (!isValidEmail(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (password.trim().length < 8) {
      nextErrors.password = "Use at least 8 characters.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (submitInFlight.current || !validate()) {
      return;
    }

    submitInFlight.current = true;
    setSubmitting(true);
    setLocalError(null);

    const payload = {
      email: email.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password,
      role
    };

    void Promise.resolve()
      .then(() => {
        clearError();
        return register(payload);
      })
      .then(() => {
        if (mounted.current) {
          navigation.replace("Login");
        }
      })
      .catch((error) => {
        if (mounted.current) {
          setLocalError(getErrorMessage(error));
        }
      })
      .finally(() => {
        submitInFlight.current = false;
        if (mounted.current) {
          setSubmitting(false);
        }
      });
  };

  const errorMessage = localError ?? authError;

  return (
    <Screen scrollContentStyle={keyboardScrollInset}>
      <View style={styles.page} testID="register-content">
        <View style={styles.intro} testID="register-intro">
          <Text allowFontScaling style={styles.brand}>
            ShiftPay
          </Text>
          <Text
            accessibilityRole="header"
            allowFontScaling
            style={styles.title}
          >
            Create account
          </Text>
          <Text allowFontScaling style={styles.subtitle}>
            Join ShiftPay as a worker or foreman.
          </Text>
        </View>

        <Card testID="register-form-card">
          <View style={styles.form} testID="register-form-content">
            {errorMessage ? (
              <Feedback
                message={errorMessage}
                testID="register-feedback"
                title="Registration failed"
                tone="error"
              />
            ) : null}

            <View style={styles.group} testID="register-identity-group">
              <Text allowFontScaling style={styles.groupTitle}>
                Your details
              </Text>
              <View style={styles.fields}>
                <FormField
                  autoCapitalize="words"
                  autoComplete="given-name"
                  editable={!submitting}
                  error={errors.firstName}
                  label="First name"
                  leadingIcon="person"
                  onChangeText={setFirstName}
                  placeholder="John"
                  returnKeyType="next"
                  textContentType="givenName"
                  value={firstName}
                />
                <FormField
                  autoCapitalize="words"
                  autoComplete="family-name"
                  editable={!submitting}
                  error={errors.lastName}
                  label="Last name"
                  leadingIcon="person"
                  onChangeText={setLastName}
                  placeholder="Worker"
                  returnKeyType="next"
                  textContentType="familyName"
                  value={lastName}
                />
              </View>
            </View>

            <View style={styles.group} testID="register-account-group">
              <Text allowFontScaling style={styles.groupTitle}>
                Account
              </Text>
              <View style={styles.fields}>
                <FormField
                  autoComplete="email"
                  editable={!submitting}
                  error={errors.email}
                  inputMode="email"
                  keyboardType="email-address"
                  label="Email"
                  leadingIcon="email"
                  onChangeText={setEmail}
                  placeholder="worker@example.com"
                  returnKeyType="next"
                  textContentType="emailAddress"
                  value={email}
                />
                <FormField
                  autoComplete="new-password"
                  editable={!submitting}
                  error={errors.password}
                  label="Password"
                  leadingIcon="password"
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  returnKeyType="done"
                  secureTextEntry
                  textContentType="newPassword"
                  value={password}
                />
              </View>
            </View>

            <View style={styles.group} testID="register-role-group">
              <View style={styles.groupHeader}>
                <Text allowFontScaling style={styles.groupTitle}>
                  Role
                </Text>
                <Text allowFontScaling style={styles.groupDescription}>
                  Choose how you will use ShiftPay.
                </Text>
              </View>
              <SegmentedControl
                accessibilityLabel="Role"
                disabled={submitting}
                onChange={setRole}
                options={registrationRoleOptions}
                testID="register-role-selector"
                value={role}
                wrap
              />
            </View>

            <View style={styles.actions} testID="register-actions">
              <Button
                label="Create account"
                loading={submitting}
                onPress={handleSubmit}
                testID="register-submit"
                trailingIcon="forward"
              />
              <Button
                label="Back to login"
                leadingIcon="back"
                onPress={() => {
                  navigation.goBack();
                }}
                testID="register-back"
                variant="secondary"
              />
            </View>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flexShrink: 1,
    gap: theme.gap.section,
    maxWidth: "100%",
    width: "100%"
  },
  intro: {
    flexShrink: 1,
    gap: theme.space[2],
    maxWidth: "100%"
  },
  brand: {
    ...theme.typography.screenTitle,
    color: theme.colors.brand.primary,
    flexShrink: 1
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  form: {
    flexShrink: 1,
    gap: theme.space[6],
    maxWidth: "100%"
  },
  group: {
    flexShrink: 1,
    gap: theme.space[3],
    maxWidth: "100%"
  },
  groupHeader: {
    flexShrink: 1,
    gap: theme.space[1],
    maxWidth: "100%"
  },
  groupTitle: {
    ...theme.typography.cardTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  groupDescription: {
    ...theme.typography.supporting,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  fields: {
    flexShrink: 1,
    gap: theme.space[4],
    maxWidth: "100%"
  },
  actions: {
    flexShrink: 1,
    gap: theme.space[3],
    maxWidth: "100%"
  }
});
