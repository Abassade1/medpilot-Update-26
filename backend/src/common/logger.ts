/**
 * Structured JSON logger with redaction. PHI, credentials and tokens must
 * never be logged — redaction is by key allowlist on known-hot fields plus a
 * value scrubber for bearer tokens.
 */
const REDACT_KEYS = new Set([
  "password", "passwordhash", "token", "accesstoken", "refreshtoken",
  "authorization", "conditionnote", "othernote", "otherpurpose", "otherneed",
  "summary", "possiblecauses", "recommendedtreatment", "content", "body",
]);

/**
 * Value-level scrubbing, independent of the key. The signed-upload-ticket leak
 * reached the log as a URL *path*, where no key-based rule could catch it — so
 * credential-shaped values are stripped wherever they appear.
 */
const VALUE_PATTERNS: [RegExp, string][] = [
  // Signed upload/download tickets and JWTs: base64url JSON followed by a MAC.
  [/eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}(?:\.[A-Za-z0-9_-]+)?/g, "[token]"],
  // Authorization headers in any casing.
  [/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [token]"],
  // One-time verification and password-reset tokens.
  [/\b(?:vt|pr)_[A-Za-z0-9_-]{16,}/g, "[token]"],
  // Any token/signature carried as a query parameter.
  [/([?&](?:token|signature|sig|x-amz-signature|access_token)=)[^&\s"']+/gi, "$1[redacted]"],
  // AWS access key ids.
  [/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]"],
];

export function scrubValue(s: string): string {
  let out = s;
  for (const [re, replacement] of VALUE_PATTERNS) out = out.replace(re, replacement);
  return out;
}

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[deep]";
  if (typeof value === "string") {
    const v = scrubValue(value);
    return v.length > 500 ? v.slice(0, 500) + "…" : v;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = REDACT_KEYS.has(k.toLowerCase()) ? "[redacted]" : scrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

type Level = "debug" | "info" | "warn" | "error";
const SILENT = process.env.NODE_ENV === "test" && process.env.LOG_IN_TEST !== "1";

function line(level: Level, msg: string, ctx?: Record<string, unknown>) {
  if (SILENT && level !== "error") return;
  const entry = { ts: new Date().toISOString(), level, msg, ...(ctx ? (scrub(ctx) as object) : {}) };
  const out = JSON.stringify(entry);
  if (level === "error") process.stderr.write(out + "\n");
  else process.stdout.write(out + "\n");
}

export const log = {
  debug: (msg: string, ctx?: Record<string, unknown>) => line("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => line("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => line("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => line("error", msg, ctx),
};
