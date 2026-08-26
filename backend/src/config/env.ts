import { z } from "zod";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
  EMAIL_DRIVER: z.enum(["outbox", "smtp-provider"]).default("outbox"),
  EMAIL_FROM: z.string().default("no-reply@medpilot.app"),
  AUX_DRIVER: z.enum(["deterministic", "llm"]).default("deterministic"),
  BILLING_DRIVER: z.enum(["mock", "store"]).default("mock"),
  PUSH_DRIVER: z.enum(["console", "expo"]).default("console"),
  QUOTA_MEAL_ANALYSIS: z.coerce.number().int().min(0).default(1),
  QUOTA_CLINIC_ACCESS: z.coerce.number().int().min(0).default(10),
  QUOTA_EVACUATION: z.coerce.number().int().min(0).default(2),
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

let cached: Env | null = null;
export function loadEnv(): Env {
  if (cached) return cached;
  loadDotenv();
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  const keys = resolveKeys(parsed.data);
  cached = {
    ...parsed.data,
    jwtPrivateKey: keys.priv,
    jwtPublicKey: keys.pub,
    isProd: parsed.data.NODE_ENV === "production",
  };
  return cached;
}
