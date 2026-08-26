/** Stable machine codes from the specification's error envelope (§10). */
export type ErrorCode =
  | "bad_request" | "unauthenticated" | "forbidden" | "not_found"
  | "conflict" | "quota_exceeded" | "validation_failed" | "rate_limited"
  | "file_too_large" | "unsupported_type" | "upstream_unavailable" | "internal";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400, unauthenticated: 401, forbidden: 403, not_found: 404,
  conflict: 409, quota_exceeded: 402, validation_failed: 422, rate_limited: 429,
  file_too_large: 413, unsupported_type: 415, upstream_unavailable: 503, internal: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;
  readonly meta?: Record<string, unknown>;
  constructor(code: ErrorCode, message: string, opts?: { fields?: Record<string, string>; meta?: Record<string, unknown> }) {
    super(message);
    this.code = code;
    this.status = STATUS[code];
    this.fields = opts?.fields;
    this.meta = opts?.meta;
  }
  static notFound(what = "Resource"): AppError { return new AppError("not_found", `${what} not found`); }
  static forbidden(): AppError { return new AppError("forbidden", "You don't have access to this resource"); }
  static unauthenticated(msg = "Authentication required"): AppError { return new AppError("unauthenticated", msg); }
}
