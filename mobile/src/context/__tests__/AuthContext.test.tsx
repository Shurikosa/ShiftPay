import { useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getCurrentUser, loginUser, registerUser } from "../../api/auth";
import { ApiError } from "../../api/errors";
import { AuthProvider, useAuth } from "../AuthContext";
import { clearSession, loadSession, saveSession } from "../../storage/sessionStorage";
import type { LoginResponse, Session } from "../../types/auth";

jest.mock("../../api/auth", () => ({
  getCurrentUser: jest.fn(),
  loginUser: jest.fn(),
  registerUser: jest.fn()
}));
jest.mock("../../storage/sessionStorage", () => ({
  ProtectedSessionStorageError: class ProtectedSessionStorageError extends Error {
    failClosed: boolean;
    constructor(message = "storage failure", failClosed = true) {
      super(message);
      this.failClosed = failClosed;
    }
  },
  clearSession: jest.fn(),
  loadSession: jest.fn(),
  saveSession: jest.fn()
}));

const oldSession: Session = {
  accessToken: "old-token",
  tokenType: "Bearer",
  user: {
    id: 1,
    email: "old@example.com",
    firstName: "Avery",
    lastName: "Worker",
    role: "WORKER",
    company: null
  }
};
const replacement: LoginResponse = {
  accessToken: "new-token",
  tokenType: "Bearer",
  user: { ...oldSession.user, email: "new@example.com" }
};
const newestReplacement: LoginResponse = {
  accessToken: "newest-token",
  tokenType: "Bearer",
  user: { ...oldSession.user, email: "newest@example.com" }
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

let currentAuth: ReturnType<typeof useAuth> | null = null;
let renderer: ReactTestRenderer | null = null;

function CaptureAuth() {
  const auth = useAuth();
  useEffect(() => {
    currentAuth = auth;
  }, [auth]);
  return null;
}

async function flush(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

async function renderProvider(stored: Session | null = oldSession) {
  jest.mocked(loadSession).mockResolvedValue(stored);
  jest.mocked(getCurrentUser).mockResolvedValue(stored?.user ?? oldSession.user);
  await act(async () => {
    renderer = create(<AuthProvider><CaptureAuth /></AuthProvider>);
    await flush();
  });
  await act(async () => {
    jest.runOnlyPendingTimers();
    await flush();
  });
}

describe("AuthContext credential session handling", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    currentAuth = null;
    jest.mocked(saveSession).mockResolvedValue(undefined);
    jest.mocked(clearSession).mockResolvedValue(undefined);
    jest.mocked(loginUser).mockResolvedValue(replacement);
    jest.mocked(registerUser).mockResolvedValue(oldSession.user);
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
    jest.useRealTimers();
  });

  it("persists a replacement session before exposing its user", async () => {
    jest.mocked(loginUser).mockResolvedValueOnce(oldSession);
    await renderProvider(null);
    await act(async () => {
      await currentAuth!.signIn({ email: "old@example.com", password: "current" });
    });
    let finishWrite!: () => void;
    jest.mocked(saveSession).mockImplementationOnce(() => new Promise<void>((resolve) => { finishWrite = resolve; }));
    let replacementPromise!: Promise<void>;
    act(() => {
      replacementPromise = currentAuth!.replaceSession(replacement);
    });
    expect(currentAuth!.user?.email).toBe("old@example.com");
    const duringReplacement = jest.fn().mockResolvedValue("stale result");
    await expect(
      currentAuth!.authenticatedRequest(duringReplacement)
    ).rejects.toThrow("Sign in required");
    expect(duringReplacement).not.toHaveBeenCalled();

    await act(async () => {
      finishWrite();
      await replacementPromise;
    });
    expect(currentAuth!.user?.email).toBe("new@example.com");
  });

  it("clears transient state and routes to login when replacement storage fails", async () => {
    await renderProvider();
    jest.mocked(saveSession).mockRejectedValueOnce(new Error("keystore failure"));

    await act(async () => {
      await expect(currentAuth!.replaceSession(replacement)).rejects.toThrow(
        "Could not save the protected replacement session."
      );
    });

    expect(clearSession).toHaveBeenCalled();
    expect(currentAuth!.status).toBe("unauthenticated");
    expect(currentAuth!.user).toBeNull();
    expect(currentAuth!.error).toContain("Sign in again with the new credential");
  });

  it("retains and validates a separately stored newer protected session", async () => {
    await renderProvider();
    jest.mocked(loadSession).mockResolvedValueOnce(replacement);
    jest.mocked(getCurrentUser).mockResolvedValueOnce(replacement.user);

    let retained!: boolean;
    await act(async () => {
      retained = await currentAuth!.reconcileCredentialSession("old-token");
    });

    expect(getCurrentUser).toHaveBeenCalledWith("new-token");
    expect(retained).toBe(true);
    expect(currentAuth!.user?.email).toBe("new@example.com");
    expect(clearSession).not.toHaveBeenCalled();
  });

  it("retains an unverified newer protected session after a temporary validation failure and retries", async () => {
    await renderProvider();
    const revoked = new ApiError("Revoked", 401, {
      status: 401,
      error: "Unauthorized",
      message: "Revoked",
      code: "SESSION_REVOKED"
    });
    jest.mocked(loadSession).mockResolvedValue(replacement);
    jest.mocked(getCurrentUser)
      .mockRejectedValueOnce(new ApiError("Network timeout", 0))
      .mockResolvedValueOnce(replacement.user);

    await act(async () => {
      await expect(
        currentAuth!.authenticatedRequest(() => Promise.reject(revoked))
      ).rejects.toBe(revoked);
    });

    expect(clearSession).not.toHaveBeenCalled();
    expect(currentAuth!.status).toBe("recovering");
    expect(currentAuth!.user).toBeNull();
    expect(currentAuth!.error).toContain("could not be verified");

    await act(async () => {
      await currentAuth!.retrySessionRecovery();
    });

    expect(getCurrentUser).toHaveBeenLastCalledWith("new-token");
    expect(saveSession).toHaveBeenCalledWith(replacement);
    expect(currentAuth!.status).toBe("authenticated");
    expect(currentAuth!.user?.email).toBe("new@example.com");
    expect(clearSession).not.toHaveBeenCalled();
  });

  it("clears a stale protected session when no newer local winner exists", async () => {
    await renderProvider();
    jest.mocked(loadSession).mockResolvedValueOnce(oldSession);

    let retained!: boolean;
    await act(async () => {
      retained = await currentAuth!.reconcileCredentialSession("old-token");
    });

    expect(retained).toBe(false);
    expect(clearSession).toHaveBeenCalled();
    expect(currentAuth!.status).toBe("unauthenticated");
  });

  it("does not let an old refresh overwrite a replacement session", async () => {
    await renderProvider();
    const oldRefresh = deferred<typeof oldSession.user>();
    jest.mocked(getCurrentUser).mockImplementationOnce(() => oldRefresh.promise);

    let refreshPromise!: Promise<typeof oldSession.user>;
    act(() => {
      refreshPromise = currentAuth!.refreshCurrentUser();
    });
    await act(async () => {
      await currentAuth!.replaceSession(replacement);
      oldRefresh.resolve({ ...oldSession.user, firstName: "Stale" });
      await refreshPromise;
    });

    expect(currentAuth!.user?.email).toBe("new@example.com");
    expect(currentAuth!.user?.firstName).toBe("Avery");
    expect(saveSession).not.toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "old-token",
        user: expect.objectContaining({ firstName: "Stale" })
      })
    );
  });

  it("does not let delayed reconciliation overwrite a still newer session", async () => {
    await renderProvider();
    const intermediate = replacement;
    const validation = deferred<typeof oldSession.user>();
    jest.mocked(loadSession)
      .mockResolvedValueOnce(intermediate)
      .mockResolvedValue(newestReplacement);
    jest.mocked(getCurrentUser).mockImplementation((token) => {
      if (token === "new-token") return validation.promise;
      if (token === "newest-token") return Promise.resolve(newestReplacement.user);
      return Promise.resolve(oldSession.user);
    });

    let reconciliation!: Promise<boolean>;
    act(() => {
      reconciliation = currentAuth!.reconcileCredentialSession("old-token");
    });
    await act(async () => {
      await flush();
    });
    await act(async () => {
      await currentAuth!.replaceSession(newestReplacement);
      validation.resolve(intermediate.user);
      await reconciliation;
    });

    expect(currentAuth!.user?.email).toBe("newest@example.com");
    expect(saveSession).not.toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "new-token" })
    );
  });

  it("does not let a delayed temporary validation failure affect a still newer session", async () => {
    await renderProvider();
    const validation = deferred<typeof oldSession.user>();
    jest.mocked(loadSession)
      .mockResolvedValueOnce(replacement)
      .mockResolvedValue(newestReplacement);
    jest.mocked(getCurrentUser).mockImplementation((token) => {
      if (token === "new-token") return validation.promise;
      if (token === "newest-token") return Promise.resolve(newestReplacement.user);
      return Promise.resolve(oldSession.user);
    });

    let reconciliation!: Promise<boolean>;
    act(() => {
      reconciliation = currentAuth!.reconcileCredentialSession("old-token");
    });
    await act(async () => {
      await flush();
      await currentAuth!.replaceSession(newestReplacement);
      validation.reject(new ApiError("Network timeout", 0));
      await reconciliation;
    });

    expect(currentAuth!.status).toBe("authenticated");
    expect(currentAuth!.user?.email).toBe("newest@example.com");
    expect(clearSession).not.toHaveBeenCalled();
  });

  it("does not publish an authenticated request result after logout", async () => {
    await renderProvider();
    const request = deferred<string>();
    let requestPromise!: Promise<string>;
    act(() => {
      requestPromise = currentAuth!.authenticatedRequest(() => request.promise);
    });

    await act(async () => {
      await currentAuth!.signOut();
      request.resolve("old result");
      await expect(requestPromise).rejects.toThrow(
        "request finished after the active session changed"
      );
    });

    expect(currentAuth!.status).toBe("unauthenticated");
    expect(currentAuth!.user).toBeNull();
  });

  it.each([
    "pending status",
    "name save",
    "email start",
    "email resend",
    "email cancel",
    "email confirm",
    "password change"
  ])("centrally handles coded SESSION_REVOKED for %s", async () => {
    await renderProvider();
    const revoked = new ApiError("Revoked", 401, {
      status: 401,
      error: "Unauthorized",
      message: "Revoked",
      code: "SESSION_REVOKED"
    });

    await act(async () => {
      await expect(
        currentAuth!.authenticatedRequest(() => Promise.reject(revoked))
      ).rejects.toBe(revoked);
    });

    expect(clearSession).toHaveBeenCalled();
    expect(currentAuth!.status).toBe("unauthenticated");
  });

  it("does not treat an incorrect current password or login 401 as SESSION_REVOKED", async () => {
    await renderProvider();
    const incorrectPassword = new ApiError("Incorrect", 400, {
      status: 400,
      error: "Bad Request",
      message: "Incorrect",
      code: "CURRENT_PASSWORD_INCORRECT"
    });

    await act(async () => {
      await expect(
        currentAuth!.authenticatedRequest(() => Promise.reject(incorrectPassword))
      ).rejects.toBe(incorrectPassword);
    });
    expect(clearSession).not.toHaveBeenCalled();
    expect(currentAuth!.status).toBe("authenticated");

    const loginError = new ApiError("Invalid email or password", 401);
    jest.mocked(loginUser).mockRejectedValueOnce(loginError);
    await act(async () => {
      await expect(
        currentAuth!.signIn({ email: "old@example.com", password: "wrong" })
      ).rejects.toBe(loginError);
    });
    expect(clearSession).not.toHaveBeenCalled();
  });

  it("retains a replacement when an old request reports SESSION_REVOKED late", async () => {
    await renderProvider();
    const oldRequest = deferred<never>();
    jest.mocked(loadSession).mockResolvedValue(replacement);
    jest.mocked(getCurrentUser).mockImplementation((token) =>
      Promise.resolve(token === "new-token" ? replacement.user : oldSession.user)
    );
    let requestPromise!: Promise<never>;
    act(() => {
      requestPromise = currentAuth!.authenticatedRequest(() => oldRequest.promise);
    });

    await act(async () => {
      await currentAuth!.replaceSession(replacement);
      oldRequest.reject(new ApiError("Revoked", 401, {
        status: 401,
        error: "Unauthorized",
        message: "Revoked",
        code: "SESSION_REVOKED"
      }));
      await expect(requestPromise).rejects.toMatchObject({ status: 401 });
    });

    expect(currentAuth!.status).toBe("authenticated");
    expect(currentAuth!.user?.email).toBe("new@example.com");
    expect(clearSession).not.toHaveBeenCalled();
  });

  it("keeps the current session when durable logout blocking cannot be established", async () => {
    const { ProtectedSessionStorageError } = jest.requireMock(
      "../../storage/sessionStorage"
    ) as { ProtectedSessionStorageError: new (message: string, failClosed: boolean) => Error };
    await renderProvider();
    jest.mocked(clearSession).mockRejectedValueOnce(
      new ProtectedSessionStorageError("marker write failed", false)
    );

    await act(async () => {
      await expect(currentAuth!.signOut()).rejects.toThrow("marker write failed");
    });
    expect(currentAuth!.status).toBe("authenticated");
    expect(currentAuth!.user?.email).toBe("old@example.com");
    expect(currentAuth!.error).toContain("Could not sign out safely");
  });

  it("logs out locally when durable fail-closed cleanup remains pending", async () => {
    const { ProtectedSessionStorageError } = jest.requireMock(
      "../../storage/sessionStorage"
    ) as { ProtectedSessionStorageError: new (message: string, failClosed: boolean) => Error };
    await renderProvider();
    jest.mocked(clearSession).mockRejectedValueOnce(
      new ProtectedSessionStorageError("protected delete failed", true)
    );

    await act(async () => {
      await currentAuth!.signOut();
    });
    expect(currentAuth!.status).toBe("unauthenticated");
    expect(currentAuth!.user).toBeNull();
    expect(currentAuth!.error).toContain("cleanup will be retried");
  });
});
