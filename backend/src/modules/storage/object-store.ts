import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Env } from "../../config/env";

/**
 * The object backend behind StorageService. Both implementations expose the
 * same four operations, so the two-phase upload flow — and the magic-byte
 * verification that guards it — is identical on either driver.
 */
export interface ObjectStore {
  put(bucket: string, key: string, body: Buffer, contentType: string): Promise<void>;
  get(bucket: string, key: string): Promise<Buffer | null>;
  size(bucket: string, key: string): Promise<number | null>;
  remove(bucket: string, key: string): Promise<void>;
  /** Cheap reachability probe for the readiness endpoint. */
  health(): Promise<void>;
}

/** Development backend: the API's own disk. Never used outside development. */
export class LocalObjectStore implements ObjectStore {
  constructor(private readonly root: string) {}
  private path(bucket: string, key: string) { return join(this.root, bucket, key); }

  async put(bucket: string, key: string, body: Buffer) {
    const p = this.path(bucket, key);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
  }
  async get(bucket: string, key: string) {
    const p = this.path(bucket, key);
    return existsSync(p) ? readFileSync(p) : null;
  }
  async size(bucket: string, key: string) {
    const p = this.path(bucket, key);
    return existsSync(p) ? statSync(p).size : null;
  }
  async remove(bucket: string, key: string) {
    rmSync(this.path(bucket, key), { force: true });
  }
  async health() {
    mkdirSync(this.root, { recursive: true });
  }
}

/**
 * Production backend. Buckets are private — nothing is ever written with a
 * public ACL, and objects are encrypted at rest by the bucket's configured
 * algorithm. Clients never touch S3 directly: they PUT to this API, which
 * verifies the bytes before they are stored, and GET through a signed link
 * this API authorises. That keeps the bucket unreachable from the internet.
 */
export class S3ObjectStore implements ObjectStore {
  private readonly client: S3Client;

  constructor(private readonly env: Env) {
    this.client = new S3Client({
      region: env.S3_REGION,
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: env.S3_ACCESS_KEY_ID
        ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
        : undefined, // fall back to the instance role when keys are not supplied
    });
  }

  private encryption() {
    if (!this.env.S3_SSE) return {};
    if (this.env.S3_SSE === "aws:kms") {
      return {
        ServerSideEncryption: "aws:kms" as const,
        ...(this.env.S3_SSE_KMS_KEY_ID ? { SSEKMSKeyId: this.env.S3_SSE_KMS_KEY_ID } : {}),
      };
    }
    return { ServerSideEncryption: "AES256" as const };
  }

  async put(bucket: string, key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ...this.encryption(),
    }));
  }

  async get(bucket: string, key: string) {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const bytes = await res.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch (err) {
      if (isMissing(err)) return null;
      throw err;
    }
  }

  async size(bucket: string, key: string) {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return res.ContentLength ?? null;
    } catch (err) {
      if (isMissing(err)) return null;
      throw err;
    }
  }

  async remove(bucket: string, key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  async health() {
    // A HEAD for a key that does not exist still proves credentials, region and
    // bucket reachability, without listing anything.
    await this.size(this.env.S3_BUCKET_PHI, "__health__");
  }
}

function isMissing(err: unknown): boolean {
  const name = (err as { name?: string })?.name;
  const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  return name === "NoSuchKey" || name === "NotFound" || status === 404;
}
