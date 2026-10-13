import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type KeyboardEvent,
  type ImageSourcePropType
} from "react-native";
import { getErrorMessage } from "../api/errors";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { FormField } from "../components/FormField";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { useAuth } from "../context/AuthContext";
import type { AuthStackParamList } from "../types/navigation";
import { theme } from "../utils/theme";
import { isBlank, isValidEmail } from "../utils/validation";

type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, "Login">;

type LoginErrors = {
  email?: string;
  password?: string;
};

const loginHero = require(
  "../../assets/images/login-hero.png"
) as ImageSourcePropType;

const heroSourceWidth = 300;
const heroSourceHeight = 198;
const heroStageMinimumHeight = theme.target.min * 6;
const heroStageMaximumHeight = theme.target.min * 8.25;
const heroStageWidthRatio = 0.88;
// A normal phone viewport keeps native geometry usable if a platform or test
// supplies a malformed runtime dimension.
const fallbackPhoneViewportWidth = 360;

function getUsableViewportWidth(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallbackPhoneViewportWidth;
}

function getKeyboardBottomInset(event: KeyboardEvent): number {
  const height = event?.endCoordinates?.height;

  return typeof height === "number" && Number.isFinite(height) && height > 0
    ? height
    : 0;
}

export function LoginScreen({ navigation }: LoginScreenProps) {
  const { signIn, error: authError, clearError } = useAuth();
  const { width: viewportWidth } = useWindowDimensions();
  const usableViewportWidth = getUsableViewportWidth(viewportWidth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);
  const submitInFlight = useRef(false);
  const heroStageMinHeight = Math.max(
    heroStageMinimumHeight,
    Math.min(
      heroStageMaximumHeight,
      usableViewportWidth * heroStageWidthRatio
    )
  );
  const heroImageHeight = Math.min(
    heroStageMinHeight,
    usableViewportWidth * (heroSourceHeight / heroSourceWidth)
  );
  const keyboardScrollInset =
    Platform.OS === "android" && keyboardBottomInset > 0
      ? { paddingBottom: keyboardBottomInset }
      : undefined;

  useEffect(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }

    let active = true;
    const showSubscription = Keyboard.addListener(
      "keyboardDidShow",
      (event) => {
        if (active) {
          setKeyboardBottomInset(getKeyboardBottomInset(event));
        }
      }
    );
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      if (active) {
        setKeyboardBottomInset(0);
      }
    });

    return () => {
      active = false;
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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
    if (submitInFlight.current) {
      return;
    }

    if (!validate()) {
      return;
    }

    submitInFlight.current = true;
    setSubmitting(true);
    setLocalError(null);

    const credentials = {
      email: email.trim(),
      password
    };

    void Promise.resolve()
      .then(() => {
        clearError();
        return signIn(credentials);
      })
      .catch((error) => {
        setLocalError(getErrorMessage(error));
      })
      .finally(() => {
        submitInFlight.current = false;
        setSubmitting(false);
      });
  };

  const errorMessage = localError ?? authError;

  return (
    <Screen
      contentStyle={styles.screenContent}
      scrollContentStyle={keyboardScrollInset}
    >
      <View style={styles.page} testID="login-content">
        <View
          style={[styles.heroStage, { minHeight: heroStageMinHeight }]}
          testID="login-hero-stage"
        >
          <Image
            accessibilityElementsHidden
            accessible={false}
            aria-hidden
            importantForAccessibility="no-hide-descendants"
            resizeMode="cover"
            source={loginHero}
            style={[
              styles.heroImage,
              {
                height: heroImageHeight,
                width: usableViewportWidth
              }
            ]}
            testID="login-hero"
          />
          <View style={styles.intro} testID="login-intro">
            <Text allowFontScaling style={styles.brand}>
              ShiftPay
            </Text>
            <Text
              accessibilityRole="header"
              allowFontScaling
              style={styles.title}
            >
              Welcome back
            </Text>
            <Text allowFontScaling style={styles.subtitle}>
              Sign in to manage your shifts and payroll.
            </Text>
          </View>
        </View>

        <Card style={styles.formCardOffset} testID="login-form-card">
          <View style={styles.form} testID="login-form-content">
            {errorMessage ? (
              <StateMessage
                message={errorMessage}
                title="Sign in failed"
                tone="error"
              />
            ) : null}

            <FormField
              autoComplete="email"
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
              autoComplete="current-password"
              error={errors.password}
              label="Password"
              leadingIcon="password"
              onChangeText={setPassword}
              placeholder="Enter password"
              returnKeyType="done"
              secureTextEntry={!passwordVisible}
              textContentType="password"
              trailingAction={{
                accessibilityHint: passwordVisible
                  ? "Conceals your password."
                  : "Reveals your password.",
                icon: passwordVisible ? "visibilityOff" : "visibilityOn",
                label: passwordVisible ? "Hide" : "Show",
                onPress: () => {
                  setPasswordVisible((visible) => !visible);
                },
                testID: "password-visibility-action"
              }}
              value={password}
            />
            <Button
              label="Log in"
              loading={submitting}
              onPress={handleSubmit}
              testID="login-submit"
              trailingIcon="forward"
            />

            <View style={styles.divider} testID="login-divider">
              <View
                accessibilityElementsHidden
                accessible={false}
                aria-hidden
                importantForAccessibility="no-hide-descendants"
                style={styles.dividerLine}
              />
              <Text allowFontScaling style={styles.dividerLabel}>
                or
              </Text>
              <View
                accessibilityElementsHidden
                accessible={false}
                aria-hidden
                importantForAccessibility="no-hide-descendants"
                style={styles.dividerLine}
              />
            </View>

            <Button
              label="Create account"
              onPress={() => {
                navigation.navigate("Register");
              }}
              testID="create-account"
              variant="secondary"
            />
          </View>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 0
  },
  page: {
    flexShrink: 1,
    maxWidth: "100%",
    width: "100%"
  },
  intro: {
    flexShrink: 1,
    gap: theme.space[2],
    maxWidth: "100%",
    paddingHorizontal: theme.inset.screen
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
    fontSize: theme.typography.sectionTitle.fontSize,
    flexShrink: 1
  },
  heroStage: {
    maxWidth: "100%",
    width: "100%"
  },
  heroImage: {
    bottom: 0,
    left: 0,
    pointerEvents: "none",
    position: "absolute"
  },
  formCardOffset: {
    marginHorizontal: theme.inset.screen,
    marginTop: -theme.space[4]
  },
  form: {
    flexShrink: 1,
    gap: theme.space[4],
    maxWidth: "100%"
  },
  divider: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: theme.space[3],
    maxWidth: "100%"
  },
  dividerLine: {
    borderTopColor: theme.colors.border,
    borderTopWidth: theme.border.default,
    flex: 1
  },
  dividerLabel: {
    ...theme.typography.supporting,
    color: theme.colors.ink.muted,
    flexShrink: 1,
    textAlign: "center"
  }
});
