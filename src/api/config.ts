import { Platform } from "react-native";

/**
 * API base URL. Public (non-secret) build config only — anything shipped in
 * the bundle is readable, so no credentials live here.
 *
 * Android emulators reach the host machine on 10.0.2.2, iOS simulators on
 * localhost, so development falls back per-platform when the env var is unset.
 */
const devFallback = Platform.select({
  android: "http://10.0.2.2:3000",
  default: "http://localhost:3000",
})!;

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? devFallback;
export const REQUEST_TIMEOUT_MS = 15000;
