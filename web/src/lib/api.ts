const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fields?: Record<string, string>;
  readonly isOffline: boolean;
  constructor(message: string, status: number, code?: string, fields?: Record<string, string>, isOffline = false) {
    super(message);
    this.status = status; this.code = code; this.fields = fields; this.isOffline = isOffline;
  }
}

let accessToken: string | null = localStorage.getItem("mp_access") || null;
let refreshToken: string | null = localStorage.getItem("mp_refresh") || null;
let refreshing: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Screens subscribe to session changes (login/logout/refresh) instead of polling. */
export function onSessionChange(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function notify() { listeners.forEach((fn) => fn()); }

export function setSession(tokens: { accessToken: string; refreshToken: string } | null) {
  accessToken = tokens?.accessToken ?? null;
  refreshToken = tokens?.refreshToken ?? null;
  if (tokens) {
    localStorage.setItem("mp_access", tokens.accessToken);
    localStorage.setItem("mp_refresh", tokens.refreshToken);
  } else {
    localStorage.removeItem("mp_access");
    localStorage.removeItem("mp_refresh");
  }
  notify();
}
export const isSignedIn = () => !!accessToken;

async function doRefresh(): Promise<void> {
  if (!refreshToken) throw new ApiError("Not signed in", 401, "unauthenticated");
  const res = await fetch(`${BASE}/v1/auth/refresh`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) { setSession(null); throw new ApiError("Your session has expired", 401, "unauthenticated"); }
  const body = await res.json();
  setSession(body.tokens);
}

interface Opts { method?: string; body?: unknown; idempotencyKey?: string }

async function request<T>(path: string, opts: Opts = {}, retried = false): Promise<T> {
  let res: Response;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError("You appear to be offline. Check your connection and try again.", 0, "network", undefined, true);
  }

  if (res.status === 401 && !retried && refreshToken) {
    // One shared in-flight refresh so a burst of 401s doesn't spawn parallel refresh calls.
    refreshing ??= doRefresh().finally(() => { refreshing = null; });
    try { await refreshing; return request<T>(path, opts, true); } catch { /* fall through to surface the 401 */ }
  }

  if (res.status === 204) return undefined as T;
  let payload: unknown = null;
  try { payload = await res.json(); } catch { /* empty body */ }

  if (!res.ok) {
    const err = (payload as { error?: { message?: string; code?: string; fields?: Record<string, string> } } | null)?.error;
    throw new ApiError(err?.message || `Request failed (${res.status})`, res.status, err?.code, err?.fields);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, idempotencyKey?: string) => request<T>(path, { method: "POST", body, idempotencyKey }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Two-phase upload (presigned PUT, then confirm) used for provider logos, covers and listing photos. */
export async function uploadProviderImage(file: File): Promise<string> {
  if (file.type !== "image/jpeg" && file.type !== "image/png") {
    throw new ApiError("Please choose a JPEG or PNG image.", 415, "unsupported_type");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ApiError(`Images must be under ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`, 413, "file_too_large");
  }
  const ticket = await api.post<{ fileId: string; uploadUrl: string }>("/v1/provider/images/upload-url", {
    mimeType: file.type, sizeBytes: file.size,
  });
  const put = await fetch(ticket.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!put.ok) throw new ApiError("That upload didn't go through. Please try again.", put.status);
  const { url } = await api.post<{ url: string }>(`/v1/provider/images/${ticket.fileId}/confirm`);
  return url;
}
