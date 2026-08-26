import * as SecureStore from "expo-secure-store";

/**
 * Token storage. Uses the Keychain / Keystore via expo-secure-store — never
 * AsyncStorage, which is plaintext on disk.
 *
 * When biometric unlock is enabled the refresh token is written with
 * `requireAuthentication`, so the OS demands Face ID / Optic ID before it is
 * released. The server never sees or trusts that biometric result: it only
 * gates local access to a credential the device already holds.
 */
const ACCESS_KEY = "medpilot.access";
const REFRESH_KEY = "medpilot.refresh";
const REFRESH_BIO_KEY = "medpilot.refresh.bio";

export interface TokenPair { accessToken: string; refreshToken: string; expiresIn: number }

let accessCache: string | null = null;

export async function saveTokens(pair: TokenPair, opts?: { biometric?: boolean }): Promise<void> {
  accessCache = pair.accessToken;
  await SecureStore.setItemAsync(ACCESS_KEY, pair.accessToken);
  if (opts?.biometric) {
    await SecureStore.setItemAsync(REFRESH_BIO_KEY, pair.refreshToken, {
      requireAuthentication: true,
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {});
  } else {
    await SecureStore.setItemAsync(REFRESH_KEY, pair.refreshToken);
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (accessCache) return accessCache;
  accessCache = await SecureStore.getItemAsync(ACCESS_KEY).catch(() => null);
  return accessCache;
}

/** Reading the biometric-protected slot triggers the OS prompt. */
export async function getRefreshToken(): Promise<string | null> {
  const plain = await SecureStore.getItemAsync(REFRESH_KEY).catch(() => null);
  if (plain) return plain;
  return SecureStore.getItemAsync(REFRESH_BIO_KEY).catch(() => null);
}

export async function hasBiometricSession(): Promise<boolean> {
  // presence check without triggering the prompt is not possible on all
  // platforms; treat a missing plain token as "biometric may be enabled"
  const plain = await SecureStore.getItemAsync(REFRESH_KEY).catch(() => null);
  return !plain;
}

export async function clearTokens(): Promise<void> {
  accessCache = null;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(REFRESH_BIO_KEY).catch(() => {}),
  ]);
}
