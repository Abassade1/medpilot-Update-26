import { Platform } from "react-native";

/**
 * Build-time API configuration. Everything here is public: anything shipped in
 * the bundle is readable, so no credentials ever live in this file.
 *
 * The environment is explicit rather than inferred. A staging or production
 * build that forgets EXPO_PUBLIC_API_URL fails loudly at startup instead of
 * silently pointing at a developer's laptop, and a deployed build is required
 * to use https so tokens and health data never cross the network in the clear.
 */
export type AppEnvironment = "development" | "staging" | "production";

const rawEnv = process.env.EXPO_PUBLIC_ENV ?? "development";
if (rawEnv !== "development" && rawEnv !== "staging" && rawEnv !== "production") {
  throw new Error(
    `EXPO_PUBLIC_ENV must be development, staging or production (got "${rawEnv}").`,
  );
}
export const APP_ENV: AppEnvironment = rawEnv;
export const IS_DEPLOYED = APP_ENV !== "development";

/**
 * Android emulators reach the host machine on 10.0.2.2, iOS simulators on
 * localhost — so only development has a sensible default.
 */
const devFallback = Platform.select({
  android: "http://10.0.2.2:3000",
  default: "http://localhost:3000",
})!;

function resolveBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (!IS_DEPLOYED) return configured || devFallback;

  if (!configured) {
    throw new Error(
      `EXPO_PUBLIC_API_URL is required for a ${APP_ENV} build. ` +
        `Set it in .env.${APP_ENV} or in the EAS build profile.`,
    );
  }
  if (!configured.startsWith("https://")) {
    throw new Error(
      `EXPO_PUBLIC_API_URL must use https in a ${APP_ENV} build (got "${configured}").`,
    );
  }
  return configured;
}

export const API_BASE_URL = resolveBaseUrl();
export const REQUEST_TIMEOUT_MS = 15000;

/** Shown in diagnostics so it is always obvious which backend a build talks to. */
export const BUILD_TARGET = `${APP_ENV} · ${API_BASE_URL}`;
