import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { AppState, Text, type AppStateStatus } from "react-native";
import {
  cancelEmailChange,
  confirmEmailChange,
  getPendingEmailChange,
  resendEmailChange,
  startEmailChange,
  updateMyName,
  updateMyPassword
} from "../../api/auth";
import { ApiError } from "../../api/errors";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { FormField } from "../../components/FormField";
import { useAuth } from "../../context/AuthContext";
import type { LoginResponse, PendingEmailChange, User } from "../../types/auth";
import { OwnSettingsScreen } from "../OwnSettingsScreen";

jest.mock("@expo/vector-icons/Ionicons", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text: NativeText } = jest.requireActual<typeof import("react-native")>("react-native");
  const MockIonicons = (props: Record<string, unknown>) =>
    React.createElement(NativeText, props as ComponentProps<typeof NativeText>);
  return { __esModule: true, default: MockIonicons };
});
jest.mock("@react-navigation/native", () => ({ useNavigation: jest.fn() }));
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../api/auth", () => ({
  cancelEmailChange: jest.fn(),
  confirmEmailChange: jest.fn(),
  getPendingEmailChange: jest.fn(),
  resendEmailChange: jest.fn(),
  startEmailChange: jest.fn(),
  updateMyName: jest.fn(),
  updateMyPassword: jest.fn()
}));

const worker: User = {
  id: 7,
  email: "old@example.com",
  firstName: "Avery",
  lastName: "Worker",
  role: "WORKER",
  company: {
    id: 10,
    name: "Acme",
    currencyLabel: "EUR",
    timeZone: "Europe/Berlin"
  }
};
const pending: PendingEmailChange = {
  status: "PENDING",
  newEmail: "pending@example.com",
  expiresAt: "2099-10-20T10:30:00Z",
  codeExpiresAt: "2099-10-20T10:10:00Z",
  resendAvailableAt: "2000-10-20T10:01:00Z",
  resendsRemaining: 2,
  attemptsRemaining: 4
};
const replacement: LoginResponse = {
  accessToken: "replacement-token",
  tokenType: "Bearer",
  user: { ...worker, email: "pending@example.com" }
};

const mockedUseAuth = jest.mocked(useAuth);
const mockedNavigation = jest.mocked(useNavigation);
const applyCurrentUser = jest.fn();
const replaceSession = jest.fn();
const reconcileCredentialSession = jest.fn();
const navigation = { goBack: jest.fn(), navigate: jest.fn() };
let renderer: ReactTestRenderer | null = null;

async function flush(): Promise<void> {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function renderSettings(user: User = worker): Promise<ReactTestRenderer> {
  mockedNavigation.mockReturnValue(navigation as never);
  mockedUseAuth.mockReturnValue({
    user,
    status: "authenticated",
    authenticatedRequest: jest.fn((request: (token: string) => Promise<unknown>) => request("current-token")),
    applyCurrentUser,
    replaceSession,
    reconcileCredentialSession
  } as unknown as ReturnType<typeof useAuth>);
  await act(async () => {
    renderer = create(<OwnSettingsScreen />);
    await flush();
  });
  return renderer!;
}

function button(label: string): ReturnType<ReactTestRenderer["root"]["findByType"]> {
  const result = renderer!.root.findAllByType(Button).find((item) => item.props.label === label);
  if (!result) throw new Error(`Missing button: ${label}`);
  return result;
}

function field(label: string) {
  const result = renderer!.root.findAllByType(FormField).find((item) => item.props.label === label);
  if (!result) throw new Error(`Missing field: ${label}`);
  return result;
}

function metadataValue(label: string): unknown {
  const result = renderer!.root.findAllByType(Text).find((item) =>
    Array.isArray(item.props.children) && item.props.children[0] === label
  );
  if (!result) throw new Error(`Missing metadata: ${label}`);
  return result.props.children[1];
}

async function press(label: string): Promise<void> {
  await act(async () => {
    button(label).props.onPress();
    await flush();
  });
}

describe("OwnSettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getPendingEmailChange).mockResolvedValue(undefined);
    jest.mocked(updateMyName).mockResolvedValue(worker);
    jest.mocked(startEmailChange).mockResolvedValue(pending);
    jest.mocked(confirmEmailChange).mockResolvedValue(replacement);
    jest.mocked(resendEmailChange).mockResolvedValue(pending);
    jest.mocked(cancelEmailChange).mockResolvedValue(undefined);
    jest.mocked(updateMyPassword).mockResolvedValue(replacement);
    applyCurrentUser.mockResolvedValue(undefined);
    replaceSession.mockResolvedValue(undefined);
    reconcileCredentialSession.mockResolvedValue(false);
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders exactly three editable groups, read-only timezone, and no worker company link", async () => {
    const view = await renderSettings();
    const groups = view.root.findAllByType(Card).filter((item) =>
      ["settings-name-group", "settings-email-group", "settings-password-group"].includes(item.props.testID)
    );
    expect(groups).toHaveLength(3);
    expect(view.root.findByProps({ testID: "settings-timezone" })).toBeDefined();
    expect(view.root.findAllByProps({ testID: "settings-company-link" })).toHaveLength(0);
    const output = JSON.stringify(view.toJSON());
    expect(output).not.toMatch(/Avatar|Phone|Language|Trade|Rate/);
  });

  it("shows Company Settings only for a foreman who already has a company", async () => {
    await renderSettings({ ...worker, role: "FOREMAN" });
    expect(button("Company Settings")).toBeDefined();
    await press("Company Settings");
    expect(navigation.navigate).toHaveBeenCalledWith("ForemanCompanySettings");
  });

  it("hides Company Settings for a foreman before company creation", async () => {
    await renderSettings({ ...worker, role: "FOREMAN", company: null });
    expect(renderer!.root.findAllByProps({ testID: "settings-company-link" })).toHaveLength(0);
  });

  it("restores pending email metadata and keeps current email separate", async () => {
    jest.mocked(getPendingEmailChange).mockResolvedValue(pending);
    const view = await renderSettings();
    expect(view.root.findByProps({ testID: "settings-current-email" }).props.children).toBe("old@example.com");
    expect(view.root.findByProps({ children: "pending@example.com" }).type).toBe(Text);
    expect(field("Six-digit verification code").props.value).toBe("");
  });

  it("updates both names and applies the returned user", async () => {
    const updated = { ...worker, firstName: "Jane", lastName: "Builder" };
    jest.mocked(updateMyName).mockResolvedValue(updated);
    await renderSettings();
    act(() => {
      field("First name").props.onChangeText("Jane");
      field("Last name").props.onChangeText("Builder");
    });
    await press("Save name");
    expect(updateMyName).toHaveBeenCalledWith("current-token", { firstName: "Jane", lastName: "Builder" });
    expect(applyCurrentUser).toHaveBeenCalledWith(updated);
  });

  it("restores authoritative pending state after an ambiguous start result and clears the password", async () => {
    jest.mocked(startEmailChange).mockRejectedValue(new ApiError("Network error", 0));
    jest.mocked(getPendingEmailChange)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(pending);
    await renderSettings();
    act(() => {
      field("New email").props.onChangeText("pending@example.com");
      field("Current password").props.onChangeText("secret-current");
    });
    await press("Send verification code");
    expect(getPendingEmailChange).toHaveBeenCalledTimes(2);
    expect(field("Six-digit verification code")).toBeDefined();
    expect(JSON.stringify(renderer!.toJSON())).not.toContain("secret-current");
  });

  it("treats exhausted resend as terminal without a Retry-After countdown", async () => {
    jest.mocked(getPendingEmailChange).mockResolvedValue(pending);
    jest.mocked(resendEmailChange).mockRejectedValue(
      new ApiError("No resends remain", 409, {
        status: 409,
        error: "Conflict",
        message: "No resends remain",
        code: "EMAIL_VERIFICATION_RESENDS_EXHAUSTED"
      })
    );
    await renderSettings();
    await press("Resend code");
    expect(JSON.stringify(renderer!.toJSON())).toContain("No resends remaining");
    expect(JSON.stringify(renderer!.toJSON())).not.toContain("Retry available in");
  });

  it("clears an entered verification code after a successful resend", async () => {
    jest.mocked(getPendingEmailChange).mockResolvedValue(pending);
    await renderSettings();
    act(() => void field("Six-digit verification code").props.onChangeText("483921"));

    await press("Resend code");

    expect(field("Six-digit verification code").props.value).toBe("");
    expect(JSON.stringify(renderer!.toJSON())).toContain("New code sent");
  });

  it("clears an entered verification code before reconciling an ambiguous resend", async () => {
    jest.mocked(getPendingEmailChange)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(pending);
    jest.mocked(resendEmailChange).mockRejectedValueOnce(
      new ApiError("Network result unknown", 0)
    );
    await renderSettings();
    act(() => void field("Six-digit verification code").props.onChangeText("483921"));

    await press("Resend code");

    expect(getPendingEmailChange).toHaveBeenCalledTimes(2);
    expect(field("Six-digit verification code").props.value).toBe("");
    expect(renderer!.root.findByProps({ testID: "settings-email-pending" })).toBeDefined();
  });

  it.each([
    [
      "429",
      new ApiError("Rate limited", 429, {
        status: 429,
        error: "Too Many Requests",
        message: "Rate limited",
        code: "EMAIL_CHANGE_RATE_LIMITED"
      }, 60)
    ],
    [
      "503",
      new ApiError("Delivery unavailable", 503, {
        status: 503,
        error: "Service Unavailable",
        message: "Delivery unavailable",
        code: "EMAIL_DELIVERY_UNAVAILABLE"
      })
    ],
    [
      "terminal resend 409",
      new ApiError("No resends remain", 409, {
        status: 409,
        error: "Conflict",
        message: "No resends remain",
        code: "EMAIL_VERIFICATION_RESENDS_EXHAUSTED"
      })
    ]
  ])("keeps the current code after a confirmed resend %s failure", async (_label, error) => {
    jest.mocked(getPendingEmailChange).mockResolvedValue(pending);
    jest.mocked(resendEmailChange).mockRejectedValueOnce(error);
    await renderSettings();
    act(() => void field("Six-digit verification code").props.onChangeText("483921"));

    await press("Resend code");

    expect(field("Six-digit verification code").props.value).toBe("483921");
    expect(button("Confirm email").props.disabled).toBe(false);
  });

  it("ends pending verification on the terminal fifth-attempt conflict", async () => {
    jest.mocked(getPendingEmailChange).mockResolvedValue(pending);
    jest.mocked(confirmEmailChange).mockRejectedValue(
      new ApiError("Attempts exhausted", 409, {
        status: 409,
        error: "Conflict",
        message: "Attempts exhausted",
        code: "EMAIL_VERIFICATION_ATTEMPTS_EXHAUSTED",
        attemptsRemaining: 0
      })
    );
    await renderSettings();
    act(() => void field("Six-digit verification code").props.onChangeText("000000"));
    await press("Confirm email");
    const output = JSON.stringify(renderer!.toJSON());
    expect(output).toContain("All verification attempts were used");
    expect(output).toContain("Send verification code");
    expect(output).not.toContain("Retry available in");
    expect(renderer!.root.findAllByProps({
      label: "Six-digit verification code",
      value: "000000"
    })).toHaveLength(0);
  });

  it.each([
    ["EMAIL_ALREADY_IN_USE", "Email already belongs to another user"],
    ["EMAIL_DELIVERY_UNAVAILABLE", "Email delivery is unavailable"]
  ])("shows safe start error for %s without inventing pending state", async (code, message) => {
    jest.mocked(startEmailChange).mockRejectedValue(new ApiError(message, code === "EMAIL_ALREADY_IN_USE" ? 409 : 503, {
      status: code === "EMAIL_ALREADY_IN_USE" ? 409 : 503,
      error: "Request failed",
      message,
      code
    }));
    await renderSettings();
    act(() => {
      field("New email").props.onChangeText("new@example.com");
      field("Current password").props.onChangeText("secret-current");
    });
    await press("Send verification code");
    expect(JSON.stringify(renderer!.toJSON())).toContain(message);
    expect(renderer!.root.findAllByProps({ testID: "settings-email-pending" })).toHaveLength(0);
  });

  it("shows temporary 429 Retry-After state", async () => {
    jest.mocked(startEmailChange).mockRejectedValue(new ApiError("Rate limited", 429, {
      status: 429,
      error: "Too Many Requests",
      message: "Rate limited",
      code: "EMAIL_CHANGE_RATE_LIMITED"
    }, 60));
    await renderSettings();
    act(() => {
      field("New email").props.onChangeText("new@example.com");
      field("Current password").props.onChangeText("secret-current");
    });
    await press("Send verification code");
    expect(JSON.stringify(renderer!.toJSON())).toContain("Retry start in");
  });

  it("stores the replacement session before reporting confirmed email success", async () => {
    jest.mocked(getPendingEmailChange).mockResolvedValue(pending);
    await renderSettings();
    act(() => void field("Six-digit verification code").props.onChangeText("483921"));
    await press("Confirm email");
    expect(replaceSession).toHaveBeenCalledWith(replacement);
    expect(JSON.stringify(renderer!.toJSON())).toContain("Email changed");
  });

  it("does not report success when protected replacement storage fails", async () => {
    jest.mocked(getPendingEmailChange).mockResolvedValue(pending);
    replaceSession.mockRejectedValue(new Error("secure write failed"));
    await renderSettings();
    act(() => void field("Six-digit verification code").props.onChangeText("483921"));
    await press("Confirm email");
    expect(JSON.stringify(renderer!.toJSON())).not.toContain("Email changed");
  });

  it("leaves SESSION_REVOKED reconciliation to the authenticated request boundary", async () => {
    jest.mocked(getPendingEmailChange).mockResolvedValue(pending);
    jest.mocked(confirmEmailChange).mockRejectedValue(new ApiError("Revoked", 401, {
      status: 401,
      error: "Unauthorized",
      message: "Revoked",
      code: "SESSION_REVOKED"
    }));
    await renderSettings();
    act(() => void field("Six-digit verification code").props.onChangeText("483921"));
    await press("Confirm email");
    expect(reconcileCredentialSession).not.toHaveBeenCalled();
    expect(replaceSession).not.toHaveBeenCalled();
  });

  it("keeps Confirm available after resend receives a temporary 429", async () => {
    jest.mocked(getPendingEmailChange).mockResolvedValue(pending);
    jest.mocked(resendEmailChange).mockRejectedValueOnce(
      new ApiError("Rate limited", 429, {
        status: 429,
        error: "Too Many Requests",
        message: "Rate limited",
        code: "EMAIL_CHANGE_RATE_LIMITED"
      }, 60)
    );
    await renderSettings();

    await press("Resend code");
    expect(button("Confirm email").props.disabled).toBe(false);
    expect(button("Resend code").props.disabled).toBe(true);

    act(() => void field("Six-digit verification code").props.onChangeText("483921"));
    await press("Confirm email");
    expect(replaceSession).toHaveBeenCalledWith(replacement);
    expect(JSON.stringify(renderer!.toJSON())).toContain("Email changed");
  });

  it("uses only the new pending resend state after a rate-limited pending is cancelled", async () => {
    const nextPending = {
      ...pending,
      newEmail: "next@example.com",
      resendAvailableAt: "2000-10-20T10:02:00Z",
      resendsRemaining: 1
    };
    jest.mocked(getPendingEmailChange).mockResolvedValue(pending);
    jest.mocked(resendEmailChange).mockRejectedValueOnce(
      new ApiError("Rate limited", 429, {
        status: 429,
        error: "Too Many Requests",
        message: "Rate limited",
        code: "EMAIL_CHANGE_RATE_LIMITED"
      }, 60)
    );
    jest.mocked(startEmailChange).mockResolvedValueOnce(nextPending);
    await renderSettings();
    act(() => void field("Six-digit verification code").props.onChangeText("483921"));

    await press("Resend code");
    expect(field("Six-digit verification code").props.value).toBe("483921");
    expect(button("Resend code").props.disabled).toBe(true);

    await press("Cancel email change");
    act(() => {
      field("New email").props.onChangeText("next@example.com");
      field("Current password").props.onChangeText("secret-current");
    });
    await press("Send verification code");

    expect(field("Six-digit verification code").props.value).toBe("");
    expect(metadataValue("Resends remaining: ")).toBe(1);
    expect(renderer!.root.findAllByProps({ testID: "settings-resend-rate-limit" })).toHaveLength(0);
    expect(button("Resend code").props.disabled).toBe(false);
  });

  it("uses only the new pending resend state after rate limiting and authoritative status 204", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-20T10:00:00Z"));
    const expiring = {
      ...pending,
      expiresAt: "2026-10-20T10:00:01Z",
      codeExpiresAt: "2026-10-20T10:10:00Z"
    };
    const nextPending = {
      ...pending,
      newEmail: "after-expiry@example.com",
      resendAvailableAt: "2000-10-20T10:02:00Z",
      resendsRemaining: 1
    };
    jest.mocked(getPendingEmailChange)
      .mockResolvedValueOnce(expiring)
      .mockResolvedValueOnce(undefined);
    jest.mocked(resendEmailChange).mockRejectedValueOnce(
      new ApiError("Rate limited", 429, {
        status: 429,
        error: "Too Many Requests",
        message: "Rate limited",
        code: "EMAIL_CHANGE_RATE_LIMITED"
      }, 60)
    );
    jest.mocked(startEmailChange).mockResolvedValueOnce(nextPending);
    await renderSettings();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await flush();
    });
    await press("Resend code");
    await act(async () => {
      jest.advanceTimersByTime(1_499);
      await flush();
    });
    expect(getPendingEmailChange).toHaveBeenCalledTimes(2);
    expect(renderer!.root.findByProps({ testID: "settings-email-start-form" })).toBeDefined();

    act(() => {
      field("New email").props.onChangeText("after-expiry@example.com");
      field("Current password").props.onChangeText("secret-current");
    });
    await press("Send verification code");

    expect(metadataValue("Resends remaining: ")).toBe(1);
    expect(renderer!.root.findAllByProps({ testID: "settings-resend-rate-limit" })).toHaveLength(0);
    expect(button("Resend code").props.disabled).toBe(false);
    jest.useRealTimers();
  });

  it.each([
    ["attempts exhausted", "EMAIL_VERIFICATION_ATTEMPTS_EXHAUSTED"],
    ["email conflict", "EMAIL_ALREADY_IN_USE"]
  ] as const)(
    "uses only the new pending resend state after resend exhaustion and terminal %s",
    async (_label, terminalCode) => {
      const nextPending = {
        ...pending,
        newEmail: "after-terminal@example.com",
        resendAvailableAt: "2000-10-20T10:02:00Z",
        resendsRemaining: 1
      };
      jest.mocked(getPendingEmailChange).mockResolvedValue(pending);
      jest.mocked(resendEmailChange).mockRejectedValueOnce(
        new ApiError("No resends remain", 409, {
          status: 409,
          error: "Conflict",
          message: "No resends remain",
          code: "EMAIL_VERIFICATION_RESENDS_EXHAUSTED"
        })
      );
      jest.mocked(confirmEmailChange).mockRejectedValueOnce(
        new ApiError("Verification ended", 409, {
          status: 409,
          error: "Conflict",
          message: "Verification ended",
          code: terminalCode,
          ...(terminalCode === "EMAIL_VERIFICATION_ATTEMPTS_EXHAUSTED"
            ? { attemptsRemaining: 0 }
            : {})
        })
      );
      jest.mocked(startEmailChange).mockResolvedValueOnce(nextPending);
      await renderSettings();
      act(() => void field("Six-digit verification code").props.onChangeText("483921"));

      await press("Resend code");
      expect(field("Six-digit verification code").props.value).toBe("483921");
      expect(button("Resend code").props.disabled).toBe(true);
      await press("Confirm email");
      expect(renderer!.root.findByProps({ testID: "settings-email-start-form" })).toBeDefined();

      act(() => {
        field("New email").props.onChangeText("after-terminal@example.com");
        field("Current password").props.onChangeText("secret-current");
      });
      await press("Send verification code");

      expect(field("Six-digit verification code").props.value).toBe("");
      expect(metadataValue("Resends remaining: ")).toBe(1);
      expect(button("Resend code").props.disabled).toBe(false);
    }
  );

  it("ignores an old pending read after a new pending has been accepted", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-20T10:00:00Z"));
    const expiring = {
      ...pending,
      expiresAt: "2026-10-20T09:59:59Z",
      codeExpiresAt: "2026-10-20T10:10:00Z"
    };
    const oldStatus = deferred<PendingEmailChange | undefined>();
    const stalePending = { ...expiring, resendsRemaining: 0 };
    const nextPending = {
      ...pending,
      newEmail: "latest@example.com",
      resendAvailableAt: "2000-10-20T10:02:00Z",
      resendsRemaining: 1
    };
    jest.mocked(getPendingEmailChange)
      .mockResolvedValueOnce(expiring)
      .mockImplementationOnce(() => oldStatus.promise);
    jest.mocked(startEmailChange).mockResolvedValueOnce(nextPending);
    await renderSettings();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await flush();
    });
    expect(getPendingEmailChange).toHaveBeenCalledTimes(2);
    await press("Cancel email change");
    act(() => {
      field("New email").props.onChangeText("latest@example.com");
      field("Current password").props.onChangeText("secret-current");
    });
    await press("Send verification code");

    await act(async () => {
      oldStatus.resolve(stalePending);
      await flush();
    });

    expect(JSON.stringify(renderer!.toJSON())).toContain("latest@example.com");
    expect(metadataValue("Resends remaining: ")).toBe(1);
    expect(button("Resend code").props.disabled).toBe(false);
    jest.useRealTimers();
  });

  it("re-reads status when the absolute deadline passes while Settings is open", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-20T10:00:00Z"));
    const expiring = {
      ...pending,
      expiresAt: "2026-10-20T10:00:01Z",
      codeExpiresAt: "2026-10-20T10:00:01Z"
    };
    jest.mocked(getPendingEmailChange)
      .mockResolvedValueOnce(expiring)
      .mockResolvedValueOnce(undefined);
    await renderSettings();

    await act(async () => {
      jest.advanceTimersByTime(1500);
      await flush();
    });

    expect(getPendingEmailChange).toHaveBeenCalledTimes(2);
    expect(renderer!.root.findAllByProps({ testID: "settings-email-pending" })).toHaveLength(0);
    expect(renderer!.root.findByProps({ testID: "settings-email-start-form" })).toBeDefined();
    jest.useRealTimers();
  });

  it("keeps explicit code-expired state and allows resend while the pending change remains active", async () => {
    const expiredCodePending = {
      ...pending,
      codeExpiresAt: "2000-10-20T10:10:00Z"
    };
    jest.mocked(getPendingEmailChange)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(expiredCodePending);
    jest.mocked(confirmEmailChange).mockRejectedValueOnce(
      new ApiError("Code expired", 410, {
        status: 410,
        error: "Gone",
        message: "Code expired",
        code: "EMAIL_VERIFICATION_CODE_EXPIRED"
      })
    );
    await renderSettings();
    act(() => void field("Six-digit verification code").props.onChangeText("483921"));
    await press("Confirm email");

    expect(getPendingEmailChange).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(renderer!.toJSON())).toContain("Code expired");
    expect(button("Confirm email").props.disabled).toBe(true);
    expect(button("Resend code").props.disabled).toBe(false);
  });

  it("uses authoritative 204 after absolute-expiry response to return to the start form", async () => {
    jest.mocked(getPendingEmailChange)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(undefined);
    jest.mocked(confirmEmailChange).mockRejectedValueOnce(
      new ApiError("Expired", 410, {
        status: 410,
        error: "Gone",
        message: "Expired",
        code: "EMAIL_CHANGE_EXPIRED"
      })
    );
    await renderSettings();
    act(() => void field("Six-digit verification code").props.onChangeText("483921"));
    await press("Confirm email");

    expect(getPendingEmailChange).toHaveBeenCalledTimes(2);
    expect(renderer!.root.findAllByProps({ testID: "settings-email-pending" })).toHaveLength(0);
    expect(renderer!.root.findByProps({ testID: "settings-email-start-form" })).toBeDefined();
  });

  it("clears the old code on expiry 204 and does not carry it into a new start", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-20T10:00:00Z"));
    const expired = { ...pending, expiresAt: "2026-10-20T09:59:59Z" };
    jest.mocked(getPendingEmailChange)
      .mockResolvedValueOnce(expired)
      .mockResolvedValueOnce(undefined);
    await renderSettings();
    act(() => void field("Six-digit verification code").props.onChangeText("483921"));

    await act(async () => {
      jest.advanceTimersByTime(1);
      await flush();
    });
    expect(renderer!.root.findByProps({ testID: "settings-email-start-form" })).toBeDefined();

    act(() => {
      field("New email").props.onChangeText("pending@example.com");
      field("Current password").props.onChangeText("secret-current");
    });
    await press("Send verification code");

    expect(field("Six-digit verification code").props.value).toBe("");
  });

  it("does not let an older expiry read overwrite a successful resend", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-20T10:00:00Z"));
    const expired = { ...pending, expiresAt: "2026-10-20T09:59:59Z" };
    const resent = {
      ...pending,
      newEmail: "resent@example.com",
      expiresAt: "2026-10-20T10:30:00Z",
      codeExpiresAt: "2026-10-20T10:10:00Z"
    };
    const oldExpiryRead = deferred<PendingEmailChange | undefined>();
    jest.mocked(getPendingEmailChange)
      .mockResolvedValueOnce(expired)
      .mockImplementationOnce(() => oldExpiryRead.promise);
    jest.mocked(resendEmailChange).mockResolvedValueOnce(resent);
    await renderSettings();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await flush();
    });
    expect(getPendingEmailChange).toHaveBeenCalledTimes(2);
    await press("Resend code");
    await act(async () => {
      oldExpiryRead.resolve(expired);
      await flush();
    });

    expect(JSON.stringify(renderer!.toJSON())).toContain("resent@example.com");
    expect(JSON.stringify(renderer!.toJSON())).toContain("New code sent");
    jest.useRealTimers();
  });

  it("does not let an older expiry read restore pending state after cancel", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-20T10:00:00Z"));
    const expired = { ...pending, expiresAt: "2026-10-20T09:59:59Z" };
    const oldExpiryRead = deferred<PendingEmailChange | undefined>();
    jest.mocked(getPendingEmailChange)
      .mockResolvedValueOnce(expired)
      .mockImplementationOnce(() => oldExpiryRead.promise);
    await renderSettings();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await flush();
    });
    await press("Cancel email change");
    await act(async () => {
      oldExpiryRead.resolve(expired);
      await flush();
    });

    expect(renderer!.root.findAllByProps({ testID: "settings-email-pending" })).toHaveLength(0);
    expect(JSON.stringify(renderer!.toJSON())).toContain("Email change cancelled");
    jest.useRealTimers();
  });

  it("does not let an older expiry read restore pending state after confirm", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-20T10:00:00Z"));
    const expired = { ...pending, expiresAt: "2026-10-20T09:59:59Z" };
    const oldExpiryRead = deferred<PendingEmailChange | undefined>();
    jest.mocked(getPendingEmailChange)
      .mockResolvedValueOnce(expired)
      .mockImplementationOnce(() => oldExpiryRead.promise);
    await renderSettings();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await flush();
    });
    act(() => void field("Six-digit verification code").props.onChangeText("483921"));
    await press("Confirm email");
    await act(async () => {
      oldExpiryRead.resolve(expired);
      await flush();
    });

    expect(renderer!.root.findAllByProps({ testID: "settings-email-pending" })).toHaveLength(0);
    expect(JSON.stringify(renderer!.toJSON())).toContain("Email changed");
    jest.useRealTimers();
  });

  it.each(["confirm", "resend", "cancel"] as const)(
    "does not start an automatic expiry read while %s is in flight",
    async (mutation) => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-10-20T10:00:00Z"));
      const expiring = {
        ...pending,
        expiresAt: "2026-10-20T10:00:01Z",
        codeExpiresAt: "2026-10-20T10:10:00Z"
      };
      jest.mocked(getPendingEmailChange).mockResolvedValueOnce(expiring);
      const mutationResult = deferred<LoginResponse | PendingEmailChange | void>();
      if (mutation === "confirm") {
        jest.mocked(confirmEmailChange).mockImplementationOnce(
          () => mutationResult.promise as Promise<LoginResponse>
        );
      } else if (mutation === "resend") {
        jest.mocked(resendEmailChange).mockImplementationOnce(
          () => mutationResult.promise as Promise<PendingEmailChange>
        );
      } else {
        jest.mocked(cancelEmailChange).mockImplementationOnce(
          () => mutationResult.promise as Promise<void>
        );
      }
      await renderSettings();
      await act(async () => {
        jest.advanceTimersByTime(1);
        await flush();
      });

      if (mutation === "confirm") {
        act(() => void field("Six-digit verification code").props.onChangeText("483921"));
      }
      act(() => {
        button(
          mutation === "confirm"
            ? "Confirm email"
            : mutation === "resend"
              ? "Resend code"
              : "Cancel email change"
        ).props.onPress();
      });
      await act(async () => {
        jest.advanceTimersByTime(1_500);
        await flush();
      });

      expect(getPendingEmailChange).toHaveBeenCalledTimes(1);

      await act(async () => {
        mutationResult.resolve(
          mutation === "confirm"
            ? replacement
            : mutation === "resend"
              ? pending
              : undefined
        );
        await flush();
      });
      jest.useRealTimers();
    }
  );

  it("uses exact 5/15/30-second retries, then exposes manual status checks without more polling", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-20T10:00:00Z"));
    const expired = { ...pending, expiresAt: "2026-10-20T09:59:59Z" };
    jest.mocked(getPendingEmailChange)
      .mockResolvedValueOnce(expired)
      .mockResolvedValueOnce(expired)
      .mockResolvedValueOnce(expired)
      .mockResolvedValueOnce(expired)
      .mockResolvedValueOnce(expired)
      .mockResolvedValueOnce(expired)
      .mockResolvedValueOnce(undefined);
    await renderSettings();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await flush();
    });
    expect(getPendingEmailChange).toHaveBeenCalledTimes(2);
    expect(renderer!.root.findByProps({ testID: "settings-email-pending" })).toBeDefined();

    await act(async () => {
      jest.advanceTimersByTime(4_999);
      await flush();
    });
    expect(getPendingEmailChange).toHaveBeenCalledTimes(2);
    await act(async () => {
      jest.advanceTimersByTime(1);
      await flush();
    });
    expect(getPendingEmailChange).toHaveBeenCalledTimes(3);

    await act(async () => {
      jest.advanceTimersByTime(14_999);
      await flush();
    });
    expect(getPendingEmailChange).toHaveBeenCalledTimes(3);
    await act(async () => {
      jest.advanceTimersByTime(1);
      await flush();
    });
    expect(getPendingEmailChange).toHaveBeenCalledTimes(4);

    await act(async () => {
      jest.advanceTimersByTime(29_999);
      await flush();
    });
    expect(getPendingEmailChange).toHaveBeenCalledTimes(4);
    await act(async () => {
      jest.advanceTimersByTime(1);
      await flush();
    });
    expect(getPendingEmailChange).toHaveBeenCalledTimes(5);
    expect(button("Check email status")).toBeDefined();

    await act(async () => {
      jest.advanceTimersByTime(120_000);
      await flush();
    });
    expect(getPendingEmailChange).toHaveBeenCalledTimes(5);

    await press("Check email status");
    expect(getPendingEmailChange).toHaveBeenCalledTimes(6);
    expect(renderer!.root.findByProps({ testID: "settings-email-pending" })).toBeDefined();
    expect(button("Check email status")).toBeDefined();

    await press("Check email status");
    expect(getPendingEmailChange).toHaveBeenCalledTimes(7);
    expect(renderer!.root.findAllByProps({ testID: "settings-email-pending" })).toHaveLength(0);
    expect(renderer!.root.findByProps({ testID: "settings-email-start-form" })).toBeDefined();
    jest.useRealTimers();
  });

  it("deduplicates repeated manual status requests", async () => {
    let resolveStatus!: (value: undefined) => void;
    jest.mocked(getPendingEmailChange)
      .mockRejectedValueOnce(new ApiError("Network error", 0))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveStatus = resolve; }));
    await renderSettings();
    const check = button("Check email status");

    act(() => {
      check.props.onPress();
      check.props.onPress();
    });
    expect(getPendingEmailChange).toHaveBeenCalledTimes(2);
    await act(async () => {
      resolveStatus(undefined);
      await flush();
    });

    expect(renderer!.root.findAllByProps({ testID: "settings-email-pending" })).toHaveLength(0);
    expect(renderer!.root.findByProps({ testID: "settings-email-start-form" })).toBeDefined();
  });

  it("performs one authoritative pending check when the app resumes", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-20T10:00:00Z"));
    let appStateListener!: (state: AppStateStatus) => void;
    const remove = jest.fn();
    const expired = { ...pending, expiresAt: "2026-10-20T09:59:59Z" };
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
      appStateListener = listener;
      return { remove } as never;
    });
    jest.mocked(getPendingEmailChange)
      .mockResolvedValueOnce(expired)
      .mockResolvedValueOnce(undefined);
    await renderSettings();

    await act(async () => {
      appStateListener("background");
      jest.advanceTimersByTime(60_000);
      await flush();
    });
    expect(getPendingEmailChange).toHaveBeenCalledTimes(1);

    await act(async () => {
      appStateListener("active");
      await flush();
    });

    expect(getPendingEmailChange).toHaveBeenCalledTimes(2);
    expect(renderer!.root.findAllByProps({ testID: "settings-email-pending" })).toHaveLength(0);
    expect(renderer!.root.findByProps({ testID: "settings-email-start-form" })).toBeDefined();
    expect(field("New email").props.value).toBe("");
  });

  it("deduplicates resume checks and ignores their late response after unmount", async () => {
    let appStateListener!: (state: AppStateStatus) => void;
    const remove = jest.fn();
    const resumedStatus = deferred<PendingEmailChange | undefined>();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
      appStateListener = listener;
      return { remove } as never;
    });
    jest.mocked(getPendingEmailChange)
      .mockResolvedValueOnce(pending)
      .mockImplementationOnce(() => resumedStatus.promise);
    await renderSettings();

    act(() => {
      appStateListener("background");
      appStateListener("active");
      appStateListener("background");
      appStateListener("active");
    });
    expect(getPendingEmailChange).toHaveBeenCalledTimes(2);

    act(() => renderer?.unmount());
    expect(remove).toHaveBeenCalledTimes(1);
    await act(async () => {
      resumedStatus.resolve(undefined);
      await flush();
    });
    expect(getPendingEmailChange).toHaveBeenCalledTimes(2);
  });

  it("queues one resume check when the pre-background read is still in flight", async () => {
    let appStateListener!: (state: AppStateStatus) => void;
    const initialStatus = deferred<PendingEmailChange | undefined>();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
      appStateListener = listener;
      return { remove: jest.fn() } as never;
    });
    jest.mocked(getPendingEmailChange)
      .mockImplementationOnce(() => initialStatus.promise)
      .mockResolvedValueOnce(undefined);
    await renderSettings();

    act(() => {
      appStateListener("background");
      appStateListener("active");
    });
    expect(getPendingEmailChange).toHaveBeenCalledTimes(1);

    await act(async () => {
      initialStatus.resolve(pending);
      await flush();
    });
    expect(getPendingEmailChange).toHaveBeenCalledTimes(2);
    expect(renderer!.root.findAllByProps({ testID: "settings-email-pending" })).toHaveLength(0);
    expect(renderer!.root.findByProps({ testID: "settings-email-start-form" })).toBeDefined();
  });

  it("ignores pending-status completion after unmount", async () => {
    let resolveStatus!: (value: PendingEmailChange) => void;
    jest.mocked(getPendingEmailChange).mockImplementationOnce(
      () => new Promise((resolve) => { resolveStatus = resolve; })
    );
    await renderSettings();
    act(() => renderer?.unmount());

    await act(async () => {
      resolveStatus(pending);
      await flush();
    });
    expect(getPendingEmailChange).toHaveBeenCalledTimes(1);
  });

  it("reconciles CREDENTIAL_VERSION_CONFLICT for password mutation", async () => {
    jest.mocked(updateMyPassword).mockRejectedValue(new ApiError("Conflict", 409, {
      status: 409,
      error: "Conflict",
      message: "Conflict",
      code: "CREDENTIAL_VERSION_CONFLICT"
    }));
    reconcileCredentialSession.mockResolvedValue(true);
    await renderSettings();
    act(() => {
      renderer!.root.findByProps({ testID: "settings-password-current" }).props.onChangeText("secret-current");
      renderer!.root.findByProps({ testID: "settings-password-new" }).props.onChangeText("secret-new-password");
    });
    await press("Change password");
    expect(reconcileCredentialSession).toHaveBeenCalledWith("current-token");
    expect(replaceSession).not.toHaveBeenCalled();
  });

  it("clears both password fields after a rejected password change", async () => {
    jest.mocked(updateMyPassword).mockRejectedValue(new ApiError("Incorrect", 400, {
      status: 400,
      error: "Bad Request",
      message: "Incorrect",
      code: "CURRENT_PASSWORD_INCORRECT"
    }));
    await renderSettings();
    act(() => {
      renderer!.root.findByProps({ testID: "settings-password-current" }).props.onChangeText("secret-current");
      renderer!.root.findByProps({ testID: "settings-password-new" }).props.onChangeText("secret-new-password");
    });
    await press("Change password");
    expect(updateMyPassword).toHaveBeenCalled();
    expect(renderer!.root.findByProps({ testID: "settings-password-current" }).props.value).toBe("");
    expect(renderer!.root.findByProps({ testID: "settings-password-new" }).props.value).toBe("");
  });
});

void Ionicons;
