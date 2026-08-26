import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

interface SetupProgress {
  passwordDone: boolean;
  historyDone: boolean;
  markPasswordDone: () => void;
  markHistoryDone: () => void;
}

const SetupProgressContext = createContext<SetupProgress | undefined>(undefined);

/**
 * Tracks how far the user has gotten through account setup (password,
 * medical history). Kept outside navigation params so the checklist screen
 * always renders the current state when the user navigates back to it.
 */
export function SetupProgressProvider({ children }: { children: React.ReactNode }) {
  const [passwordDone, setPasswordDone] = useState(false);
  const [historyDone, setHistoryDone] = useState(false);

  const markPasswordDone = useCallback(() => setPasswordDone(true), []);
  const markHistoryDone = useCallback(() => setHistoryDone(true), []);

  const value = useMemo(
    () => ({ passwordDone, historyDone, markPasswordDone, markHistoryDone }),
    [passwordDone, historyDone, markPasswordDone, markHistoryDone]
  );

  return <SetupProgressContext.Provider value={value}>{children}</SetupProgressContext.Provider>;
}

export function useSetupProgress(): SetupProgress {
  const ctx = useContext(SetupProgressContext);
  if (!ctx) throw new Error("useSetupProgress must be used within a SetupProgressProvider");
  return ctx;
}
