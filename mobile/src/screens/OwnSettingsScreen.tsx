import type { NavigationProp } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import {
  cancelEmailChange,
  confirmEmailChange,
  getPendingEmailChange,
  resendEmailChange,
  startEmailChange,
  updateMyName,
  updateMyPassword
} from "../api/auth";
import { ApiError, getErrorMessage } from "../api/errors";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Feedback, type FeedbackTone } from "../components/Feedback";
import { FormField } from "../components/FormField";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { useAuth } from "../context/AuthContext";
import type { ForemanStackParamList } from "../types/navigation";
import type { PendingEmailChange } from "../types/auth";
import { theme } from "../utils/theme";
import { isBlank, isValidEmail } from "../utils/validation";

type SettingsNavigation = NavigationProp<
  Pick<ForemanStackParamList, "OwnSettings" | "ForemanCompanySettings">
>;

type BusyOperation =
  | "pending-load"
  | "name"
  | "email-start"
  | "email-confirm"
  | "email-resend"
  | "email-cancel"
  | "email-reconcile"
  | "password"
  | null;

type Notice = {
  title: string;
  message: string;
  tone: FeedbackTone;
} | null;

type PendingReadReason =
  | "initial"
  | "reconcile"
  | "absolute-expiry"
  | "code-expiry"
  | "resume";

function formatInstant(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function secondsUntil(value: string, now: number): number {
  const target = new Date(value).getTime();
  return Number.isFinite(target) ? Math.max(0, Math.ceil((target - now) / 1000)) : 0;
}

function codeOf(error: unknown): string | undefined {
  return error instanceof ApiError ? error.details?.code : undefined;
}

export function OwnSettingsScreen() {
  const navigation = useNavigation<SettingsNavigation>();
  const {
    applyCurrentUser,
    authenticatedRequest,
    reconcileCredentialSession,
    replaceSession,
    user
  } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pending, setPending] = useState<PendingEmailChange | null>(null);
  const [pendingUnknown, setPendingUnknown] = useState(false);
  const [expiryRetriesExhausted, setExpiryRetriesExhausted] = useState(false);
  const [resendsExhausted, setResendsExhausted] = useState(false);
  const [codeExpiredConfirmed, setCodeExpiredConfirmed] = useState(false);
  const [startRateLimitedUntil, setStartRateLimitedUntil] = useState<number | null>(null);
  const [resendRateLimitedUntil, setResendRateLimitedUntil] = useState<number | null>(null);
  const [passwordRateLimitedUntil, setPasswordRateLimitedUntil] = useState<number | null>(null);
  const [emailNotice, setEmailNotice] = useState<Notice>(null);
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [passwordNew, setPasswordNew] = useState("");
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [nameNotice, setNameNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<BusyOperation>("pending-load");
  const [now, setNow] = useState(0);
  const mountedRef = useRef(true);
  const mutationRef = useRef(false);
  const emailOperationRef = useRef(0);
  const pendingReadInFlightRef = useRef<number | null>(null);
  const expiryDeadlineRef = useRef<string | null>(null);
  const expiryRetryAttemptRef = useRef(0);
  const expiryNextCheckAtRef = useRef(0);
  const expiryRetriesExhaustedRef = useRef(false);
  const expiryWakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeCheckPendingRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const readPendingStateLatestRef = useRef<(
    reason?: PendingReadReason,
    allowDuringMutation?: boolean
  ) => Promise<void>>(async () => undefined);

  const clearExpiryWakeTimer = useCallback(() => {
    if (expiryWakeTimerRef.current !== null) {
      clearTimeout(expiryWakeTimerRef.current);
      expiryWakeTimerRef.current = null;
    }
  }, []);

  const setExpiryRetryExhausted = useCallback((exhausted: boolean) => {
    expiryRetriesExhaustedRef.current = exhausted;
    setExpiryRetriesExhausted(exhausted);
  }, []);

  const resetPendingRequestState = useCallback(() => {
    setVerificationCode("");
    setResendsExhausted(false);
    setResendRateLimitedUntil(null);
    setCodeExpiredConfirmed(false);
    clearExpiryWakeTimer();
    expiryDeadlineRef.current = null;
    expiryRetryAttemptRef.current = 0;
    expiryNextCheckAtRef.current = 0;
    setExpiryRetryExhausted(false);
  }, [clearExpiryWakeTimer, setExpiryRetryExhausted]);

  const completePendingRequest = useCallback(() => {
    setPending(null);
    setPendingUnknown(false);
    resetPendingRequestState();
  }, [resetPendingRequestState]);

  const acceptPendingRequest = useCallback((result: PendingEmailChange) => {
    resetPendingRequestState();
    setPending(result);
    setPendingUnknown(false);
    expiryDeadlineRef.current = result.expiresAt;
  }, [resetPendingRequestState]);

  const scheduleNextExpiryRetry = useCallback(() => {
    const retryDelays = [5_000, 15_000, 30_000] as const;
    const retryDelay = retryDelays[expiryRetryAttemptRef.current];
    expiryRetryAttemptRef.current += 1;
    clearExpiryWakeTimer();
    if (retryDelay === undefined) {
      expiryNextCheckAtRef.current = Number.POSITIVE_INFINITY;
      setExpiryRetryExhausted(true);
      return;
    }

    expiryNextCheckAtRef.current = Date.now() + retryDelay;
    setExpiryRetryExhausted(false);
    expiryWakeTimerRef.current = setTimeout(() => {
      expiryWakeTimerRef.current = null;
      if (mountedRef.current) setNow(Date.now());
    }, retryDelay);
  }, [clearExpiryWakeTimer, setExpiryRetryExhausted]);

  useEffect(() => {
    const initialTimer = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, []);

  const readPendingState = useCallback(async (
    reason: PendingReadReason = "initial",
    allowDuringMutation = false
  ) => {
    if (mutationRef.current && !allowDuringMutation) {
      if (reason === "resume") resumeCheckPendingRef.current = true;
      return;
    }
    if (
      pendingReadInFlightRef.current !== null &&
      pendingReadInFlightRef.current === emailOperationRef.current
    ) {
      if (reason === "resume") resumeCheckPendingRef.current = true;
      return;
    }

    const operationId = ++emailOperationRef.current;
    pendingReadInFlightRef.current = operationId;
    if (reason === "absolute-expiry") {
      expiryNextCheckAtRef.current = Number.POSITIVE_INFINITY;
    }
    const reconciling = reason !== "initial";
    setBusy(reconciling ? "email-reconcile" : "pending-load");
    try {
      const result = await authenticatedRequest(getPendingEmailChange);
      if (!mountedRef.current || operationId !== emailOperationRef.current) return;
      setPendingUnknown(false);
      setResendsExhausted(false);
      setCodeExpiredConfirmed(
        result
          ? reason === "code-expiry" ||
              secondsUntil(result.codeExpiresAt, Date.now()) === 0
          : false
      );
      if (!result) {
        completePendingRequest();
      } else if (
        secondsUntil(result.expiresAt, Date.now()) === 0 &&
        !expiryRetriesExhaustedRef.current &&
        (reason === "absolute-expiry" ||
          expiryNextCheckAtRef.current === Number.POSITIVE_INFINITY ||
          (reason === "resume" &&
            Number.isFinite(expiryNextCheckAtRef.current) &&
            Date.now() >= expiryNextCheckAtRef.current))
      ) {
        scheduleNextExpiryRetry();
      } else if (secondsUntil(result.expiresAt, Date.now()) > 0) {
        clearExpiryWakeTimer();
        expiryRetryAttemptRef.current = 0;
        expiryNextCheckAtRef.current = 0;
        setExpiryRetryExhausted(false);
      }
      if (result) setPending(result);
      if (reconciling) {
        if (reason === "absolute-expiry") {
          setEmailNotice(
            result
              ? { title: "Email change status refreshed", message: "The server still reports this pending change as active.", tone: "info" }
              : { title: "Email change expired", message: "Start a new email change with your current password.", tone: "warning" }
          );
        } else if (reason === "code-expiry") {
          setEmailNotice(
            result
              ? { title: "Code expired", message: "Request a resend if one remains available.", tone: "warning" }
              : { title: "Email change expired", message: "Start a new email change with your current password.", tone: "warning" }
          );
        } else {
          setEmailNotice(
            result
              ? { title: "Verification restored", message: "The current pending email change was restored safely.", tone: "info" }
              : { title: "No pending change", message: "No email change was accepted. You can start again.", tone: "warning" }
          );
        }
      }
    } catch (error) {
      if (!mountedRef.current || operationId !== emailOperationRef.current) return;
      setPendingUnknown(true);
      setEmailNotice({
        title: "Could not check email status",
        message: getErrorMessage(error),
        tone: "error"
      });
    } finally {
      if (pendingReadInFlightRef.current === operationId) {
        pendingReadInFlightRef.current = null;
      }
      if (mountedRef.current && operationId === emailOperationRef.current) setBusy(null);
      if (
        mountedRef.current &&
        operationId === emailOperationRef.current &&
        !mutationRef.current &&
        resumeCheckPendingRef.current
      ) {
        resumeCheckPendingRef.current = false;
        void Promise.resolve().then(() => {
          if (mountedRef.current) {
            return readPendingStateLatestRef.current("resume");
          }
          return undefined;
        });
      }
    }
  }, [
    authenticatedRequest,
    clearExpiryWakeTimer,
    completePendingRequest,
    scheduleNextExpiryRetry,
    setExpiryRetryExhausted
  ]);

  useEffect(() => {
    readPendingStateLatestRef.current = readPendingState;
  }, [readPendingState]);

  useEffect(() => {
    mountedRef.current = true;
    void Promise.resolve().then(() => readPendingState("initial"));
    return () => {
      mountedRef.current = false;
      emailOperationRef.current += 1;
      pendingReadInFlightRef.current = null;
      clearExpiryWakeTimer();
    };
  }, [clearExpiryWakeTimer, readPendingState]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const returningToActive =
        nextState === "active" &&
        (appStateRef.current === "background" || appStateRef.current === "inactive");
      appStateRef.current = nextState;
      if (returningToActive) void readPendingState("resume");
    });

    return () => subscription.remove();
  }, [readPendingState]);

  useEffect(() => {
    if (!pending) {
      clearExpiryWakeTimer();
      expiryDeadlineRef.current = null;
      expiryRetryAttemptRef.current = 0;
      expiryNextCheckAtRef.current = 0;
      if (expiryRetriesExhaustedRef.current) setExpiryRetryExhausted(false);
      return;
    }
    if (expiryDeadlineRef.current !== pending.expiresAt) {
      clearExpiryWakeTimer();
      expiryDeadlineRef.current = pending.expiresAt;
      expiryRetryAttemptRef.current = 0;
      expiryNextCheckAtRef.current = 0;
      setExpiryRetryExhausted(false);
    }
    if (
      now === 0 ||
      secondsUntil(pending.expiresAt, now) > 0 ||
      appStateRef.current === "background" ||
      appStateRef.current === "inactive" ||
      mutationRef.current ||
      busy !== null ||
      now < expiryNextCheckAtRef.current
    ) return;

    void readPendingState("absolute-expiry");
  }, [busy, clearExpiryWakeTimer, now, pending, readPendingState, setExpiryRetryExhausted]);

  const beginMutation = (operation: Exclude<BusyOperation, null>): boolean => {
    if (mutationRef.current) return false;
    mutationRef.current = true;
    setBusy(operation);
    return true;
  };

  const endMutation = () => {
    mutationRef.current = false;
    if (
      pending &&
      secondsUntil(pending.expiresAt, Date.now()) === 0 &&
      expiryNextCheckAtRef.current === Number.POSITIVE_INFINITY &&
      !expiryRetriesExhaustedRef.current
    ) {
      expiryNextCheckAtRef.current = 0;
    }
    if (mountedRef.current) setBusy(null);
    if (resumeCheckPendingRef.current) {
      resumeCheckPendingRef.current = false;
      void readPendingState("resume");
    }
  };

  const beginEmailMutation = (
    operation: Exclude<BusyOperation, null>
  ): number | null => {
    if (!beginMutation(operation)) return null;
    clearExpiryWakeTimer();
    if (
      pending &&
      secondsUntil(pending.expiresAt, Date.now()) === 0 &&
      !expiryRetriesExhaustedRef.current
    ) {
      expiryNextCheckAtRef.current = 0;
    }
    return ++emailOperationRef.current;
  };

  const isCurrentEmailOperation = (operationId: number): boolean =>
    mountedRef.current && operationId === emailOperationRef.current;

  const reconcileCredentialError = async (
    error: unknown,
    staleToken: string | null
  ): Promise<boolean> => {
    const code = codeOf(error);
    if (
      staleToken &&
      error instanceof ApiError &&
      error.status === 409 &&
      code === "CREDENTIAL_VERSION_CONFLICT"
    ) {
      await reconcileCredentialSession(staleToken);
      return true;
    }
    return false;
  };

  const handleNameSave = async () => {
    if (!beginMutation("name")) return;
    setNameNotice(null);
    setNameError(null);
    if (isBlank(firstName) || isBlank(lastName)) {
      setNameError("Enter both first and last name.");
      endMutation();
      return;
    }
    try {
      const updated = await authenticatedRequest((token) =>
        updateMyName(token, { firstName, lastName })
      );
      await applyCurrentUser(updated);
      if (mountedRef.current) {
        setFirstName(updated.firstName);
        setLastName(updated.lastName);
        setNameNotice({ title: "Name saved", message: "Your profile name is up to date.", tone: "success" });
      }
    } catch (error) {
      if (mountedRef.current) setNameNotice({ title: "Could not save name", message: getErrorMessage(error), tone: "error" });
    } finally {
      endMutation();
    }
  };

  const retryAfterDeadline = (error: unknown): number | null => {
    if (error instanceof ApiError && error.status === 429 && error.retryAfterSeconds !== undefined) {
      return Date.now() + error.retryAfterSeconds * 1000;
    }
    return null;
  };

  const handleEmailStart = async () => {
    const operationId = beginEmailMutation("email-start");
    if (operationId === null) return;
    setEmailNotice(null);
    if (!isValidEmail(newEmail) || isBlank(emailPassword)) {
      setEmailNotice({ title: "Check email details", message: "Enter a valid new email and your current password.", tone: "error" });
      setEmailPassword("");
      endMutation();
      return;
    }
    try {
      const result = await authenticatedRequest((token) =>
        startEmailChange(token, { currentPassword: emailPassword, newEmail })
      );
      if (isCurrentEmailOperation(operationId)) {
        acceptPendingRequest(result);
        setStartRateLimitedUntil(null);
        setNewEmail("");
        setEmailNotice({ title: "Verification sent", message: "Enter the six-digit code sent to the pending address.", tone: "success" });
      }
    } catch (error) {
      if (!isCurrentEmailOperation(operationId)) return;
      const retryDeadline = retryAfterDeadline(error);
      if (retryDeadline) setStartRateLimitedUntil(retryDeadline);
      if (error instanceof ApiError && error.status === 0) {
        setPendingUnknown(true);
        await readPendingState("reconcile", true);
      } else if (codeOf(error) === "EMAIL_CHANGE_ALREADY_PENDING") {
        await readPendingState("reconcile", true);
      } else {
        setEmailNotice({ title: "Could not start email change", message: getErrorMessage(error), tone: "error" });
      }
    } finally {
      if (mountedRef.current) setEmailPassword("");
      endMutation();
    }
  };

  const handleEmailConfirm = async () => {
    const operationId = beginEmailMutation("email-confirm");
    if (operationId === null) return;
    setEmailNotice(null);
    if (!/^\d{6}$/.test(verificationCode)) {
      setEmailNotice({ title: "Invalid code", message: "Enter the six-digit verification code.", tone: "error" });
      setVerificationCode("");
      endMutation();
      return;
    }
    let staleToken: string | null = null;
    try {
      const replacement = await authenticatedRequest((token) => {
        staleToken = token;
        return confirmEmailChange(token, { code: verificationCode });
      });
      await replaceSession(replacement);
      if (isCurrentEmailOperation(operationId)) {
        completePendingRequest();
        setEmailNotice({ title: "Email changed", message: "Your replacement session is stored securely.", tone: "success" });
      }
    } catch (error) {
      if (!isCurrentEmailOperation(operationId)) return;
      if (await reconcileCredentialError(error, staleToken)) return;
      const code = codeOf(error);
      if (code === "EMAIL_VERIFICATION_ATTEMPTS_EXHAUSTED") {
        if (isCurrentEmailOperation(operationId)) {
          completePendingRequest();
          setEmailNotice({ title: "Verification ended", message: "All verification attempts were used. Start a new email change.", tone: "error" });
        }
      } else if (code === "EMAIL_CHANGE_EXPIRED") {
        await readPendingState("absolute-expiry", true);
      } else if (code === "EMAIL_ALREADY_IN_USE") {
        if (isCurrentEmailOperation(operationId)) {
          completePendingRequest();
          setEmailNotice({ title: "Email unavailable", message: getErrorMessage(error), tone: "error" });
        }
      } else if (code === "EMAIL_VERIFICATION_CODE_EXPIRED") {
        setCodeExpiredConfirmed(true);
        await readPendingState("code-expiry", true);
      } else if (isCurrentEmailOperation(operationId)) {
        const attempts = error instanceof ApiError ? error.details?.attemptsRemaining : undefined;
        setEmailNotice({
          title: code === "EMAIL_VERIFICATION_CODE_EXPIRED" ? "Code expired" : "Could not confirm email",
          message: attempts === undefined ? getErrorMessage(error) : `${getErrorMessage(error)} Attempts remaining: ${attempts}.`,
          tone: "error"
        });
        if (attempts !== undefined && pending) setPending({ ...pending, attemptsRemaining: attempts });
      }
    } finally {
      if (mountedRef.current) setVerificationCode("");
      endMutation();
    }
  };

  const handleEmailResend = async () => {
    const operationId = beginEmailMutation("email-resend");
    if (operationId === null) return;
    setEmailNotice(null);
    try {
      const result = await authenticatedRequest(resendEmailChange);
      if (isCurrentEmailOperation(operationId)) {
        acceptPendingRequest(result);
        setEmailNotice({ title: "New code sent", message: "The previous verification code is no longer valid.", tone: "success" });
      }
    } catch (error) {
      if (!isCurrentEmailOperation(operationId)) return;
      const retryDeadline = retryAfterDeadline(error);
      if (retryDeadline) setResendRateLimitedUntil(retryDeadline);
      const code = codeOf(error);
      if (error instanceof ApiError && error.status === 0) {
        setVerificationCode("");
        setPendingUnknown(true);
        await readPendingState("reconcile", true);
      } else if (code === "EMAIL_VERIFICATION_RESENDS_EXHAUSTED") {
        if (isCurrentEmailOperation(operationId)) {
          setResendsExhausted(true);
          setEmailNotice({ title: "No resends remaining", message: "This resend budget is exhausted. The current unexpired code can still be used.", tone: "warning" });
        }
      } else if (code === "EMAIL_CHANGE_EXPIRED") {
        await readPendingState("absolute-expiry", true);
      } else if (isCurrentEmailOperation(operationId)) {
        setEmailNotice({ title: "Could not resend code", message: getErrorMessage(error), tone: "error" });
      }
    } finally {
      endMutation();
    }
  };

  const handleEmailCancel = async () => {
    const operationId = beginEmailMutation("email-cancel");
    if (operationId === null) return;
    try {
      await authenticatedRequest(cancelEmailChange);
      if (isCurrentEmailOperation(operationId)) {
        completePendingRequest();
        setEmailNotice({ title: "Email change cancelled", message: "Your current email and session are unchanged.", tone: "info" });
      }
    } catch (error) {
      if (isCurrentEmailOperation(operationId)) setEmailNotice({ title: "Could not cancel email change", message: getErrorMessage(error), tone: "error" });
    } finally {
      endMutation();
    }
  };

  const handlePasswordSave = async () => {
    if (!beginMutation("password")) return;
    setPasswordNotice(null);
    if (isBlank(passwordCurrent) || passwordNew.length < 8 || passwordNew.length > 72) {
      setPasswordNotice({ title: "Check password details", message: "Enter your current password and a new password from 8 to 72 characters.", tone: "error" });
      setPasswordCurrent("");
      setPasswordNew("");
      endMutation();
      return;
    }
    let staleToken: string | null = null;
    try {
      const replacement = await authenticatedRequest((token) => {
        staleToken = token;
        return updateMyPassword(token, { currentPassword: passwordCurrent, newPassword: passwordNew });
      });
      await replaceSession(replacement);
      if (mountedRef.current) setPasswordNotice({ title: "Password changed", message: "Your replacement session is stored securely.", tone: "success" });
    } catch (error) {
      const retryDeadline = retryAfterDeadline(error);
      if (retryDeadline) setPasswordRateLimitedUntil(retryDeadline);
      if (!(await reconcileCredentialError(error, staleToken)) && mountedRef.current) {
        setPasswordNotice({ title: "Could not change password", message: getErrorMessage(error), tone: "error" });
      }
    } finally {
      if (mountedRef.current) {
        setPasswordCurrent("");
        setPasswordNew("");
      }
      endMutation();
    }
  };

  const cooldownSeconds = pending ? secondsUntil(pending.resendAvailableAt, now) : 0;
  const startRateLimitSeconds = startRateLimitedUntil ? Math.max(0, Math.ceil((startRateLimitedUntil - now) / 1000)) : 0;
  const resendRateLimitSeconds = resendRateLimitedUntil ? Math.max(0, Math.ceil((resendRateLimitedUntil - now) / 1000)) : 0;
  const passwordRateLimitSeconds = passwordRateLimitedUntil ? Math.max(0, Math.ceil((passwordRateLimitedUntil - now) / 1000)) : 0;
  const pendingExpired = pending ? secondsUntil(pending.expiresAt, now) === 0 : false;
  const codeExpired = pending ? codeExpiredConfirmed || secondsUntil(pending.codeExpiresAt, now) === 0 : false;
  const emailActionsDisabled = busy !== null || pendingUnknown;

  return (
    <Screen scroll>
      <View style={styles.page} testID="own-settings-content">
        <ScreenHeader
          backAction={{ label: "Back", onPress: () => navigation.goBack() }}
          eyebrow={user?.role === "FOREMAN" ? "Foreman profile" : "Worker profile"}
          subtitle="Manage only your own profile and credentials."
          title="Settings"
        />

        {user?.company?.timeZone ? (
          <View style={styles.timezone} testID="settings-timezone">
            <Text style={styles.contextLabel}>Company timezone</Text>
            <Text style={styles.contextValue}>{user.company.timeZone}</Text>
          </View>
        ) : null}

        <Card testID="settings-name-group">
          <View style={styles.group}>
            <Text accessibilityRole="header" style={styles.groupTitle}>Name</Text>
            <Text style={styles.groupDescription}>Update both profile name fields together.</Text>
            <FormField editable={busy !== "name"} label="First name" leadingIcon="person" onChangeText={setFirstName} value={firstName} />
            <FormField editable={busy !== "name"} error={nameError ?? undefined} label="Last name" leadingIcon="person" onChangeText={setLastName} value={lastName} />
            {nameNotice ? <Feedback {...nameNotice} testID="settings-name-notice" /> : null}
            <Button disabled={busy !== null} label="Save name" loading={busy === "name"} onPress={() => void handleNameSave()} testID="settings-name-save" />
          </View>
        </Card>

        <Card testID="settings-email-group">
          <View style={styles.group}>
            <Text accessibilityRole="header" style={styles.groupTitle}>Email</Text>
            <View style={styles.currentEmail}>
              <Text style={styles.contextLabel}>Current email</Text>
              <Text style={styles.contextValue} testID="settings-current-email">{user?.email ?? "Unavailable"}</Text>
            </View>
            {emailNotice ? <Feedback {...emailNotice} testID="settings-email-notice" /> : null}
            {busy === "pending-load" ? (
              <Feedback loading title="Checking email change" message="Restoring pending verification state." />
            ) : pending ? (
              <View style={styles.pending} testID="settings-email-pending">
                <Text style={styles.contextLabel}>Pending email</Text>
                <Text style={styles.pendingEmail}>{pending.newEmail}</Text>
                <Text style={styles.metadata}>Pending expires: {formatInstant(pending.expiresAt)}</Text>
                <Text style={styles.metadata}>Code expires: {formatInstant(pending.codeExpiresAt)}</Text>
                <Text style={styles.metadata}>Attempts remaining: {pending.attemptsRemaining}</Text>
                <Text style={styles.metadata}>Resends remaining: {pending.resendsRemaining}</Text>
                {pendingExpired ? <Feedback title="Email change expired" message="Check status or cancel this expired request before starting again." tone="warning" /> : codeExpired ? <Feedback title="Verification code expired" message="Request a resend if one remains available." tone="warning" /> : null}
                {resendRateLimitSeconds > 0 ? <Feedback title="Resend temporarily limited" message={`Retry resend in ${resendRateLimitSeconds} seconds.`} tone="warning" testID="settings-resend-rate-limit" /> : null}
                <FormField autoComplete="one-time-code" editable={!emailActionsDisabled} inputMode="numeric" keyboardType="number-pad" label="Six-digit verification code" leadingIcon="code" maxLength={6} onChangeText={(value) => setVerificationCode(value.replace(/\D/gu, ""))} value={verificationCode} />
                <Button disabled={emailActionsDisabled || pendingExpired || codeExpired} label="Confirm email" loading={busy === "email-confirm"} onPress={() => void handleEmailConfirm()} testID="settings-email-confirm" />
                <Button disabled={emailActionsDisabled || pendingExpired || cooldownSeconds > 0 || resendRateLimitSeconds > 0 || resendsExhausted || pending.resendsRemaining === 0} label={cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : "Resend code"} loading={busy === "email-resend"} onPress={() => void handleEmailResend()} testID="settings-email-resend" variant="secondary" />
                <Button disabled={busy !== null} label="Cancel email change" loading={busy === "email-cancel"} onPress={() => void handleEmailCancel()} testID="settings-email-cancel" variant="ghost" />
              </View>
            ) : (
              <View style={styles.pending} testID="settings-email-start-form">
                {startRateLimitSeconds > 0 ? <Feedback title="Email change temporarily limited" message={`Retry start in ${startRateLimitSeconds} seconds.`} tone="warning" testID="settings-start-rate-limit" /> : null}
                <FormField autoCapitalize="none" autoComplete="email" editable={!emailActionsDisabled && startRateLimitSeconds === 0} inputMode="email" keyboardType="email-address" label="New email" leadingIcon="email" onChangeText={setNewEmail} value={newEmail} />
                <FormField autoComplete="current-password" editable={!emailActionsDisabled && startRateLimitSeconds === 0} label="Current password" leadingIcon="password" onChangeText={setEmailPassword} secureTextEntry testID="settings-email-current-password" textContentType="password" value={emailPassword} />
                <Button disabled={emailActionsDisabled || startRateLimitSeconds > 0} label="Send verification code" loading={busy === "email-start"} onPress={() => void handleEmailStart()} testID="settings-email-start" />
              </View>
            )}
            {pendingUnknown || (pendingExpired && expiryRetriesExhausted) ? <Button disabled={busy !== null} label="Check email status" loading={busy === "email-reconcile"} onPress={() => void readPendingState("reconcile")} testID="settings-email-reconcile" variant="secondary" /> : null}
          </View>
        </Card>

        <Card testID="settings-password-group">
          <View style={styles.group}>
            <Text accessibilityRole="header" style={styles.groupTitle}>Password</Text>
            <Text style={styles.groupDescription}>Changing your password securely replaces this phone&apos;s session.</Text>
            <FormField autoComplete="current-password" editable={busy !== "password"} label="Current password" leadingIcon="password" onChangeText={setPasswordCurrent} secureTextEntry testID="settings-password-current" textContentType="password" value={passwordCurrent} />
            <FormField autoComplete="new-password" editable={busy !== "password"} label="New password" leadingIcon="password" onChangeText={setPasswordNew} secureTextEntry testID="settings-password-new" textContentType="newPassword" value={passwordNew} />
            {passwordNotice ? <Feedback {...passwordNotice} testID="settings-password-notice" /> : null}
            {passwordRateLimitSeconds > 0 ? <Feedback title="Try again later" message={`Retry available in ${passwordRateLimitSeconds} seconds.`} tone="warning" testID="settings-password-rate-limit" /> : null}
            <Button disabled={busy !== null || passwordRateLimitSeconds > 0} label="Change password" loading={busy === "password"} onPress={() => void handlePasswordSave()} testID="settings-password-save" />
          </View>
        </Card>

        {user?.role === "FOREMAN" && user.company ? (
          <Button label="Company Settings" leadingIcon="company" onPress={() => navigation.navigate("ForemanCompanySettings")} testID="settings-company-link" variant="secondary" />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, gap: theme.gap.section, width: "100%" },
  group: { gap: theme.space[3], width: "100%" },
  groupTitle: { ...theme.typography.sectionTitle, color: theme.colors.ink.primary },
  groupDescription: { ...theme.typography.supporting, color: theme.colors.ink.secondary },
  timezone: { gap: theme.space[1], paddingHorizontal: theme.space[1] },
  currentEmail: { gap: theme.space[1] },
  contextLabel: { ...theme.typography.label, color: theme.colors.ink.muted },
  contextValue: { ...theme.typography.body, color: theme.colors.ink.primary },
  pending: { gap: theme.space[3], width: "100%" },
  pendingEmail: { ...theme.typography.cardTitle, color: theme.colors.ink.primary },
  metadata: { ...theme.typography.supporting, color: theme.colors.ink.secondary }
});
