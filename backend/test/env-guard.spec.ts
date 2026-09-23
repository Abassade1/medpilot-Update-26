/**
 * The boot guard is the difference between "staging silently loses every
 * email" and "staging refuses to start and says why". These tests load the
 * env module in a fresh registry for each case, because it caches.
 */
describe("deployment configuration guard", () => {
  const ORIGINAL = { ...process.env };

  const load = async (over: Record<string, string>) => {
    jest.resetModules();
    process.env = { ...ORIGINAL, ...over };
    const { loadEnv } = await import("../src/config/env");
    return loadEnv();
  };

  afterAll(() => { process.env = ORIGINAL; });

  const deployable = {
    NODE_ENV: "staging",
    API_PUBLIC_URL: "https://api-staging.medpilot.example",
    WEB_PUBLIC_URL: "https://staging.medpilot.example",
    APP_SECRET: "a".repeat(40),
    JWT_PRIVATE_KEY: "x", JWT_PUBLIC_KEY: "y",
    EMAIL_DRIVER: "smtp",
    SMTP_HOST: "smtp.example", SMTP_USER: "u", SMTP_PASSWORD: "p",
    STORAGE_DRIVER: "s3",
    S3_REGION: "us-east-1", S3_BUCKET_PHI: "phi", S3_BUCKET_MEDIA: "media",
    S3_ACCESS_KEY_ID: "k", S3_SECRET_ACCESS_KEY: "s", S3_SSE: "AES256",
    BILLING_DRIVER: "store",
    APPLE_BUNDLE_ID: "app.medpilot.ios",
    GOOGLE_PACKAGE_NAME: "app.medpilot.android",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "svc@example.iam.gserviceaccount.com",
    GOOGLE_SERVICE_ACCOUNT_KEY: "pem",
    PUSH_DRIVER: "expo",
    WEB_PORTAL_ORIGINS: "https://provider.medpilot.example",
  };

  it("accepts a fully configured staging environment", async () => {
    const env = await load(deployable);
    expect(env.NODE_ENV).toBe("staging");
    expect(env.EMAIL_DRIVER).toBe("smtp");
    expect(env.STORAGE_DRIVER).toBe("s3");
  });

  it.each([
    ["the outbox email driver", { EMAIL_DRIVER: "outbox" }, /EMAIL_DRIVER/],
    ["local disk storage", { STORAGE_DRIVER: "local" }, /STORAGE_DRIVER/],
    ["the mock billing driver", { BILLING_DRIVER: "mock" }, /BILLING_DRIVER/],
    ["the console push driver", { PUSH_DRIVER: "console" }, /PUSH_DRIVER/],
    ["a missing SMTP host", { SMTP_HOST: "" }, /SMTP_HOST/],
    ["missing S3 credentials", { S3_ACCESS_KEY_ID: "" }, /S3_ACCESS_KEY_ID/],
    ["storage encryption turned off", { S3_SSE: "" }, /S3_SSE/],
    ["a missing web URL for email links", { WEB_PUBLIC_URL: "" }, /WEB_PUBLIC_URL/],
    ["a plaintext API URL", { API_PUBLIC_URL: "http://api.example" }, /API_PUBLIC_URL must be https/],
    ["relaxed TLS verification", { SMTP_ALLOW_INSECURE: "true" }, /SMTP_ALLOW_INSECURE/],
    ["the default localhost web portal origin", { WEB_PORTAL_ORIGINS: "http://localhost:5173" }, /WEB_PORTAL_ORIGINS/],
    ["no web portal origin at all", { WEB_PORTAL_ORIGINS: "" }, /WEB_PORTAL_ORIGINS/],
  ])("refuses to start in staging with %s", async (_label, override, expected) => {
    await expect(load({ ...deployable, ...override })).rejects.toThrow(expected);
  });

  it("names every problem at once rather than one per restart", async () => {
    await expect(
      load({ ...deployable, EMAIL_DRIVER: "outbox", STORAGE_DRIVER: "local", PUSH_DRIVER: "console" }),
    ).rejects.toThrow(/EMAIL_DRIVER[\s\S]*STORAGE_DRIVER[\s\S]*PUSH_DRIVER/);
  });

  it("leaves development free to use local drivers", async () => {
    const env = await load({
      NODE_ENV: "development",
      APP_SECRET: "a".repeat(40),
      DATABASE_URL: "postgres://medpilot@localhost:5433/medpilot_dev",
      EMAIL_DRIVER: "outbox", STORAGE_DRIVER: "local",
      BILLING_DRIVER: "mock", PUSH_DRIVER: "console",
    });
    expect(env.EMAIL_DRIVER).toBe("outbox");
  });

  it('reads "false" as false, so safety flags cannot be turned on by accident', async () => {
    const env = await load({
      NODE_ENV: "development",
      APP_SECRET: "a".repeat(40),
      DATABASE_URL: "postgres://medpilot@localhost:5433/medpilot_dev",
      SMTP_ALLOW_INSECURE: "false",
      SMTP_SECURE: "false",
      SMTP_REQUIRE_TLS: "true",
      S3_FORCE_PATH_STYLE: "false",
    });
    expect(env.SMTP_ALLOW_INSECURE).toBe(false);
    expect(env.SMTP_SECURE).toBe(false);
    expect(env.SMTP_REQUIRE_TLS).toBe(true);
    expect(env.S3_FORCE_PATH_STYLE).toBe(false);
  });

  it("requires signing keys to be supplied outside development", async () => {
    await expect(load({ ...deployable, JWT_PRIVATE_KEY: "", JWT_PUBLIC_KEY: "" }))
      .rejects.toThrow(/JWT_PRIVATE_KEY/);
  });
});
