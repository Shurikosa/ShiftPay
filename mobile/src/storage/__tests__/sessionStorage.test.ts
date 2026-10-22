import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  ProtectedSessionStorageError,
  clearSession,
  loadSession,
  saveSession
} from "../sessionStorage";
import type { Session } from "../../types/auth";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  multiRemove: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn()
}));
jest.mock("expo-secure-store", () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  isAvailableAsync: jest.fn(),
  setItemAsync: jest.fn()
}));

const session: Session = {
  accessToken: "protected-token",
  tokenType: "Bearer",
  user: {
    id: 7,
    email: "worker@example.com",
    firstName: "Avery",
    lastName: "Worker",
    role: "WORKER",
    company: null
  }
};

const getAsyncItem = jest.mocked(AsyncStorage.getItem);
const getSecureItem = jest.mocked(SecureStore.getItemAsync);
const secureAvailable = jest.mocked(SecureStore.isAvailableAsync);
const setSecureItem = jest.mocked(SecureStore.setItemAsync);
const deleteSecureItem = jest.mocked(SecureStore.deleteItemAsync);
const setAsyncItem = jest.mocked(AsyncStorage.setItem);
const removeAsyncItem = jest.mocked(AsyncStorage.removeItem);
const removeAsyncItems = jest.mocked(AsyncStorage.multiRemove);

describe("protected session storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    secureAvailable.mockResolvedValue(true);
    getSecureItem.mockResolvedValue(null);
    getAsyncItem.mockResolvedValue(null);
    setSecureItem.mockResolvedValue(undefined);
    deleteSecureItem.mockResolvedValue(undefined);
    setAsyncItem.mockResolvedValue(undefined);
    removeAsyncItem.mockResolvedValue(undefined);
    removeAsyncItems.mockResolvedValue(undefined);
  });

  it("stores the token and user together in SecureStore and never writes an AsyncStorage fallback", async () => {
    await saveSession(session);

    expect(setSecureItem).toHaveBeenCalledWith(
      "shiftpay.session",
      JSON.stringify(session)
    );
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      "shiftpay.accessToken",
      "shiftpay.tokenType",
      "shiftpay.user"
    ]);
  });

  it("deletes a fallback-only legacy token and requires login without using or copying it", async () => {
    getAsyncItem.mockImplementation(async (key) => {
      if (key === "shiftpay.accessToken") return "legacy-unprotected-token";
      if (key === "shiftpay.tokenType") return "Bearer";
      if (key === "shiftpay.user") return JSON.stringify(session.user);
      return null;
    });

    await expect(loadSession()).resolves.toBeNull();
    expect(setSecureItem).not.toHaveBeenCalled();
    expect(AsyncStorage.multiRemove).toHaveBeenCalled();
  });

  it("keeps a protected session and deletes only duplicate legacy state", async () => {
    getSecureItem.mockImplementation(async (key) =>
      key === "shiftpay.session" ? JSON.stringify(session) : null
    );
    getAsyncItem.mockImplementation(async (key) =>
      key === "shiftpay.accessToken" ? "duplicate-legacy-value" : null
    );

    await expect(loadSession()).resolves.toEqual(session);
    expect(setSecureItem).not.toHaveBeenCalled();
    expect(AsyncStorage.multiRemove).toHaveBeenCalled();
  });

  it("migrates the previous protected-token format without accepting its AsyncStorage token copy", async () => {
    getSecureItem.mockImplementation(async (key) =>
      key === "shiftpay.accessToken" ? session.accessToken : null
    );
    getAsyncItem.mockImplementation(async (key) => {
      if (key === "shiftpay.accessToken") return "unprotected-copy";
      if (key === "shiftpay.tokenType") return "Bearer";
      if (key === "shiftpay.user") return JSON.stringify(session.user);
      return null;
    });

    await expect(loadSession()).resolves.toEqual(session);
    expect(setSecureItem).toHaveBeenCalledWith(
      "shiftpay.session",
      JSON.stringify(session)
    );
  });

  it("deletes legacy unprotected state and fails closed when SecureStore is unavailable", async () => {
    secureAvailable.mockResolvedValue(false);

    await expect(loadSession()).rejects.toBeInstanceOf(
      ProtectedSessionStorageError
    );
    expect(AsyncStorage.multiRemove).toHaveBeenCalled();
    expect(getAsyncItem).toHaveBeenCalledWith("shiftpay.sessionClearPending");
    expect(getAsyncItem).not.toHaveBeenCalledWith("shiftpay.accessToken");
  });

  it("fails closed without a fallback when the protected session cannot be read", async () => {
    getSecureItem.mockRejectedValueOnce(new Error("keystore read failed"));

    await expect(loadSession()).rejects.toBeInstanceOf(
      ProtectedSessionStorageError
    );
    expect(setSecureItem).not.toHaveBeenCalled();
    expect(getAsyncItem).not.toHaveBeenCalledWith("shiftpay.accessToken");
  });

  it("does not create a fallback when a protected write fails", async () => {
    setSecureItem.mockRejectedValue(new Error("keystore write failed"));

    await expect(saveSession(session)).rejects.toBeInstanceOf(
      ProtectedSessionStorageError
    );
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("clears protected and legacy locations on logout", async () => {
    await clearSession();

    expect(setAsyncItem).toHaveBeenCalledWith(
      "shiftpay.sessionClearPending",
      "1"
    );
    expect(AsyncStorage.multiRemove).toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("shiftpay.session");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("shiftpay.accessToken");
    expect(removeAsyncItem).toHaveBeenCalledWith("shiftpay.sessionClearPending");
  });

  it("does not touch a still-valid protected token when the durable marker cannot be written", async () => {
    setAsyncItem.mockRejectedValueOnce(new Error("AsyncStorage write failed"));

    await expect(clearSession()).rejects.toMatchObject({
      name: "ProtectedSessionStorageError",
      failClosed: false
    });
    expect(deleteSecureItem).not.toHaveBeenCalled();
  });

  it("blocks relaunch restore while protected deletion is unavailable, then finishes cleanup", async () => {
    let marker: string | null = null;
    setAsyncItem.mockImplementation(async (key, value) => {
      if (key === "shiftpay.sessionClearPending") marker = value;
    });
    getAsyncItem.mockImplementation(async (key) =>
      key === "shiftpay.sessionClearPending" ? marker : null
    );
    removeAsyncItem.mockImplementation(async (key) => {
      if (key === "shiftpay.sessionClearPending") marker = null;
    });
    secureAvailable.mockResolvedValueOnce(false);

    await expect(clearSession()).rejects.toMatchObject({ failClosed: true });
    expect(marker).toBe("1");
    expect(getSecureItem).not.toHaveBeenCalled();

    secureAvailable.mockResolvedValue(true);
    await expect(loadSession()).resolves.toBeNull();
    expect(deleteSecureItem).toHaveBeenCalledWith("shiftpay.session");
    expect(marker).toBeNull();
    expect(getSecureItem).not.toHaveBeenCalled();
  });

  it("keeps the relaunch block when protected deletion fails", async () => {
    let marker: string | null = null;
    setAsyncItem.mockImplementation(async (_key, value) => { marker = value; });
    getAsyncItem.mockImplementation(async (key) =>
      key === "shiftpay.sessionClearPending" ? marker : null
    );
    deleteSecureItem.mockRejectedValueOnce(new Error("keystore delete failed"));

    await expect(clearSession()).rejects.toMatchObject({ failClosed: true });
    await expect(loadSession()).resolves.toBeNull();
    expect(getSecureItem).not.toHaveBeenCalledWith("shiftpay.session");
  });

  it("keeps the relaunch block when legacy AsyncStorage deletion fails", async () => {
    let marker: string | null = null;
    setAsyncItem.mockImplementation(async (_key, value) => { marker = value; });
    getAsyncItem.mockImplementation(async (key) =>
      key === "shiftpay.sessionClearPending" ? marker : null
    );
    removeAsyncItems.mockRejectedValueOnce(new Error("legacy delete failed"));

    await expect(clearSession()).rejects.toMatchObject({ failClosed: true });
    expect(marker).toBe("1");
    await expect(loadSession()).resolves.toBeNull();
    expect(getSecureItem).not.toHaveBeenCalledWith("shiftpay.session");
  });

  it("retries cleanup on relaunch when removing the durable marker fails once", async () => {
    let marker: string | null = null;
    let markerRemovalAttempts = 0;
    setAsyncItem.mockImplementation(async (key, value) => {
      if (key === "shiftpay.sessionClearPending") marker = value;
    });
    getAsyncItem.mockImplementation(async (key) =>
      key === "shiftpay.sessionClearPending" ? marker : null
    );
    removeAsyncItem.mockImplementation(async (key) => {
      if (key !== "shiftpay.sessionClearPending") return;
      markerRemovalAttempts += 1;
      if (markerRemovalAttempts === 1) {
        throw new Error("marker remove failed");
      }
      marker = null;
    });

    await expect(clearSession()).rejects.toMatchObject({ failClosed: true });
    expect(marker).toBe("1");
    expect(deleteSecureItem).toHaveBeenCalledWith("shiftpay.session");

    await expect(loadSession()).resolves.toBeNull();
    expect(getSecureItem).not.toHaveBeenCalledWith("shiftpay.session");
    expect(markerRemovalAttempts).toBe(2);
    expect(marker).toBeNull();
  });

  it("fails closed without reading SecureStore when the pending-clear marker cannot be read", async () => {
    getAsyncItem.mockRejectedValueOnce(new Error("AsyncStorage read failed"));

    await expect(loadSession()).rejects.toMatchObject({ failClosed: true });
    expect(getSecureItem).not.toHaveBeenCalled();
  });

  it("serializes overlapping protected writes and logout so stale writes cannot finish last", async () => {
    let finishOldWrite!: () => void;
    setSecureItem
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => { finishOldWrite = resolve; })
      )
      .mockResolvedValue(undefined);
    const newerSession: Session = {
      ...session,
      accessToken: "newer-token",
      user: { ...session.user, email: "newer@example.com" }
    };

    const oldWrite = saveSession(session);
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
    const newerWrite = saveSession(newerSession);
    const logout = clearSession();
    await Promise.resolve();

    expect(setSecureItem).toHaveBeenCalledTimes(1);
    expect(setAsyncItem).not.toHaveBeenCalledWith(
      "shiftpay.sessionClearPending",
      "1"
    );

    finishOldWrite();
    await Promise.all([oldWrite, newerWrite, logout]);

    expect(setSecureItem.mock.calls.map(([, value]) => value)).toEqual([
      JSON.stringify(session),
      JSON.stringify(newerSession)
    ]);
    expect(
      setSecureItem.mock.invocationCallOrder[1]
    ).toBeLessThan(setAsyncItem.mock.invocationCallOrder[0]!);
    expect(
      setAsyncItem.mock.invocationCallOrder[0]
    ).toBeLessThan(
      deleteSecureItem.mock.invocationCallOrder.find(
        (_order, index) => deleteSecureItem.mock.calls[index]?.[0] === "shiftpay.session"
      )!
    );
  });
});
