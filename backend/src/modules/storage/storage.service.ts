import { Inject, Injectable } from "@nestjs/common";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync, existsSync, statSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Db } from "../../db/client";
import { schema as s } from "../../db/client";
import { AppError } from "../../common/errors";
import { loadEnv } from "../../config/env";

export const BUCKETS = { phi: "medpilot-phi", media: "medpilot-media", public: "medpilot-public" } as const;

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/jpeg": "jpg",
  "image/png": "png",
  "audio/m4a": "m4a",
  "audio/mp4": "m4a",
};

/** Magic-byte sniffing — the declared extension/MIME is attacker-controlled (spec §15). */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 4).toString("latin1") === "%PDF") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.readUInt32BE(0) === 0x89504e47) return "image/png";
  if (buf.readUInt32BE(0) === 0x504b0304) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (buf.readUInt32BE(0) === 0xd0cf11e0) return "application/msword";
  if (buf.subarray(4, 8).toString("latin1") === "ftyp") return "audio/mp4";
  return null;
}
const compatible = (declared: string, sniffed: string) =>
  declared === sniffed ||
  (declared === "audio/m4a" && sniffed === "audio/mp4") ||
  // legacy .doc container is also used by some office files
  (declared === "application/msword" && sniffed === "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

interface Ticket { f: string; b: string; k: string; m: string; z: number; exp: number; op: "put" | "get" }

/**
 * Object storage behind a driver. The `local` driver keeps the two-phase
 * presigned flow intact (signed PUT/GET URLs against this API) so the mobile
 * client code is identical when the s3 driver is configured (spec §12).
 */
@Injectable()
export class StorageService {
  private readonly env = loadEnv();
  constructor(@Inject("DB") private readonly db: Db) {
    if (this.env.STORAGE_DRIVER === "s3") {
      throw new Error("S3 driver requires credentials; configure or use STORAGE_DRIVER=local");
    }
  }

  private sign(t: Ticket): string {
    const payload = Buffer.from(JSON.stringify(t)).toString("base64url");
    const mac = createHmac("sha256", this.env.APP_SECRET).update(payload).digest("base64url");
    return `${payload}.${mac}`;
  }
  verify(token: string, op: "put" | "get"): Ticket {
    const [payload, mac] = token.split(".");
    if (!payload || !mac) throw new AppError("bad_request", "Invalid upload token");
    const expect = createHmac("sha256", this.env.APP_SECRET).update(payload).digest();
    const got = Buffer.from(mac, "base64url");
    if (expect.length !== got.length || !timingSafeEqual(expect, got)) {
      throw new AppError("bad_request", "Invalid upload token");
    }
    const t = JSON.parse(Buffer.from(payload, "base64url").toString()) as Ticket;
    if (t.op !== op) throw new AppError("bad_request", "Invalid upload token");
    if (t.exp < Date.now()) throw new AppError("bad_request", "This link has expired");
    return t;
  }

  /** Phase 1 — validate the declaration, insert the files row, return a signed PUT. */
  async createUploadTicket(input: {
    ownerUserId: string; bucket: string; mimeType: string; sizeBytes: number; maxBytes: number; allowed: string[];
  }) {
    if (!input.allowed.includes(input.mimeType)) {
      throw new AppError("unsupported_type", "That file type isn't supported");
    }
    if (input.sizeBytes <= 0 || input.sizeBytes > input.maxBytes) {
      throw new AppError("file_too_large", `Files must be under ${Math.round(input.maxBytes / 1048576)} MB`);
    }
    const fileId = uuidv7();
    const key = `${input.ownerUserId}/${fileId}.${EXT[input.mimeType] ?? "bin"}`; // randomised, never the client filename
    await this.db.insert(s.files).values({
      id: fileId, ownerUserId: input.ownerUserId, bucket: input.bucket,
      objectKey: key, mimeType: input.mimeType, sizeBytes: input.sizeBytes,
    });
    const token = this.sign({ f: fileId, b: input.bucket, k: key, m: input.mimeType, z: input.sizeBytes, exp: Date.now() + 300_000, op: "put" });
    return {
      fileId,
      uploadUrl: `${this.env.API_PUBLIC_URL}/v1/uploads/${token}`,
      method: "PUT" as const,
      headers: { "Content-Type": input.mimeType },
    };
  }

  /** Phase 2 — the PUT itself: size + magic-byte verification, then persist. */
  async receiveUpload(token: string, body: Buffer): Promise<{ fileId: string }> {
    const t = this.verify(token, "put");
    if (body.length !== t.z) {
      await this.markFailed(t.f);
      throw new AppError("bad_request", "Uploaded size does not match the declaration");
    }
    const sniffed = sniffMime(body);
    if (!sniffed || !compatible(t.m, sniffed)) {
      await this.markFailed(t.f);
      throw new AppError("unsupported_type", "That file doesn't match its declared type");
    }
    const path = join(this.env.STORAGE_LOCAL_DIR, t.b, t.k);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
    await this.db.update(s.files).set({
      checksumSha256: createHash("sha256").update(body).digest("hex"),
      // dev scanner: magic-verified content is marked clean; production wires a real scanner here
      scanStatus: "clean",
    }).where(eq(s.files.id, t.f));
    return { fileId: t.f };
  }

  /** Confirms the object really exists and is clean before an owner row goes "ready". */
  async assertStored(fileId: string, ownerUserId: string) {
    const [f] = await this.db.select().from(s.files).where(eq(s.files.id, fileId)).limit(1);
    if (!f || f.ownerUserId !== ownerUserId) throw AppError.notFound("File");
    const path = join(this.env.STORAGE_LOCAL_DIR, f.bucket, f.objectKey);
    if (!existsSync(path) || statSync(path).size !== f.sizeBytes) {
      throw new AppError("bad_request", "The upload hasn't completed yet");
    }
    if (f.scanStatus !== "clean") throw new AppError("bad_request", "This file failed the safety scan");
    return f;
  }

  signedDownloadUrl(f: { id: string; bucket: string; objectKey: string; mimeType: string; sizeBytes: number }): string {
    const token = this.sign({ f: f.id, b: f.bucket, k: f.objectKey, m: f.mimeType, z: f.sizeBytes, exp: Date.now() + 300_000, op: "get" });
    return `${this.env.API_PUBLIC_URL}/v1/files/${token}`;
  }

  readObject(token: string): { buf: Buffer; mime: string } {
    const t = this.verify(token, "get");
    const path = join(this.env.STORAGE_LOCAL_DIR, t.b, t.k);
    if (!existsSync(path)) throw AppError.notFound("File");
    return { buf: readFileSync(path), mime: t.m };
  }

  /** Two-phase delete: caller soft-deletes the row; object removal here. */
  async deleteObject(fileId: string) {
    const [f] = await this.db.select().from(s.files).where(eq(s.files.id, fileId)).limit(1);
    if (!f) return;
    const path = join(this.env.STORAGE_LOCAL_DIR, f.bucket, f.objectKey);
    rmSync(path, { force: true });
    await this.db.update(s.files).set({ deletedAt: new Date() }).where(eq(s.files.id, fileId));
  }

  private async markFailed(fileId: string) {
    await this.db.update(s.files).set({ scanStatus: "infected" }).where(eq(s.files.id, fileId)).catch(() => {});
  }
}
