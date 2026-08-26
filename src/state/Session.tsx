import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import { endpoints } from "../api/endpoints";
import { clearTokens, getRefreshToken, saveTokens } from "../api/tokens";
import { setSessionExpiredHandler } from "../api/client";
import type { AuthResponse, SetupStatus } from "../api/types";

type Status = "restoring" | "authenticated" | "anonymous";

interface SessionValue {
  status: Status;
  setup: SetupStatus | null;
  /** Applies an auth response: persists tokens and marks the session live. */
  adopt: (res: AuthResponse, opts?: { biometric?: boolean }) => Promise<void>;
  refreshSetup: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionValue | undefined>(undefined);

/**
 * Owns authentication state for the app.
 *
 * Replaces the previous local-only SetupProgress: onboarding completion is now
 * read from the server (`/v1/me/setup-status`), so progress survives a reinstall
 * instead of resetting with component state.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("restoring");
  const [setup, setSetup] = useState<SetupStatus | null>(null);

  const signOut = useCallback(async () => {
    const refreshToken = await getRefreshToken().catch(() => null);
    if (refreshToken) await endpoints.auth.logout(refreshToken).catch(() => {});
    await clearTokens();
    setSetup(null);
    setStatus("anonymous");
  }, []);

  // The API client calls this when a refresh finally fails.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setSetup(null);
      setStatus("anonymous");
    });
  }, []);

  const refreshSetup = useCallback(async () => {
    try { setSetup(await endpoints.me.setupStatus()); } catch { /* keep last known */ }
  }, []);

  const adopt = useCallback(async (res: AuthResponse, opts?: { biometric?: boolean }) => {
    await saveTokens(res.tokens, opts);
    setSetup(res.setup);
    setStatus("authenticated");
  }, []);

  // Cold start: try to restore a session from the Keychain.
  useEffect(() => {
    let alive = true;
    (async () => {
      const refreshToken = await getRefreshToken().catch(() => null);
      if (!refreshToken) { if (alive) setStatus("anonymous"); return; }
      try {
        const status = await endpoints.me.setupStatus(); // client auto-refreshes on 401
        if (!alive) return;
        setSetup(status);
        setStatus("authenticated");
      } catch {
        await clearTokens();
        if (alive) setStatus("anonymous");
      }
    })();
    return () => { alive = false; };
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ status, setup, adopt, refreshSetup, signOut }),
    [status, setup, adopt, refreshSetup, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used within a SessionProvider");
  return v;
}
