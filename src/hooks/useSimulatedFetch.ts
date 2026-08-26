import { useCallback, useEffect, useRef, useState } from "react";

type Status = "loading" | "success" | "error";

/**
 * Stands in for a real data fetch until the API layer exists, so the UI can
 * exercise its loading / error / retry states. Replace with the real query
 * hook when the backend lands — the screen contract stays the same.
 */
export function useSimulatedFetch(delay = 650) {
  const [status, setStatus] = useState<Status>("loading");
  const attempt = useRef(0);
  const mounted = useRef(true);

  const run = useCallback(() => {
    setStatus("loading");
    attempt.current += 1;
    const t = setTimeout(() => {
      if (mounted.current) setStatus("success");
    }, delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    mounted.current = true;
    const cancel = run();
    return () => {
      mounted.current = false;
      cancel();
    };
  }, [run]);

  return { status, retry: run };
}
