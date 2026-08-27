import { X509Certificate, verify as cryptoVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import jwt from "jsonwebtoken";
import type { Env } from "../../config/env";
import { AppError } from "../../common/errors";
import { log } from "../../common/logger";

/**
 * What the backend is willing to believe about a purchase, once it has checked
 * with the store itself. The client never supplies any of these values.
 */
export interface VerifiedPurchase {
  /** Stable identity of the subscription across renewals — the replay key. */
  originalTransactionId: string;
  productId: string;
  /** null means a non-expiring entitlement. */
  expiresAt: Date | null;
  active: boolean;
  autoRenewing: boolean;
  environment: "Sandbox" | "Production";
}

export interface StoreVerifier {
  verifyApple(signedTransaction: string): Promise<VerifiedPurchase>;
  verifyGoogle(purchaseToken: string, productId: string): Promise<VerifiedPurchase>;
}

const b64urlJson = <T>(segment: string): T =>
  JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;

const invalid = (why: string) =>
  new AppError("validation_failed", "That purchase couldn't be verified", {
    fields: { receipt: why },
  });

/**
 * Apple's Root CA G3 SHA-256 fingerprint. Pinning the root means a forged
 * chain has to be signed by Apple, not merely well-formed.
 */
const APPLE_ROOT_G3_FINGERPRINT =
  "63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79";

/**
 * Verifies StoreKit 2 signed transactions and Play purchase tokens against the
 * stores. Both paths reach the store (or Apple's signing chain) — a receipt
 * that the client made up cannot pass.
 */
export class LiveStoreVerifier implements StoreVerifier {
  constructor(private readonly env: Env) {}

  // ---- Apple ------------------------------------------------------------
  /**
   * StoreKit 2 hands the app a JWS whose header carries the certificate chain
   * that signed it. Verification is: chain is well-formed and terminates at
   * Apple's root, the leaf actually signed these bytes, and the payload names
   * our bundle in the environment we expect.
   */
  async verifyApple(signedTransaction: string): Promise<VerifiedPurchase> {
    const parts = signedTransaction.split(".");
    if (parts.length !== 3) throw invalid("Malformed transaction");
    const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

    const header = b64urlJson<{ alg: string; x5c?: string[] }>(headerB64);
    if (header.alg !== "ES256") throw invalid("Unexpected signature algorithm");
    if (!header.x5c?.length) throw invalid("Missing certificate chain");

    const chain = header.x5c.map((der) => new X509Certificate(Buffer.from(der, "base64")));
    this.assertAppleChain(chain);

    const leaf = chain[0]!;
    const ok = cryptoVerify(
      "sha256",
      Buffer.from(`${headerB64}.${payloadB64}`),
      { key: leaf.publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(signatureB64, "base64url"),
    );
    if (!ok) throw invalid("Signature does not match");

    const payload = b64urlJson<{
      bundleId?: string;
      productId?: string;
      originalTransactionId?: string;
      expiresDate?: number;
      revocationDate?: number;
      environment?: string;
      type?: string;
    }>(payloadB64);

    if (!payload.bundleId || payload.bundleId !== this.env.APPLE_BUNDLE_ID) {
      throw invalid("This purchase belongs to a different app");
    }
    if (payload.environment && payload.environment !== this.env.APPLE_ENVIRONMENT) {
      throw invalid(`Expected a ${this.env.APPLE_ENVIRONMENT} purchase`);
    }
    if (!payload.originalTransactionId || !payload.productId) {
      throw invalid("Incomplete transaction");
    }

    const expiresAt = payload.expiresDate ? new Date(payload.expiresDate) : null;
    const revoked = !!payload.revocationDate;

    return {
      originalTransactionId: payload.originalTransactionId,
      productId: payload.productId,
      expiresAt,
      // Refunded/revoked purchases must not grant anything, whatever the dates say.
      active: !revoked && (!expiresAt || expiresAt.getTime() > Date.now()),
      autoRenewing: !revoked,
      environment: (payload.environment as "Sandbox" | "Production") ?? this.env.APPLE_ENVIRONMENT,
    };
  }

  /** Each certificate must be signed by the next, and the last must be Apple's root. */
  private assertAppleChain(chain: X509Certificate[]): void {
    if (chain.length < 2) throw invalid("Incomplete certificate chain");
    const now = Date.now();
    for (const cert of chain) {
      if (new Date(cert.validFrom).getTime() > now || new Date(cert.validTo).getTime() < now) {
        throw invalid("Certificate chain has expired");
      }
    }
    for (let i = 0; i < chain.length - 1; i += 1) {
      if (!chain[i]!.verify(chain[i + 1]!.publicKey)) {
        throw invalid("Certificate chain is not internally consistent");
      }
    }
    const root = chain[chain.length - 1]!;
    const expected = this.appleRoot();
    if (expected) {
      if (root.raw.compare(expected.raw) !== 0) throw invalid("Chain does not terminate at Apple's root");
    } else if (root.fingerprint256 !== APPLE_ROOT_G3_FINGERPRINT) {
      throw invalid("Chain does not terminate at Apple's root");
    }
  }

  private appleRoot(): X509Certificate | null {
    if (!this.env.APPLE_ROOT_CA_PATH) return null;
    try {
      return new X509Certificate(readFileSync(this.env.APPLE_ROOT_CA_PATH));
    } catch (err) {
      log.error("apple_root_ca_unreadable", { reason: (err as Error).message });
      throw new AppError("upstream_unavailable", "Purchase verification is unavailable");
    }
  }

  // ---- Google -----------------------------------------------------------
  /**
   * Play gives the app an opaque purchase token that means nothing on its own;
   * its state has to be read back from the Play Developer API with our own
   * service-account credentials.
   */
  async verifyGoogle(purchaseToken: string, productId: string): Promise<VerifiedPurchase> {
    const accessToken = await this.googleAccessToken();
    const url =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
      `${encodeURIComponent(this.env.GOOGLE_PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/` +
      `${encodeURIComponent(purchaseToken)}`;

    const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
    if (res.status === 404 || res.status === 400) throw invalid("Unknown purchase");
    if (!res.ok) {
      log.error("google_play_lookup_failed", { status: res.status });
      throw new AppError("upstream_unavailable", "Purchase verification is unavailable");
    }

    const body = (await res.json()) as {
      subscriptionState?: string;
      latestOrderId?: string;
      lineItems?: { productId?: string; expiryTime?: string; autoRenewingPlan?: unknown }[];
    };

    const line = body.lineItems?.[0];
    const expiresAt = line?.expiryTime ? new Date(line.expiryTime) : null;
    const state = body.subscriptionState ?? "SUBSCRIPTION_STATE_UNSPECIFIED";
    const active =
      (state === "SUBSCRIPTION_STATE_ACTIVE" || state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD") &&
      (!expiresAt || expiresAt.getTime() > Date.now());

    if (line?.productId && productId && line.productId !== productId) {
      throw invalid("This purchase is for a different product");
    }

    return {
      // The token is stable for the lifetime of the subscription, so it is the
      // replay key on Play — mirroring originalTransactionId on Apple.
      originalTransactionId: `google:${purchaseToken.slice(0, 100)}`,
      productId: line?.productId ?? productId,
      expiresAt,
      active,
      autoRenewing: !!line?.autoRenewingPlan,
      environment: this.env.APPLE_ENVIRONMENT, // Play sandbox is a per-tester setting
    };
  }

  /** Service-account JWT assertion exchanged for a short-lived access token. */
  private async googleAccessToken(): Promise<string> {
    const key = this.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, "\n");
    if (!key || !this.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      throw new AppError("upstream_unavailable", "Purchase verification is not configured");
    }
    const now = Math.floor(Date.now() / 1000);
    const assertion = jwt.sign(
      {
        iss: this.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        scope: "https://www.googleapis.com/auth/androidpublisher",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      },
      key,
      { algorithm: "RS256" },
    );

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!res.ok) {
      // Never log the assertion or the response body: both carry credentials.
      log.error("google_token_exchange_failed", { status: res.status });
      throw new AppError("upstream_unavailable", "Purchase verification is unavailable");
    }
    const { access_token } = (await res.json()) as { access_token?: string };
    if (!access_token) throw new AppError("upstream_unavailable", "Purchase verification is unavailable");
    return access_token;
  }
}

/** Kept for local development only; rejected at boot outside development. */
export class MockStoreVerifier implements StoreVerifier {
  async verifyApple(receipt: string): Promise<VerifiedPurchase> {
    return this.accept(receipt, "apple");
  }
  async verifyGoogle(receipt: string): Promise<VerifiedPurchase> {
    return this.accept(receipt, "google");
  }
  private accept(receipt: string, platform: string): VerifiedPurchase {
    if (receipt.length < 8) throw invalid("Invalid receipt");
    return {
      originalTransactionId: `${platform}:${receipt.slice(0, 40)}`,
      productId: "pro.monthly",
      expiresAt: new Date(Date.now() + 30 * 86400_000),
      active: true,
      autoRenewing: true,
      environment: "Sandbox",
    };
  }
}
