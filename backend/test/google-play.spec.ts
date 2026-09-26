import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";
import { LiveStoreVerifier } from "../src/modules/billing/store-verifier";
import type { Env } from "../src/config/env";

/**
 * Play purchase tokens are opaque; the verifier must read their state back from Google with our
 * own service account. These tests stand in for Google's two endpoints (token exchange and the
 * subscriptionsv2 lookup) and check what the verifier believes about each response.
 */
describe("Google Play purchase verification", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const env = {
    GOOGLE_PACKAGE_NAME: "app.medpilot.android",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "billing@medpilot-test.iam.gserviceaccount.com",
    GOOGLE_SERVICE_ACCOUNT_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString().replace(/\n/g, "\\n"),
    APPLE_ENVIRONMENT: "Sandbox",
  } as unknown as Env;

  const future = new Date(Date.now() + 20 * 86400_000).toISOString();
  const past = new Date(Date.now() - 86400_000).toISOString();
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  let calls: { url: string; init?: RequestInit }[];
  let lookup: Response;
  let tokenResponse: Response;

  beforeEach(() => {
    calls = [];
    tokenResponse = json(200, { access_token: "ya29.test-token", expires_in: 3600 });
    jest.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      return url.startsWith("https://oauth2.googleapis.com/token") ? tokenResponse : lookup;
    });
  });
  afterEach(() => jest.restoreAllMocks());

  const verify = (token = "play-token-abc", productId = "pro.monthly") =>
    new LiveStoreVerifier(env).verifyGoogle(token, productId);

  it("accepts an active subscription and keys it on the purchase token", async () => {
    lookup = json(200, {
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      lineItems: [{ productId: "pro.monthly", expiryTime: future, autoRenewingPlan: {} }],
    });
    const out = await verify();
    expect(out).toMatchObject({
      originalTransactionId: "google:play-token-abc", productId: "pro.monthly", active: true, autoRenewing: true,
    });
    expect(out.expiresAt?.toISOString()).toBe(future);
  });

  it("signs a service-account assertion for the token exchange and uses the token for the lookup", async () => {
    lookup = json(200, { subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", lineItems: [{ productId: "pro.monthly", expiryTime: future }] });
    await verify("tok/with spaces");

    const assertion = new URLSearchParams(String(calls[0]!.init!.body)).get("assertion")!;
    const claims = jwt.verify(assertion, publicKey.export({ type: "spki", format: "pem" }), { algorithms: ["RS256"] }) as Record<string, unknown>;
    expect(claims).toMatchObject({
      iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
    });

    expect(calls[1]!.url).toBe(
      "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/app.medpilot.android/purchases/subscriptionsv2/tokens/tok%2Fwith%20spaces",
    );
    expect((calls[1]!.init!.headers as Record<string, string>).authorization).toBe("Bearer ya29.test-token");
  });

  it("treats a grace period as active", async () => {
    lookup = json(200, { subscriptionState: "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", lineItems: [{ productId: "pro.monthly", expiryTime: future }] });
    expect((await verify()).active).toBe(true);
  });

  it.each([
    ["cancelled", "SUBSCRIPTION_STATE_CANCELED", future],
    ["expired", "SUBSCRIPTION_STATE_EXPIRED", past],
    ["on hold", "SUBSCRIPTION_STATE_ON_HOLD", future],
    ["active but past its expiry", "SUBSCRIPTION_STATE_ACTIVE", past],
  ])("reports a %s subscription as inactive", async (_label, state, expiryTime) => {
    lookup = json(200, { subscriptionState: state, lineItems: [{ productId: "pro.monthly", expiryTime }] });
    expect((await verify()).active).toBe(false);
  });

  it("rejects a token for a different product", async () => {
    lookup = json(200, { subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", lineItems: [{ productId: "pro.yearly", expiryTime: future }] });
    await expect(verify()).rejects.toMatchObject({ code: "validation_failed" });
  });

  it.each([404, 400])("rejects a token Google doesn't recognise (%i)", async (status) => {
    lookup = json(status, { error: { message: "not found" } });
    await expect(verify()).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("reports Google being down as unavailable, not as a bad receipt", async () => {
    lookup = json(503, {});
    await expect(verify()).rejects.toMatchObject({ code: "upstream_unavailable" });
  });

  it("fails closed when the token exchange is refused", async () => {
    tokenResponse = json(401, { error: "invalid_grant" });
    await expect(verify()).rejects.toMatchObject({ code: "upstream_unavailable" });
    expect(calls).toHaveLength(1); // never reaches the lookup
  });

  it("fails closed without calling Google when credentials aren't configured", async () => {
    const bare = new LiveStoreVerifier({ ...env, GOOGLE_SERVICE_ACCOUNT_KEY: "" } as Env);
    await expect(bare.verifyGoogle("tok", "pro.monthly")).rejects.toMatchObject({ code: "upstream_unavailable" });
    expect(calls).toHaveLength(0);
  });
});
