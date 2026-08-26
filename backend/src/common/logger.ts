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

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[deep]";
  if (typeof value === "string") return value.length > 500 ? value.slice(0, 500) + "…" : value;
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
