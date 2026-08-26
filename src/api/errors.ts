/** Error codes the API returns in its envelope (backend §10). */
export type ApiErrorCode =
  | "bad_request" | "unauthenticated" | "forbidden" | "not_found"
  | "conflict" | "quota_exceeded" | "validation_failed" | "rate_limited"
  | "file_too_large" | "unsupported_type" | "upstream_unavailable"
  | "internal" | "network" | "timeout";

/**
 * Normalised failure. Screens branch on `code`; `fields` maps straight onto
 * TextField error props, and `isOffline` drives the offline banner.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;
  readonly meta: Record<string, unknown>;
  readonly requestId?: string;

  constructor(init: {
    code: ApiErrorCode; message: string; status: number;
    fields?: Record<string, string>; meta?: Record<string, unknown>; requestId?: string;
  }) {
    super(init.message);
    this.code = init.code;
    this.status = init.status;
    this.fields = init.fields;
    this.meta = init.meta ?? {};
    this.requestId = init.requestId;
  }

  get isOffline(): boolean { return this.code === "network" || this.code === "timeout"; }
  get isQuota(): boolean { return this.code === "quota_exceeded"; }
  /** True when the session is gone for good and the user must sign in again. */
  get isAuthFailure(): boolean { return this.code === "unauthenticated"; }

  static network(): ApiError {
    return new ApiError({
      code: "network", status: 0,
      message: "You appear to be offline. Check your connection and try again.",
    });
  }
  static timeout(): ApiError {
    return new ApiError({
      code: "timeout", status: 0,
      message: "That took too long. Please try again.",
    });
  }
}
