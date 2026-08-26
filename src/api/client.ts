import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "./config";
import { ApiError, type ApiErrorCode } from "./errors";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens, type TokenPair } from "./tokens";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: Method;
  body?: unknown;
  /** Skips the Authorization header (auth endpoints). */
  anonymous?: boolean;
  /** Replay guard for mutations — one key per form instance. */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

/** Called when the session is unrecoverable; the navigator resets to Sign in. */
type SessionExpiredHandler = () => void;
let onSessionExpired: SessionExpiredHandler = () => {};
export function setSessionExpiredHandler(fn: SessionExpiredHandler) { onSessionExpired = fn; }

/**
 * Single-flight refresh. Without this, several parallel 401s each rotate the
 * refresh token and the server's reuse detector revokes the whole chain.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return false;
      const res = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const json = (await res.json()) as { tokens: TokenPair };
      await saveTokens(json.tokens);
      return true;
    } catch {
      return false;
    } finally {
      // cleared on the next tick so concurrent callers all observe this result
      setTimeout(() => { refreshInFlight = null; }, 0);
    }
  })();
  return refreshInFlight;
}

async function parseError(res: Response, requestId?: string): Promise<ApiError> {
  let code: ApiErrorCode = "internal";
  let message = "Something went wrong. Please try again.";
  let fields: Record<string, string> | undefined;
  let meta: Record<string, unknown> = {};
  try {
    const body = (await res.json()) as { error?: Record<string, unknown> };
    if (body?.error) {
      const e = body.error;
      code = (e.code as ApiErrorCode) ?? code;
      message = (e.message as string) ?? message;
      fields = e.fields as Record<string, string> | undefined;
      const { code: _c, message: _m, fields: _f, requestId: _r, ...rest } = e;
      meta = rest;
      requestId = (e.requestId as string) ?? requestId;
    }
  } catch { /* non-JSON error body: keep the generic message */ }
  return new ApiError({ code, message, status: res.status, fields, meta, requestId });
}

async function raw(path: string, opts: RequestOptions, retrying = false): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey;
  if (!opts.anonymous) {
    const token = await getAccessToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal ?? controller.signal,
    });
  } catch (e) {
    throw (e as Error)?.name === "AbortError" ? ApiError.timeout() : ApiError.network();
  } finally {
    clearTimeout(timer);
  }

  // Access token expired: refresh once, then replay the original request.
  if (res.status === 401 && !opts.anonymous && !retrying) {
    const ok = await refreshSession();
    if (ok) return raw(path, opts, true);
    await clearTokens();
    onSessionExpired();
  }
  return res;
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await raw(path, opts);
  if (!res.ok) throw await parseError(res, res.headers.get("x-request-id") ?? undefined);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "PATCH", body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "DELETE" }),
};

/** Uploads bytes to a presigned URL returned by the API. */
export async function uploadToSignedUrl(url: string, blob: Blob, contentType: string): Promise<void> {
  const res = await fetch(url, { method: "PUT", headers: { "content-type": contentType }, body: blob });
  if (!res.ok) throw await parseError(res);
}
