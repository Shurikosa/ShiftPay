import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { joinCompany } from "../api/companies";
import { getErrorMessage } from "../api/errors";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Feedback } from "../components/Feedback";
import { FormField } from "../components/FormField";
import { Screen } from "../components/Screen";
import { useAuth } from "../context/AuthContext";
import { theme } from "../utils/theme";
import { isBlank } from "../utils/validation";

export function JoinCompanyScreen() {
  const { applyCompany, authenticatedRequest, refreshCurrentUser, signOut } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [joinCodeError, setJoinCodeError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const submitInFlight = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleJoinCodeChange = (value: string) => {
    setJoinCode(value.toUpperCase());
    setJoinCodeError(undefined);
    setError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = () => {
    if (submitInFlight.current) {
      return;
    }

    const normalizedJoinCode = joinCode.trim().toUpperCase();

    if (isBlank(normalizedJoinCode)) {
      setJoinCodeError("Enter a company join code.");
      return;
    }

    submitInFlight.current = true;
    setSubmitting(true);
    setJoinCodeError(undefined);
    setError(null);
    setSuccessMessage(null);

    void Promise.resolve()
      .then(() =>
        authenticatedRequest((token) =>
          joinCompany(token, {
            joinCode: normalizedJoinCode
          })
        )
      )
      .then(async (company) => {
        if (!mountedRef.current) {
          return;
        }

        setSuccessMessage(`Joined ${company.name}.`);
        await applyCompany(company);

        try {
          await refreshCurrentUser();
        } catch (refreshError) {
          console.warn("Failed to refresh user after company join.", refreshError);
        }
      })
      .catch((caughtError) => {
        if (!mountedRef.current) {
          return;
        }

        setSuccessMessage(null);
        setError(getErrorMessage(caughtError));
      })
      .finally(() => {
        submitInFlight.current = false;
        if (mountedRef.current) {
          setSubmitting(false);
        }
      });
  };

  const handleLogout = () => {
    if (submitInFlight.current) {
      return;
    }

    void signOut();
  };

  return (
    <Screen scroll>
      <View style={styles.page} testID="join-company-content">
        <View style={styles.header} testID="join-company-header">
          <Text allowFontScaling style={styles.brand}>
            ShiftPay
          </Text>
          <Text allowFontScaling style={styles.eyebrow}>
            Worker setup
          </Text>
          <Text accessibilityRole="header" allowFontScaling style={styles.title}>
            Join company
          </Text>
          <Text allowFontScaling style={styles.supporting}>
            Enter the company join code shared by your foreman.
          </Text>
        </View>

        <Card testID="join-company-card">
          <View style={styles.form} testID="join-company-form">
            <FormField
              accessibilityHint="Enter the code shared by your foreman."
              allowFontScaling
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!submitting}
              error={joinCodeError}
              label="Company join code"
              leadingIcon="company"
              onChangeText={handleJoinCodeChange}
              onSubmitEditing={handleSubmit}
              placeholder="CMP123"
              returnKeyType="done"
              submitBehavior="submit"
              testID="company-join-code-input"
              value={joinCode}
            />

            {successMessage ? (
              <Feedback
                message={successMessage}
                testID="join-company-success"
                title="Company joined"
                tone="success"
              />
            ) : null}
            {error ? (
              <Feedback
                message={error}
                testID="join-company-error"
                title="Could not join company"
                tone="error"
              />
            ) : null}

            <Button
              accessibilityHint="Joins the company using this code."
              disabled={submitting}
              label="Join company"
              leadingIcon="join"
              loading={submitting}
              onPress={handleSubmit}
              testID="join-company-submit"
            />
          </View>
        </Card>

        <View style={styles.recovery} testID="join-company-recovery">
          <Button
            accessibilityHint="Signs out of this account and returns to the sign-in flow."
            disabled={submitting}
            label="Log out"
            leadingIcon="logout"
            onPress={handleLogout}
            testID="join-company-logout"
            variant="ghost"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    justifyContent: "center",
    gap: theme.gap.section,
    maxWidth: "100%",
    width: "100%"
  },
  header: {
    flexShrink: 1,
    gap: theme.space[2],
    maxWidth: "100%"
  },
  brand: {
    ...theme.typography.screenTitle,
    color: theme.colors.brand.primary,
    flexShrink: 1
  },
  eyebrow: {
    ...theme.typography.label,
    color: theme.colors.brand.primary,
    flexShrink: 1
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  supporting: {
    ...theme.typography.body,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  form: {
    flexShrink: 1,
    gap: theme.space[4],
    maxWidth: "100%"
  },
  recovery: {
    alignSelf: "stretch",
    flexShrink: 1,
    maxWidth: "100%"
  }
});
