import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPrivateKey, sign as cryptoSign } from "node:crypto";
import request from "supertest";
import { getApp, registerUser, closeApp } from "./helpers";
import type { Env } from "../src/config/env";

/**
 * Apple's signed transactions are ES256 JWS carrying their own certificate
 * chain. These tests build a real chain with openssl, sign real payloads, and
 * pin the verifier at that test root — so the accept path exercises genuine
 * X.509 chain building and signature verification, and the reject paths prove
 * a forged or mismatched purchase cannot pass.
 */
describe("store purchase verification", () => {
  let dir: string;
  let env: Env;

  const openssl = (args: string[]) => execFileSync("openssl", args, { cwd: dir, stdio: "pipe" });

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "apple-chain-"));

    // root -> intermediate -> leaf, all P-256, mirroring Apple's shape.
    openssl(["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", "root.key"]);
    openssl(["req", "-x509", "-new", "-key", "root.key", "-sha256", "-days", "2",
      "-subj", "/CN=Test Apple Root CA", "-out", "root.pem"]);

    openssl(["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", "int.key"]);
    openssl(["req", "-new", "-key", "int.key", "-subj", "/CN=Test Apple Intermediate", "-out", "int.csr"]);
    writeFileSync(join(dir, "int.ext"), "basicConstraints=critical,CA:TRUE\n");
    openssl(["x509", "-req", "-in", "int.csr", "-CA", "root.pem", "-CAkey", "root.key",
      "-CAcreateserial", "-days", "2", "-sha256", "-extfile", "int.ext", "-out", "int.pem"]);

    openssl(["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", "leaf.key"]);
    openssl(["req", "-new", "-key", "leaf.key", "-subj", "/CN=Test Apple Leaf", "-out", "leaf.csr"]);
    openssl(["x509", "-req", "-in", "leaf.csr", "-CA", "int.pem", "-CAkey", "int.key",
      "-CAcreateserial", "-days", "2", "-sha256", "-out", "leaf.pem"]);

    env = {
      APPLE_BUNDLE_ID: "app.medpilot.ios",
      APPLE_ENVIRONMENT: "Sandbox",
      APPLE_ROOT_CA_PATH: join(dir, "root.pem"),
      GOOGLE_PACKAGE_NAME: "app.medpilot.android",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "",
      GOOGLE_SERVICE_ACCOUNT_KEY: "",
    } as unknown as Env;
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const derOf = (pem: string) => {
    const body = readFileSync(join(dir, pem), "utf8");
    return body.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  };

  /** Builds a JWS exactly as StoreKit 2 would, signed by the leaf. */
  function signedTransaction(
    payload: Record<string, unknown>,
    opts: { chain?: string[]; alg?: string; tamper?: boolean } = {},
  ): string {
    const header = {
      alg: opts.alg ?? "ES256",
      x5c: opts.chain ?? [derOf("leaf.pem"), derOf("int.pem"), derOf("root.pem")],
    };
    const h = Buffer.from(JSON.stringify(header)).toString("base64url");
    const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = cryptoSign(
      "sha256",
      Buffer.from(`${h}.${p}`),
      { key: createPrivateKey(readFileSync(join(dir, "leaf.key"))), dsaEncoding: "ieee-p1363" },
    );
    const s = opts.tamper
      ? Buffer.from(sig.map((b, i) => (i === 0 ? b ^ 0xff : b))).toString("base64url")
      : sig.toString("base64url");
    return `${h}.${p}.${s}`;
  }

  const validPayload = (over: Record<string, unknown> = {}) => ({
    bundleId: "app.medpilot.ios",
    productId: "pro.monthly",
    originalTransactionId: `2000000${Math.floor(Math.random() * 1e6)}`,
    expiresDate: Date.now() + 30 * 86400_000,
    environment: "Sandbox",
    type: "Auto-Renewable Subscription",
    ...over,
  });

  const verifier = async () => {
    const { LiveStoreVerifier } = await import("../src/modules/billing/store-verifier");
    return new LiveStoreVerifier(env);
  };

  it("accepts a properly signed transaction from our bundle", async () => {
    const v = await verifier();
    const payload = validPayload();
    const result = await v.verifyApple(signedTransaction(payload));

    expect(result.originalTransactionId).toBe(payload.originalTransactionId);
    expect(result.productId).toBe("pro.monthly");
    expect(result.active).toBe(true);
    expect(result.environment).toBe("Sandbox");
  });

  it("rejects a tampered signature", async () => {
    const v = await verifier();
    await expect(v.verifyApple(signedTransaction(validPayload(), { tamper: true })))
      .rejects.toThrow(/couldn't be verified/i);
  });

  it("rejects a payload edited after signing", async () => {
    const v = await verifier();
    const jws = signedTransaction(validPayload());
    const [h, , s] = jws.split(".");
    const forged = Buffer.from(JSON.stringify(validPayload({ productId: "pro.lifetime" })))
      .toString("base64url");
    await expect(v.verifyApple(`${h}.${forged}.${s}`)).rejects.toThrow(/couldn't be verified/i);
  });

  it("rejects a chain that does not terminate at the pinned root", async () => {
    // A self-signed chain the attacker made themselves.
    openssl(["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", "rogue.key"]);
    openssl(["req", "-x509", "-new", "-key", "rogue.key", "-sha256", "-days", "2",
      "-subj", "/CN=Rogue Root", "-out", "rogue.pem"]);
    const v = await verifier();
    await expect(
      v.verifyApple(signedTransaction(validPayload(), { chain: [derOf("rogue.pem"), derOf("rogue.pem")] })),
    ).rejects.toThrow(/couldn't be verified/i);
  });

  /** The client-facing message is deliberately generic; the reason is in fields. */
  const reasonFor = async (jws: string): Promise<string> => {
    const v = await verifier();
    try {
      await v.verifyApple(jws);
      throw new Error("expected verification to fail");
    } catch (err) {
      const e = err as { fields?: { receipt?: string }; message: string };
      return e.fields?.receipt ?? e.message;
    }
  };

  it("rejects a transaction for a different app", async () => {
    await expect(reasonFor(signedTransaction(validPayload({ bundleId: "com.someone.else" }))))
      .resolves.toMatch(/different app/i);
  });

  it("rejects a production transaction while configured for sandbox", async () => {
    await expect(reasonFor(signedTransaction(validPayload({ environment: "Production" }))))
      .resolves.toMatch(/Sandbox/);
  });

  it("rejects an unsigned 'none' algorithm transaction", async () => {
    const v = await verifier();
    await expect(v.verifyApple(signedTransaction(validPayload(), { alg: "none" })))
      .rejects.toThrow(/couldn't be verified/i);
  });

  it("reports an expired subscription as inactive", async () => {
    const v = await verifier();
    const r = await v.verifyApple(signedTransaction(validPayload({ expiresDate: Date.now() - 1000 })));
    expect(r.active).toBe(false);
  });

  it("reports a refunded subscription as inactive", async () => {
    const v = await verifier();
    const r = await v.verifyApple(signedTransaction(validPayload({ revocationDate: Date.now() - 5000 })));
    expect(r.active).toBe(false);
  });

  it("rejects garbage instead of crashing", async () => {
    const v = await verifier();
    for (const junk of ["", "not.a.jws", "a.b", "....", "x".repeat(4000)]) {
      await expect(v.verifyApple(junk)).rejects.toThrow();
    }
  });
});

/**
 * Entitlement rules at the service boundary: the backend, not the client,
 * decides who is Pro.
 */
describe("entitlement authority", () => {
  let app: Awaited<ReturnType<typeof getApp>>;

  beforeAll(async () => { app = await getApp(); }, 60_000);
  afterAll(async () => { await closeApp(); });

  const receipt = (seed: string) => `sandbox-receipt-${seed}-${Date.now()}`;

  it("a client cannot grant itself Pro by asserting it", async () => {
    const user = await registerUser();

    // Every shape of "just trust me" the client could try.
    for (const body of [
      { planCode: "pro" },
      { isPremium: true },
      { platform: "apple", receipt: "", productId: "pro" },
      { platform: "apple", productId: "pro" },
    ]) {
      const res = await request(app.getHttpServer())
        .post("/v1/me/subscription/verify")
        .set("authorization", `Bearer ${user.accessToken}`)
        .send(body);
      expect(res.status).toBeGreaterThanOrEqual(400);
    }

    const sub = await request(app.getHttpServer())
      .get("/v1/me/subscription")
      .set("authorization", `Bearer ${user.accessToken}`)
      .expect(200);
    expect(sub.body.planCode).toBe("basic");
  }, 60_000);

  it("re-submitting the same receipt is idempotent, not a second grant", async () => {
    const user = await registerUser();
    const r = receipt("idem");
    const body = { platform: "apple", receipt: r, productId: "pro.monthly" };

    const first = await request(app.getHttpServer())
      .post("/v1/me/subscription/verify")
      .set("authorization", `Bearer ${user.accessToken}`).send(body).expect(200);
    const second = await request(app.getHttpServer())
      .post("/v1/me/subscription/verify")
      .set("authorization", `Bearer ${user.accessToken}`).send(body).expect(200);

    expect(first.body.planCode).toBe("pro");
    expect(second.body.planCode).toBe("pro");

    const activities = await request(app.getHttpServer())
      .get("/v1/activities?type=plan")
      .set("authorization", `Bearer ${user.accessToken}`).expect(200);
    expect(activities.body.items).toHaveLength(1); // not two upgrades
  }, 60_000);

  it("a receipt already linked to one account cannot be redeemed by another", async () => {
    const alice = await registerUser();
    const bob = await registerUser();
    const shared = { platform: "apple", receipt: receipt("shared"), productId: "pro.monthly" };

    await request(app.getHttpServer())
      .post("/v1/me/subscription/verify")
      .set("authorization", `Bearer ${alice.accessToken}`).send(shared).expect(200);

    const stolen = await request(app.getHttpServer())
      .post("/v1/me/subscription/verify")
      .set("authorization", `Bearer ${bob.accessToken}`).send(shared);

    expect(stolen.status).toBe(422);
    expect(stolen.body.error.message).toMatch(/another account/i);

    const bobSub = await request(app.getHttpServer())
      .get("/v1/me/subscription")
      .set("authorization", `Bearer ${bob.accessToken}`).expect(200);
    expect(bobSub.body.planCode).toBe("basic");
  }, 60_000);

  it("verification requires authentication", async () => {
    await request(app.getHttpServer())
      .post("/v1/me/subscription/verify")
      .send({ platform: "apple", receipt: receipt("anon"), productId: "pro.monthly" })
      .expect(401);
  }, 60_000);

  it("an upgraded account actually gains the metered capability", async () => {
    const user = await registerUser();
    await request(app.getHttpServer())
      .post("/v1/me/subscription/verify")
      .set("authorization", `Bearer ${user.accessToken}`)
      .send({ platform: "apple", receipt: receipt("cap"), productId: "pro.monthly" })
      .expect(200);

    const sub = await request(app.getHttpServer())
      .get("/v1/me/subscription")
      .set("authorization", `Bearer ${user.accessToken}`).expect(200);
    expect(sub.body.planCode).toBe("pro");
    expect(sub.body.usage.mealAnalysis.limit).toBeNull(); // unlimited
  }, 60_000);
});
