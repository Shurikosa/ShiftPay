import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getErrorMessage } from "../api/errors";
import { Button } from "../components/Button";
import { FormField } from "../components/FormField";
import { RoleSelector } from "../components/RoleSelector";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { useAuth } from "../context/AuthContext";
import type { MobileRegistrationRole } from "../types/auth";
import type { AuthStackParamList } from "../types/navigation";
import { colors, spacing, typography } from "../utils/theme";
import { isBlank, isMobileRegistrationRole, isValidEmail } from "../utils/validation";

type RegisterScreenProps = NativeStackScreenProps<AuthStackParamList, "Register">;

type RegisterErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
};

export function RegisterScreen({ navigation, route }: RegisterScreenProps) {
  const initialRole = useMemo<MobileRegistrationRole>(() => {
    const role = route.params?.initialRole;
    return role && isMobileRegistrationRole(role) ? role : "WORKER";
  }, [route.params?.initialRole]);

  const { register, error: authError, clearError } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<MobileRegistrationRole>(initialRole);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

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
    if (!validate()) {
      return;
    }

    setSubmitting(true);
    setSuccessMessage(null);
    setLocalError(null);
    clearError();

    void register({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
      role
    })
      .then(() => {
        setSuccessMessage("Account created. You can log in now.");
        setPassword("");
      })
      .catch((error) => {
        setLocalError(getErrorMessage(error));
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  const errorMessage = localError ?? authError;

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Register as a worker or foreman.</Text>
        </View>

        <View style={styles.form}>
          {successMessage ? (
            <StateMessage title="Registration complete" message={successMessage} tone="success" />
          ) : null}
          {errorMessage ? (
            <StateMessage title="Registration failed" message={errorMessage} tone="error" />
          ) : null}

          <FormField
            autoCapitalize="words"
            error={errors.firstName}
            label="First name"
            onChangeText={setFirstName}
            placeholder="John"
            textContentType="givenName"
            value={firstName}
          />
          <FormField
            autoCapitalize="words"
            error={errors.lastName}
            label="Last name"
            onChangeText={setLastName}
            placeholder="Worker"
            textContentType="familyName"
            value={lastName}
          />
          <FormField
            autoComplete="email"
            error={errors.email}
            inputMode="email"
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            placeholder="worker@example.com"
            textContentType="emailAddress"
            value={email}
          />
          <FormField
            error={errors.password}
            label="Password"
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry
            textContentType="newPassword"
            value={password}
          />
          <RoleSelector onChange={setRole} value={role} />

          <Button label="Create account" loading={submitting} onPress={handleSubmit} />
          <Button
            label="Back to login"
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
    justifyContent: "center",
    gap: spacing.xxl
  },
  header: {
    gap: spacing.sm
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
