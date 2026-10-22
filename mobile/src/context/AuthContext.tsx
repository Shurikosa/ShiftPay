import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { getCurrentUser, loginUser, registerUser } from "../api/auth";
import { ApiError, getErrorMessage } from "../api/errors";
import {
  clearSession,
  loadSession,
  ProtectedSessionStorageError,
  saveSession as persistSession
} from "../storage/sessionStorage";
import type {
  Company,
  LoginRequest,
  RegisterRequest,
  Session,
  User
} from "../types/auth";

type AuthStatus =
  | "restoring"
  | "recovering"
  | "authenticated"
  | "unauthenticated";

type AuthenticatedRequest<TResponse> = (token: string) => Promise<TResponse>;

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  error: string | null;
  authenticatedRequest: <TResponse>(
    request: AuthenticatedRequest<TResponse>
  ) => Promise<TResponse>;
  refreshCurrentUser: () => Promise<User>;
  applyCurrentUser: (user: User) => Promise<void>;
  applyCompany: (company: Company) => Promise<User>;
  replaceSession: (session: Session) => Promise<void>;
  reconcileCredentialSession: (staleAccessToken: string) => Promise<boolean>;
  retrySessionRecovery: () => Promise<void>;
  signIn: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<User>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toSession(response: Session): Session {
  return {
    accessToken: response.accessToken,
    tokenType: response.tokenType,
    user: response.user
  };
}

function isSessionRevoked(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 401 &&
    error.details?.code === "SESSION_REVOKED"
  );
}

function isAuthoritativeSessionRejection(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 401;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const generationRef = useRef(0);
  const sessionGenerationRef = useRef(0);

  const commitSession = useCallback(
    (nextSession: Session | null, nextStatus: AuthStatus) => {
      sessionRef.current = nextSession;
      sessionGenerationRef.current = generationRef.current;
      setSession(nextSession);
      setStatus(nextStatus);
    },
    []
  );

  const retainSessionForRecovery = useCallback(
    (recoveryGeneration: number, message: string) => {
      if (generationRef.current !== recoveryGeneration) return;

      // The protected token remains the recovery candidate, but it is not
      // exposed as authenticated until /users/me validates it. Advancing the
      // generation also invalidates every request started by the old session.
      const retainedGeneration = ++generationRef.current;
      sessionRef.current = null;
      sessionGenerationRef.current = retainedGeneration;
      setSession(null);
      setStatus("recovering");
      setError(message);
    },
    []
  );

  const clearForForcedLogin = useCallback(
    async (message: string): Promise<void> => {
      const clearGeneration = ++generationRef.current;
      try {
        await clearSession();
      } catch {
        // A durable pending-clear marker blocks restoration whenever cleanup
        // cannot finish. Revoked/invalid tokens are also rejected server-side.
        console.warn("Auth session cleanup remains pending.");
      }

      if (generationRef.current === clearGeneration) {
        commitSession(null, "unauthenticated");
        setError(message);
      }
    },
    [commitSession]
  );

  const restoreSession = useCallback(async () => {
    const restoreGeneration = generationRef.current;
    try {
      const storedSession = await loadSession();
      if (generationRef.current !== restoreGeneration) return;

      if (!storedSession) {
        commitSession(null, "unauthenticated");
        return;
      }

      let user: User;
      try {
        user = await getCurrentUser(storedSession.accessToken);
      } catch (caughtError) {
        if (generationRef.current !== restoreGeneration) return;
        if (!isAuthoritativeSessionRejection(caughtError)) {
          retainSessionForRecovery(
            restoreGeneration,
            "Could not verify your saved session. Check your connection and try again."
          );
          return;
        }
        throw caughtError;
      }
      if (generationRef.current !== restoreGeneration) return;

      const restoredSession = { ...storedSession, user };
      await persistSession(restoredSession);
      if (generationRef.current !== restoreGeneration) return;

      commitSession(restoredSession, "authenticated");
    } catch (caughtError) {
      if (generationRef.current !== restoreGeneration) return;
      console.warn("Failed to restore auth session.");
      await clearForForcedLogin(
        caughtError instanceof ProtectedSessionStorageError
          ? "Protected session storage is unavailable. Sign in again when it is available."
          : "Your saved session is no longer valid. Sign in again."
      );
    }
  }, [clearForForcedLogin, commitSession, retainSessionForRecovery]);

  useEffect(() => {
    const restoreTask = setTimeout(() => {
      void restoreSession();
    }, 0);

    return () => {
      clearTimeout(restoreTask);
    };
  }, [restoreSession]);

  const signIn = useCallback(async (payload: LoginRequest) => {
    const signInGeneration = ++generationRef.current;
    let receivedSession = false;
    setError(null);

    try {
      const response = await loginUser(payload);
      receivedSession = true;
      if (generationRef.current !== signInGeneration) {
        throw new ApiError("This sign-in was superseded by a newer session action.", 0);
      }

      const nextSession = toSession(response);
      await persistSession(nextSession);
      if (generationRef.current !== signInGeneration) return;

      commitSession(nextSession, "authenticated");
    } catch (caughtError) {
      if (receivedSession && generationRef.current === signInGeneration) {
        await clearForForcedLogin(
          "The session could not be stored securely. Sign in again when protected storage is available."
        );
      } else if (generationRef.current === signInGeneration) {
        setError(getErrorMessage(caughtError));
      }
      throw caughtError;
    }
  }, [clearForForcedLogin, commitSession]);

  const reconcileCredentialSessionInternal = useCallback(
    async (staleAccessToken: string): Promise<boolean> => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const observedGeneration = generationRef.current;
        const inMemorySession =
          sessionGenerationRef.current === observedGeneration
            ? sessionRef.current
            : null;

        let protectedSession: Session | null = null;
        let protectedSessionRead = false;
        try {
          protectedSession = await loadSession();
          protectedSessionRead = true;
        } catch {
          // An unreadable protected store may contain a newer winner. Do not
          // clear anything until it can be inspected and validated.
        }

        if (generationRef.current !== observedGeneration) {
          continue;
        }

        const candidate =
          inMemorySession && inMemorySession.accessToken !== staleAccessToken
            ? inMemorySession
            : protectedSession && protectedSession.accessToken !== staleAccessToken
              ? protectedSession
              : null;

        if (candidate) {
          try {
            const user = await getCurrentUser(candidate.accessToken);
            if (generationRef.current !== observedGeneration) continue;

            const validatedSession = { ...candidate, user };
            await persistSession(validatedSession);
            if (generationRef.current !== observedGeneration) continue;

            commitSession(validatedSession, "authenticated");
            return true;
          } catch (caughtError) {
            if (generationRef.current !== observedGeneration) continue;

            if (!isAuthoritativeSessionRejection(caughtError)) {
              retainSessionForRecovery(
                observedGeneration,
                "A newer saved session was found, but it could not be verified. Check your connection and try again."
              );
              return false;
            }

            // Confirm that the rejected token is still the protected winner.
            // A replacement can be published while validation is in flight.
            try {
              const latestProtectedSession = await loadSession();
              if (generationRef.current !== observedGeneration) continue;
              if (
                latestProtectedSession?.accessToken !== candidate.accessToken
              ) {
                continue;
              }
            } catch {
              if (generationRef.current !== observedGeneration) continue;
              retainSessionForRecovery(
                observedGeneration,
                "The saved session could not be checked safely. Try again when protected storage is available."
              );
              return false;
            }
          }
        }

        if (!protectedSessionRead) {
          retainSessionForRecovery(
            observedGeneration,
            "The saved session could not be checked safely. Try again when protected storage is available."
          );
          return false;
        }

        const clearGeneration = ++generationRef.current;
        try {
          await clearSession();
        } catch {
          console.warn("Revoked session cleanup remains pending.");
        }

        if (generationRef.current === clearGeneration) {
          commitSession(null, "unauthenticated");
          setError("Your session is no longer valid. Sign in again.");
          return false;
        }
      }

      return (
        sessionGenerationRef.current === generationRef.current &&
        sessionRef.current?.accessToken !== staleAccessToken
      );
    },
    [commitSession, retainSessionForRecovery]
  );

  const reconcileCredentialSession = useCallback(
    (staleAccessToken: string) =>
      reconcileCredentialSessionInternal(staleAccessToken),
    [reconcileCredentialSessionInternal]
  );

  const retrySessionRecovery = useCallback(async (): Promise<void> => {
    const recoveryGeneration = generationRef.current;
    setError(null);

    let protectedSession: Session | null;
    try {
      protectedSession = await loadSession();
    } catch {
      retainSessionForRecovery(
        recoveryGeneration,
        "The saved session could not be read safely. Try again when protected storage is available."
      );
      return;
    }

    if (generationRef.current !== recoveryGeneration) return;
    if (!protectedSession) {
      commitSession(null, "unauthenticated");
      return;
    }

    let user: User;
    try {
      user = await getCurrentUser(protectedSession.accessToken);
    } catch (caughtError) {
      if (generationRef.current !== recoveryGeneration) return;
      if (isAuthoritativeSessionRejection(caughtError)) {
        await clearForForcedLogin(
          "Your saved session is no longer valid. Sign in again."
        );
        return;
      }
      retainSessionForRecovery(
        recoveryGeneration,
        "Could not verify your saved session. Check your connection and try again."
      );
      return;
    }

    if (generationRef.current !== recoveryGeneration) return;
    const validatedSession = { ...protectedSession, user };
    try {
      await persistSession(validatedSession);
    } catch {
      if (generationRef.current !== recoveryGeneration) return;
      retainSessionForRecovery(
        recoveryGeneration,
        "The verified session could not be stored safely. Try again when protected storage is available."
      );
      return;
    }

    if (generationRef.current === recoveryGeneration) {
      commitSession(validatedSession, "authenticated");
      setError(null);
    }
  }, [clearForForcedLogin, commitSession, retainSessionForRecovery]);

  const authenticatedRequest = useCallback(
    async <TResponse,>(
      request: AuthenticatedRequest<TResponse>
    ): Promise<TResponse> => {
      const requestSession = sessionRef.current;
      const requestGeneration = generationRef.current;

      if (
        !requestSession ||
        sessionGenerationRef.current !== requestGeneration
      ) {
        throw new ApiError("Sign in required.", 401);
      }

      try {
        const response = await request(requestSession.accessToken);
        if (
          generationRef.current !== requestGeneration ||
          sessionRef.current?.accessToken !== requestSession.accessToken
        ) {
          throw new ApiError(
            "This request finished after the active session changed.",
            0
          );
        }
        return response;
      } catch (caughtError) {
        if (isSessionRevoked(caughtError)) {
          await reconcileCredentialSessionInternal(
            requestSession.accessToken
          );
        }
        throw caughtError;
      }
    },
    [reconcileCredentialSessionInternal]
  );

  const refreshCurrentUser = useCallback(async (): Promise<User> => {
    const currentSession = sessionRef.current;
    const refreshGeneration = generationRef.current;

    if (
      !currentSession ||
      sessionGenerationRef.current !== refreshGeneration
    ) {
      throw new ApiError("Sign in required.", 401);
    }

    let user: User;
    try {
      user = await getCurrentUser(currentSession.accessToken);
    } catch (caughtError) {
      if (isSessionRevoked(caughtError)) {
        await reconcileCredentialSessionInternal(
          currentSession.accessToken
        );
      }
      throw caughtError;
    }

    if (
      generationRef.current !== refreshGeneration ||
      sessionRef.current?.accessToken !== currentSession.accessToken
    ) {
      const currentUser = sessionRef.current?.user;
      if (currentUser) return currentUser;
      throw new ApiError("Sign in required.", 401);
    }

    const nextSession: Session = { ...currentSession, user };
    await persistSession(nextSession);
    if (
      generationRef.current === refreshGeneration &&
      sessionRef.current?.accessToken === currentSession.accessToken
    ) {
      commitSession(nextSession, "authenticated");
      return user;
    }

    const currentUser = sessionRef.current?.user;
    if (currentUser) return currentUser;
    throw new ApiError("Sign in required.", 401);
  }, [commitSession, reconcileCredentialSessionInternal]);

  const applyCurrentUser = useCallback(async (user: User): Promise<void> => {
    const currentSession = sessionRef.current;
    const applyGeneration = generationRef.current;
    if (
      !currentSession ||
      sessionGenerationRef.current !== applyGeneration
    ) {
      throw new ApiError("Sign in required.", 401);
    }

    // This boundary is currently used by the name-only endpoint. Preserve
    // credential/company fields from a replacement session that may be newer.
    const nextSession: Session = {
      ...currentSession,
      user: {
        ...currentSession.user,
        firstName: user.firstName,
        lastName: user.lastName
      }
    };
    await persistSession(nextSession);
    if (
      generationRef.current === applyGeneration &&
      sessionRef.current?.accessToken === currentSession.accessToken
    ) {
      commitSession(nextSession, "authenticated");
    }
  }, [commitSession]);

  const replaceSession = useCallback(async (response: Session): Promise<void> => {
    const replacementGeneration = ++generationRef.current;
    const nextSession = toSession(response);
    try {
      await persistSession(nextSession);
    } catch {
      if (generationRef.current === replacementGeneration) {
        await clearForForcedLogin(
          "Your credential changed, but the protected session could not be saved. Sign in again with the new credential."
        );
      }
      throw new ApiError("Could not save the protected replacement session.", 0);
    }

    if (generationRef.current === replacementGeneration) {
      commitSession(nextSession, "authenticated");
    }
  }, [clearForForcedLogin, commitSession]);

  const applyCompany = useCallback(async (company: Company): Promise<User> => {
    const currentSession = sessionRef.current;
    const applyGeneration = generationRef.current;

    if (
      !currentSession ||
      sessionGenerationRef.current !== applyGeneration
    ) {
      throw new ApiError("Sign in required.", 401);
    }

    const nextUser: User = { ...currentSession.user, company };
    const nextSession: Session = { ...currentSession, user: nextUser };

    try {
      await persistSession(nextSession);
    } catch (caughtError) {
      console.warn("Failed to persist updated company on auth session.", caughtError);
    }

    if (
      generationRef.current === applyGeneration &&
      sessionRef.current?.accessToken === currentSession.accessToken
    ) {
      commitSession(nextSession, "authenticated");
      return nextUser;
    }

    const currentUser = sessionRef.current?.user;
    if (currentUser) return currentUser;
    throw new ApiError("Sign in required.", 401);
  }, [commitSession]);

  const register = useCallback(async (payload: RegisterRequest) => {
    setError(null);

    try {
      return await registerUser(payload);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      throw caughtError;
    }
  }, []);

  const signOut = useCallback(async () => {
    const previousSession = sessionRef.current;
    const logoutGeneration = ++generationRef.current;
    setError(null);

    try {
      await clearSession();
    } catch (caughtError) {
      if (generationRef.current !== logoutGeneration) return;

      if (
        caughtError instanceof ProtectedSessionStorageError &&
        !caughtError.failClosed
      ) {
        commitSession(previousSession, previousSession ? "authenticated" : "unauthenticated");
        setError(
          "Could not sign out safely because durable session cleanup is unavailable. Try again."
        );
        throw caughtError;
      }

      commitSession(null, "unauthenticated");
      setError(
        "Signed out locally. Protected-session cleanup will be retried before any saved session can be restored."
      );
      return;
    }

    if (generationRef.current === logoutGeneration) {
      commitSession(null, "unauthenticated");
    }
  }, [commitSession]);

  const clearErrorValue = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      error,
      authenticatedRequest,
      refreshCurrentUser,
      applyCurrentUser,
      applyCompany,
      replaceSession,
      reconcileCredentialSession,
      retrySessionRecovery,
      signIn,
      register,
      signOut,
      clearError: clearErrorValue
    }),
    [
      authenticatedRequest,
      applyCurrentUser,
      applyCompany,
      clearErrorValue,
      error,
      register,
      refreshCurrentUser,
      reconcileCredentialSession,
      retrySessionRecovery,
      replaceSession,
      session?.user,
      signIn,
      signOut,
      status
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return value;
}
