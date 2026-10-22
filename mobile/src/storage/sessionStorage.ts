import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { Session, User } from "../types/auth";

const PROTECTED_SESSION_KEY = "shiftpay.session";
const LEGACY_ACCESS_TOKEN_KEY = "shiftpay.accessToken";
const LEGACY_TOKEN_TYPE_KEY = "shiftpay.tokenType";
const LEGACY_USER_KEY = "shiftpay.user";
const PENDING_CLEAR_KEY = "shiftpay.sessionClearPending";

let storageQueue: Promise<void> = Promise.resolve();

export class ProtectedSessionStorageError extends Error {
  public readonly failClosed: boolean;

  public constructor(
    message = "Protected session storage is unavailable.",
    failClosed = true
  ) {
    super(message);
    this.name = "ProtectedSessionStorageError";
    this.failClosed = failClosed;
  }
}

function withStorageLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageQueue.then(operation, operation);
  storageQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function isUser(value: unknown): value is User {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<User>;
  return (
    typeof candidate.id === "number" &&
    typeof candidate.email === "string" &&
    typeof candidate.firstName === "string" &&
    typeof candidate.lastName === "string" &&
    (candidate.role === "WORKER" ||
      candidate.role === "FOREMAN" ||
      candidate.role === "ADMIN") &&
    (candidate.company === null || typeof candidate.company === "object")
  );
}

function parseSession(value: string | null): Session | null {
  if (!value) {
    return null;
  }

  try {
    const candidate = JSON.parse(value) as Partial<Session>;
    if (
      typeof candidate.accessToken === "string" &&
      candidate.accessToken.length > 0 &&
      candidate.tokenType === "Bearer" &&
      isUser(candidate.user)
    ) {
      return candidate as Session;
    }
  } catch {
    // Invalid protected state is cleared by the caller.
  }

  return null;
}

async function isProtectedStorageAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

async function clearLegacyAsyncStorage(): Promise<void> {
  await AsyncStorage.multiRemove([
    LEGACY_ACCESS_TOKEN_KEY,
    LEGACY_TOKEN_TYPE_KEY,
    LEGACY_USER_KEY
  ]);
}

async function readPendingClearMarker(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PENDING_CLEAR_KEY)) !== null;
  } catch {
    throw new ProtectedSessionStorageError(
      "Could not verify whether the saved session is blocked."
    );
  }
}

async function requireProtectedStorage(): Promise<void> {
  if (!(await isProtectedStorageAvailable())) {
    try {
      await clearLegacyAsyncStorage();
    } catch {
      // Protected storage remains the authoritative reason to fail closed.
    }
    throw new ProtectedSessionStorageError();
  }
}

async function finishPendingClear(): Promise<void> {
  let failure: unknown = null;

  if (await isProtectedStorageAvailable()) {
    try {
      await SecureStore.deleteItemAsync(PROTECTED_SESSION_KEY);
      await SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY);
    } catch (error) {
      failure = error;
    }
  } else {
    failure = new Error("Protected storage is unavailable.");
  }

  try {
    await clearLegacyAsyncStorage();
  } catch (error) {
    failure ??= error;
  }

  if (failure) {
    throw new ProtectedSessionStorageError(
      "The saved session is blocked, but storage cleanup is still pending."
    );
  }

  try {
    await AsyncStorage.removeItem(PENDING_CLEAR_KEY);
  } catch {
    throw new ProtectedSessionStorageError(
      "The saved session remains blocked until cleanup can be verified."
    );
  }
}

async function saveSessionUnlocked(session: Session): Promise<void> {
  if (await readPendingClearMarker()) {
    throw new ProtectedSessionStorageError(
      "The previous session must be cleared before a new session can be saved."
    );
  }

  await requireProtectedStorage();

  // Remove every legacy copy before publishing the protected session. This
  // avoids a partially successful save that could look complete to the UI.
  try {
    await clearLegacyAsyncStorage();
    await SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY);
  } catch {
    throw new ProtectedSessionStorageError(
      "Could not remove legacy session state before saving."
    );
  }

  try {
    await SecureStore.setItemAsync(PROTECTED_SESSION_KEY, JSON.stringify(session));
  } catch {
    throw new ProtectedSessionStorageError("Could not save the protected session.");
  }
}

export function saveSession(session: Session): Promise<void> {
  return withStorageLock(() => saveSessionUnlocked(session));
}

async function loadSessionUnlocked(): Promise<Session | null> {
  if (await readPendingClearMarker()) {
    await finishPendingClear();
    return null;
  }

  await requireProtectedStorage();

  let protectedValue: string | null;
  try {
    protectedValue = await SecureStore.getItemAsync(PROTECTED_SESSION_KEY);
  } catch {
    throw new ProtectedSessionStorageError("Could not read the protected session.");
  }

  const protectedSession = parseSession(protectedValue);
  if (protectedSession) {
    try {
      await clearLegacyAsyncStorage();
      await SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY);
    } catch {
      throw new ProtectedSessionStorageError(
        "Could not remove duplicate legacy session state."
      );
    }
    return protectedSession;
  }

  if (protectedValue) {
    try {
      await SecureStore.deleteItemAsync(PROTECTED_SESSION_KEY);
    } catch {
      throw new ProtectedSessionStorageError(
        "Could not remove an invalid protected session."
      );
    }
  }

  // Migrate only the previous protected-token format. A token found solely in
  // AsyncStorage is deleted and is never authenticated or copied.
  let legacyProtectedToken: string | null;
  let legacyAsyncToken: string | null;
  let tokenType: string | null;
  let userJson: string | null;
  try {
    [legacyProtectedToken, legacyAsyncToken, tokenType, userJson] =
      await Promise.all([
        SecureStore.getItemAsync(LEGACY_ACCESS_TOKEN_KEY),
        AsyncStorage.getItem(LEGACY_ACCESS_TOKEN_KEY),
        AsyncStorage.getItem(LEGACY_TOKEN_TYPE_KEY),
        AsyncStorage.getItem(LEGACY_USER_KEY)
      ]);
  } catch {
    throw new ProtectedSessionStorageError("Could not inspect legacy session state.");
  }

  if (legacyProtectedToken && tokenType === "Bearer" && userJson) {
    const user = (() => {
      try {
        const value = JSON.parse(userJson) as unknown;
        return isUser(value) ? value : null;
      } catch {
        return null;
      }
    })();

    if (user) {
      const migratedSession: Session = {
        accessToken: legacyProtectedToken,
        tokenType: "Bearer",
        user
      };
      try {
        await clearLegacyAsyncStorage();
        await SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY);
        await SecureStore.setItemAsync(
          PROTECTED_SESSION_KEY,
          JSON.stringify(migratedSession)
        );
      } catch {
        throw new ProtectedSessionStorageError(
          "Could not migrate the protected session."
        );
      }
      return migratedSession;
    }
  }

  if (legacyAsyncToken || legacyProtectedToken || tokenType || userJson) {
    try {
      await clearLegacyAsyncStorage();
      await SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY);
    } catch {
      throw new ProtectedSessionStorageError("Could not clear legacy session state.");
    }
  }

  return null;
}

export function loadSession(): Promise<Session | null> {
  return withStorageLock(loadSessionUnlocked);
}

async function clearSessionUnlocked(): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_CLEAR_KEY, "1");
  } catch {
    throw new ProtectedSessionStorageError(
      "Could not establish durable session cleanup.",
      false
    );
  }

  await finishPendingClear();
}

export function clearSession(): Promise<void> {
  return withStorageLock(clearSessionUnlocked);
}
