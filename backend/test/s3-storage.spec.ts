import S3rver from "s3rver";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";

/**
 * Exercises the S3 object store against a server that speaks the real S3 wire
 * protocol, driven by the real AWS SDK. This proves the driver itself — auth,
 * region, path style, encryption headers, put/get/head/delete — rather than a
 * stand-in for it. Only the provider's credentials remain untested.
 */
describe("s3 object store", () => {
  const BUCKET = "medpilot-phi-test";
  let server: { run: () => Promise<unknown>; close: () => Promise<void> };
  let dir: string;
  let endpoint: string;
  let store: import("../src/modules/storage/object-store").S3ObjectStore;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "s3rver-"));
    server = new S3rver({
      address: "127.0.0.1",
      port: 0,
      silent: true,
      directory: dir,
      configureBuckets: [{ name: BUCKET, configs: [] }],
    });
    const address = (await server.run()) as AddressInfo;
    endpoint = `http://127.0.0.1:${address.port}`;

    const { S3ObjectStore } = await import("../src/modules/storage/object-store");
    store = new S3ObjectStore({
      S3_REGION: "us-east-1",
      S3_ENDPOINT: endpoint,
      S3_FORCE_PATH_STYLE: true,
      S3_ACCESS_KEY_ID: "S3RVER",
      S3_SECRET_ACCESS_KEY: "S3RVER",
      S3_SSE: "AES256",
      S3_SSE_KMS_KEY_ID: "",
      S3_BUCKET_PHI: BUCKET,
    } as never);
  }, 60_000);

  afterAll(async () => {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const key = () => `user-${Date.now()}/${Math.random().toString(36).slice(2)}.jpg`;
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);

  it("stores and reads an object byte-for-byte", async () => {
    const k = key();
    await store.put(BUCKET, k, jpeg, "image/jpeg");
    const got = await store.get(BUCKET, k);
    expect(got).not.toBeNull();
    expect(Buffer.compare(got!, jpeg)).toBe(0);
  });

  it("reports the stored size, which is what gates a record going ready", async () => {
    const k = key();
    await store.put(BUCKET, k, jpeg, "image/jpeg");
    await expect(store.size(BUCKET, k)).resolves.toBe(jpeg.length);
  });

  it("returns null rather than throwing for an object that does not exist", async () => {
    await expect(store.get(BUCKET, "user-x/missing.jpg")).resolves.toBeNull();
    await expect(store.size(BUCKET, "user-x/missing.jpg")).resolves.toBeNull();
  });

  it("deletes an object so it can no longer be read", async () => {
    const k = key();
    await store.put(BUCKET, k, jpeg, "image/jpeg");
    await store.remove(BUCKET, k);
    await expect(store.get(BUCKET, k)).resolves.toBeNull();
  });

  it("passes a health probe without listing bucket contents", async () => {
    await expect(store.health()).resolves.toBeUndefined();
  });

  it("requests server-side encryption on every write", async () => {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const sent: Record<string, unknown>[] = [];
    const client = (store as unknown as { client: { send: (c: unknown) => Promise<unknown> } }).client;
    const original = client.send.bind(client);
    client.send = async (cmd: unknown) => {
      if (cmd instanceof PutObjectCommand) sent.push(cmd.input as unknown as Record<string, unknown>);
      return original(cmd);
    };

    await store.put(BUCKET, key(), jpeg, "image/jpeg");

    client.send = original;
    expect(sent).toHaveLength(1);
    expect(sent[0]!.ServerSideEncryption).toBe("AES256");
    // Never public: no ACL is set, so the object inherits the bucket's private default.
    expect(sent[0]!.ACL).toBeUndefined();
  });

  it("rejects a wrong secret key instead of silently writing nowhere", async () => {
    const { S3ObjectStore } = await import("../src/modules/storage/object-store");
    const bad = new S3ObjectStore({
      S3_REGION: "us-east-1",
      S3_ENDPOINT: endpoint,
      S3_FORCE_PATH_STYLE: true,
      S3_ACCESS_KEY_ID: "WRONG",
      S3_SECRET_ACCESS_KEY: "WRONG",
      S3_SSE: "AES256",
      S3_SSE_KMS_KEY_ID: "",
      S3_BUCKET_PHI: BUCKET,
    } as never);
    await expect(bad.put(BUCKET, key(), jpeg, "image/jpeg")).rejects.toThrow();
  });
});
