import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getErrorMessage } from "../api/errors";
import { Button } from "../components/Button";
import { FormField } from "../components/FormField";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { useAuth } from "../context/AuthContext";
import type { AuthStackParamList } from "../types/navigation";
import { colors, spacing, typography } from "../utils/theme";
import { isBlank, isValidEmail } from "../utils/validation";

type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, "Login">;

type LoginErrors = {
  email?: string;
  password?: string;
};

export function LoginScreen({ navigation }: LoginScreenProps) {
  const { signIn, error: authError, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const validate = (): boolean => {
    const nextErrors: LoginErrors = {};

    if (!isValidEmail(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (isBlank(password)) {
      nextErrors.password = "Enter your password.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      return;
    }

    setSubmitting(true);
    setLocalError(null);
    clearError();

    void signIn({
      email: email.trim(),
      password
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
          <Text style={styles.title}>ShiftPay</Text>
          <Text style={styles.subtitle}>Sign in to manage today&apos;s shift work.</Text>
        </View>

        <View style={styles.form}>
          {errorMessage ? (
            <StateMessage title="Sign in failed" message={errorMessage} tone="error" />
          ) : null}

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
            placeholder="Enter password"
            secureTextEntry
            textContentType="password"
            value={password}
          />
          <Button label="Log in" loading={submitting} onPress={handleSubmit} />
          <Button
            label="Create account"
            onPress={() => {
              navigation.navigate("Register");
            }}
            variant="secondary"
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
