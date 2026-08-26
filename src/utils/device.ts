import * as SecureStore from "expo-secure-store";

const KEY = "medpilot.installId";

/**
 * Stable per-install identifier used to register the device for push and to
 * bind biometric unlock. Generated once and kept in secure storage.
 */
export async function getInstallId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY).catch(() => null);
  if (existing) return existing;
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  await SecureStore.setItemAsync(KEY, id).catch(() => {});
  return id;
}

/** Fresh idempotency key for a single mutation attempt. */
export function newIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}
