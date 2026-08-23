import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { getCurrentUser, loginUser, registerUser } from "../api/auth";
import { ApiError, getErrorMessage } from "../api/errors";
import {
  clearSession,
  loadSession,
  saveSession as persistSession
} from "../storage/sessionStorage";
import type {
  Company,
  LoginRequest,
  RegisterRequest,
  Session,
  User
} from "../types/auth";

type AuthStatus = "restoring" | "authenticated" | "unauthenticated";

type AuthenticatedRequest<TResponse> = (token: string) => Promise<TResponse>;

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  error: string | null;
  authenticatedRequest: <TResponse>(
    request: AuthenticatedRequest<TResponse>
  ) => Promise<TResponse>;
  refreshCurrentUser: () => Promise<User>;
  applyCompany: (company: Company) => Promise<User>;
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

async function clearSessionSafely(reason: string): Promise<void> {
  try {
    await clearSession();
  } catch (error) {
    console.warn(`Failed to clear auth session during ${reason}.`, error);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  const restoreSession = useCallback(async () => {
    try {
      const storedSession = await loadSession();

      if (!storedSession) {
        setStatus("unauthenticated");
        return;
      }

      const user = await getCurrentUser(storedSession.accessToken);
      const restoredSession = {
        ...storedSession,
        user
      };

      await persistSession(restoredSession);
      setSession(restoredSession);
      setStatus("authenticated");
    } catch (error) {
      console.warn("Failed to restore auth session.", error);
      await clearSessionSafely("session restore");
      setSession(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    const restoreTask = setTimeout(() => {
      void restoreSession();
    }, 0);

    return () => {
      clearTimeout(restoreTask);
    };
  }, [restoreSession]);

  const signIn = useCallback(async (payload: LoginRequest) => {
    setError(null);

    try {
      const response = await loginUser(payload);
      const nextSession = toSession(response);

      await persistSession(nextSession);
      setSession(nextSession);
      setStatus("authenticated");
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw caughtError;
    }
  }, []);

  const authenticatedRequest = useCallback(
    async <TResponse,>(
      request: AuthenticatedRequest<TResponse>
    ): Promise<TResponse> => {
      const token = session?.accessToken;

      if (!token) {
        throw new ApiError("Sign in required.", 401);
      }

      return request(token);
    },
    [session?.accessToken]
  );

  const refreshCurrentUser = useCallback(async (): Promise<User> => {
    const token = session?.accessToken;
    const tokenType = session?.tokenType;

    if (!token || !tokenType) {
      throw new ApiError("Sign in required.", 401);
    }

    const user = await getCurrentUser(token);
    const nextSession: Session = {
      accessToken: token,
      tokenType,
      user
    };

    await persistSession(nextSession);
    setSession(nextSession);
    setStatus("authenticated");

    return user;
  }, [session?.accessToken, session?.tokenType]);

  const applyCompany = useCallback(async (company: Company): Promise<User> => {
    const currentSession = session;

    if (!currentSession) {
      throw new ApiError("Sign in required.", 401);
    }

    const nextUser: User = {
      ...currentSession.user,
      company
    };
    const nextSession: Session = {
      ...currentSession,
      user: nextUser
    };

    try {
      await persistSession(nextSession);
    } catch (error) {
      console.warn("Failed to persist updated company on auth session.", error);
    }

    setSession(nextSession);
    setStatus("authenticated");

    return nextUser;
  }, [session]);

  const register = useCallback(async (payload: RegisterRequest) => {
    setError(null);

    try {
      return await registerUser(payload);
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw caughtError;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await clearSession();
    } catch (error) {
      console.warn("Failed to clear auth session during logout.", error);
    } finally {
      setSession(null);
      setStatus("unauthenticated");
    }
  }, []);

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
      applyCompany,
      signIn,
      register,
      signOut,
      clearError: clearErrorValue
    }),
    [
      authenticatedRequest,
      applyCompany,
      clearErrorValue,
      error,
      register,
      refreshCurrentUser,
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
