import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { Session, User } from "../types/auth";

const ACCESS_TOKEN_KEY = "shiftpay.accessToken";
const TOKEN_TYPE_KEY = "shiftpay.tokenType";
const USER_KEY = "shiftpay.user";

async function secureStoreAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

async function setToken(token: string): Promise<void> {
  if (await secureStoreAvailable()) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
    return;
  }

  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token);
}

async function getToken(): Promise<string | null> {
  if (await secureStoreAvailable()) {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  }

  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

async function deleteToken(): Promise<void> {
  if (await secureStoreAvailable()) {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    return;
  }

  await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
}

export async function saveSession(session: Session): Promise<void> {
  await Promise.all([
    setToken(session.accessToken),
    AsyncStorage.setItem(TOKEN_TYPE_KEY, session.tokenType),
    AsyncStorage.setItem(USER_KEY, JSON.stringify(session.user))
  ]);
}

export async function loadSession(): Promise<Session | null> {
  const [accessToken, tokenType, userJson] = await Promise.all([
    getToken(),
    AsyncStorage.getItem(TOKEN_TYPE_KEY),
    AsyncStorage.getItem(USER_KEY)
  ]);

  if (!accessToken || tokenType !== "Bearer" || !userJson) {
    return null;
  }

  try {
    const user = JSON.parse(userJson) as User;

    return {
      accessToken,
      tokenType,
      user
    };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    deleteToken(),
    AsyncStorage.removeItem(TOKEN_TYPE_KEY),
    AsyncStorage.removeItem(USER_KEY)
  ]);
}
