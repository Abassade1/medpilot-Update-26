import { z } from "zod";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * z.coerce.boolean() is Boolean(string), so "false" becomes true — which would
 * silently turn safety flags on. Parse the actual words instead.
 */
const boolFromEnv = (dflt: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .default(dflt)
    .transform((v, ctx) => {
      if (typeof v === "boolean") return v;
      const t = v.trim().toLowerCase();
      if (["1", "true", "yes", "on"].includes(t)) return true;
      if (["0", "false", "no", "off", ""].includes(t)) return false;
      ctx.addIssue({ code: "custom", message: `expected a boolean, got "${v}"` });
      return z.NEVER;
    });

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_PUBLIC_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  JWT_PRIVATE_KEY: z.string().default(""),
  JWT_PUBLIC_KEY: z.string().default(""),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().min(60).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(60),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./var/storage"),
  S3_REGION: z.string().default(""),
  S3_ENDPOINT: z.string().default(""),          // set for S3-compatible providers
  S3_FORCE_PATH_STYLE: boolFromEnv(false),
  S3_BUCKET_PHI: z.string().default(""),
  S3_BUCKET_MEDIA: z.string().default(""),
  S3_BUCKET_PUBLIC: z.string().default(""),
  S3_ACCESS_KEY_ID: z.string().default(""),
  S3_SECRET_ACCESS_KEY: z.string().default(""),
  S3_SSE: z.enum(["", "AES256", "aws:kms"]).default("AES256"),
  S3_SSE_KMS_KEY_ID: z.string().default(""),

  EMAIL_DRIVER: z.enum(["outbox", "smtp"]).default("outbox"),
  EMAIL_FROM: z.string().default("no-reply@medpilot.app"),
  EMAIL_FROM_NAME: z.string().default("MedPilot"),
  EMAIL_REPLY_TO: z.string().default(""),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: boolFromEnv(false),   // true = implicit TLS (465)
  SMTP_REQUIRE_TLS: boolFromEnv(true), // STARTTLS mandatory on 587
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  SMTP_ALLOW_INSECURE: boolFromEnv(false), // local test servers only
  WEB_PUBLIC_URL: z.string().default(""),            // base for verify/reset links
  // Comma-separated allowed origins for the institutional provider web portal (browser CORS only; the mobile app isn't a browser origin).
  WEB_PORTAL_ORIGINS: z.string().default("http://localhost:5173,http://127.0.0.1:5173"),
  AUX_DRIVER: z.enum(["deterministic", "llm"]).default("deterministic"),
  BILLING_DRIVER: z.enum(["mock", "store"]).default("mock"),
  APPLE_BUNDLE_ID: z.string().default(""),
  APPLE_ENVIRONMENT: z.enum(["Sandbox", "Production"]).default("Sandbox"),
  APPLE_ROOT_CA_PATH: z.string().default(""),        // Apple Root CA G3 (PEM/DER)
  GOOGLE_PACKAGE_NAME: z.string().default(""),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().default(""),
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().default(""), // PEM, \n-escaped
  PUSH_DRIVER: z.enum(["console", "expo"]).default("console"),
  EXPO_ACCESS_TOKEN: z.string().default(""),
  QUOTA_MEAL_ANALYSIS: z.coerce.number().int().min(0).default(1),
  QUOTA_CLINIC_ACCESS: z.coerce.number().int().min(0).default(10),
  QUOTA_EVACUATION: z.coerce.number().int().min(0).default(2),
  // How often confirmed bookings whose date has passed are marked completed (0 disables the sweep).
  COMPLETION_SWEEP_MINUTES: z.coerce.number().int().min(0).default(60),
});

export type Env = z.infer<typeof EnvSchema> & {
  jwtPrivateKey: string;
  jwtPublicKey: string;
  isProd: boolean;
};

/** Loads ./.env (simple KEY=VALUE lines) without an extra dependency. */
function loadDotenv(): void {
  const p = join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!m) continue;
    // strip a trailing "  # comment" (unquoted values only) and surrounding quotes
    let v = m[2]!.replace(/\s+#.*$/, "").trim();
    if (/^".*"$/.test(v) || /^'.*'$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]!] === undefined) process.env[m[1]!] = v;
  }
}

/**
 * RS256 keys: required from env in staging/production; generated once into
 * ./keys (gitignored) for development and test.
 */
function resolveKeys(env: z.infer<typeof EnvSchema>): { priv: string; pub: string } {
  if (env.JWT_PRIVATE_KEY && env.JWT_PUBLIC_KEY) {
    const un = (s: string) => s.replace(/\\n/g, "\n");
    return { priv: un(env.JWT_PRIVATE_KEY), pub: un(env.JWT_PUBLIC_KEY) };
  }
  if (env.NODE_ENV === "production" || env.NODE_ENV === "staging") {
    throw new Error("JWT_PRIVATE_KEY / JWT_PUBLIC_KEY must be set outside development");
  }
  const dir = join(process.cwd(), "keys");
  const privPath = join(dir, "jwt-dev.key");
  const pubPath = join(dir, "jwt-dev.pub");
  if (!existsSync(privPath)) {
    mkdirSync(dir, { recursive: true });
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    writeFileSync(privPath, privateKey, { mode: 0o600 });
    writeFileSync(pubPath, publicKey);
  }
  return { priv: readFileSync(privPath, "utf8"), pub: readFileSync(pubPath, "utf8") };
}

/**
 * Development drivers keep no durable state and reach no real recipient. If a
 * staging or production deployment starts on one, the failure surfaces later as
 * "nobody received the email" or "the files vanished on redeploy" — so refuse
 * to boot instead, naming every offending variable at once.
 */
function assertDeployableDrivers(env: z.infer<typeof EnvSchema>): void {
  if (env.NODE_ENV !== "staging" && env.NODE_ENV !== "production") return;
  const problems: string[] = [];

  if (env.EMAIL_DRIVER !== "smtp") {
    problems.push("EMAIL_DRIVER must be 'smtp' outside development (the outbox driver reaches nobody)");
  } else {
    if (!env.SMTP_HOST) problems.push("SMTP_HOST is required when EMAIL_DRIVER=smtp");
    if (!env.SMTP_USER) problems.push("SMTP_USER is required when EMAIL_DRIVER=smtp");
    if (!env.SMTP_PASSWORD) problems.push("SMTP_PASSWORD is required when EMAIL_DRIVER=smtp");
    if (env.SMTP_ALLOW_INSECURE) problems.push("SMTP_ALLOW_INSECURE must be false outside development");
  }

  if (env.STORAGE_DRIVER !== "s3") {
    problems.push("STORAGE_DRIVER must be 's3' outside development (local disk does not survive redeploys)");
  } else {
    if (!env.S3_REGION) problems.push("S3_REGION is required when STORAGE_DRIVER=s3");
    if (!env.S3_BUCKET_PHI) problems.push("S3_BUCKET_PHI is required when STORAGE_DRIVER=s3");
    if (!env.S3_BUCKET_MEDIA) problems.push("S3_BUCKET_MEDIA is required when STORAGE_DRIVER=s3");
    if (!env.S3_ACCESS_KEY_ID) problems.push("S3_ACCESS_KEY_ID is required when STORAGE_DRIVER=s3");
    if (!env.S3_SECRET_ACCESS_KEY) problems.push("S3_SECRET_ACCESS_KEY is required when STORAGE_DRIVER=s3");
    if (!env.S3_SSE) problems.push("S3_SSE must not be empty: sensitive objects require encryption at rest");
  }

  if (env.BILLING_DRIVER !== "store") {
    problems.push("BILLING_DRIVER must be 'store' outside development (the mock driver accepts any receipt)");
  } else {
    if (!env.APPLE_BUNDLE_ID) problems.push("APPLE_BUNDLE_ID is required when BILLING_DRIVER=store");
    if (!env.GOOGLE_PACKAGE_NAME) problems.push("GOOGLE_PACKAGE_NAME is required when BILLING_DRIVER=store");
    if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL) problems.push("GOOGLE_SERVICE_ACCOUNT_EMAIL is required when BILLING_DRIVER=store");
    if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) problems.push("GOOGLE_SERVICE_ACCOUNT_KEY is required when BILLING_DRIVER=store");
  }

  if (env.PUSH_DRIVER !== "expo") {
    problems.push("PUSH_DRIVER must be 'expo' outside development (the console driver delivers nothing)");
  }

  if (!env.WEB_PUBLIC_URL) problems.push("WEB_PUBLIC_URL is required: verification and reset links are built from it");
  if (!/^https:/.test(env.API_PUBLIC_URL)) problems.push("API_PUBLIC_URL must be https outside development");
  {
    const origins = env.WEB_PORTAL_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
    if (!origins.length || origins.some((o) => /^https?:\/\/(localhost|127\.0\.0\.1)/.test(o))) {
      problems.push("WEB_PORTAL_ORIGINS must list the deployed provider-portal origin(s) outside development (the localhost default leaves the web portal unreachable)");
    }
  }
  if (env.WEB_PUBLIC_URL && !/^https:/.test(env.WEB_PUBLIC_URL)) problems.push("WEB_PUBLIC_URL must be https outside development");

  if (problems.length) {
    throw new Error(
      `Refusing to start in ${env.NODE_ENV} with development configuration:\n  - ${problems.join("\n  - ")}`,
    );
  }
}

let cached: Env | null = null;
export function loadEnv(): Env {
  if (cached) return cached;
  loadDotenv();
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  assertDeployableDrivers(parsed.data);
  const keys = resolveKeys(parsed.data);
  cached = {
    ...parsed.data,
    jwtPrivateKey: keys.priv,
    jwtPublicKey: keys.pub,
    isProd: parsed.data.NODE_ENV === "production",
  };
  return cached;
}
