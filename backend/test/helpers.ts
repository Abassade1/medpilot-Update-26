import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgres://medpilot@localhost:5433/medpilot_test";
process.env.API_PUBLIC_URL = "http://127.0.0.1:4100";
process.env.APP_SECRET ??= "test-secret-value-at-least-32-chars-long";

let app: NestExpressApplication | null = null;

export async function getApp(): Promise<NestExpressApplication> {
  if (app) return app;
  const { createApp } = await import("../src/main");
  app = await createApp();
  await app.init();
  return app;
}
export async function closeApp() {
  if (app) {
    const { Pool } = await import("pg");
    const pool = app.get(Pool, { strict: false });
    await app.close();
    await pool?.end?.().catch(() => {});
    app = null;
  }
}
export const http = async () => request((await getApp()).getHttpServer());

let n = 0;
export const uniqueEmail = (p = "user") => `${p}${Date.now()}${n++}@medpilot.test`;

export interface Session { accessToken: string; refreshToken: string; userId: string; auth: string }

export async function registerUser(overrides: Record<string, unknown> = {}): Promise<Session> {
  const body = {
    email: uniqueEmail(), password: "password123",
    firstName: "Test", lastName: "Member",
    phone: "4038903333", dateOfBirth: "1993-08-26", ...overrides,
  };
  const res = await (await http()).post("/v1/auth/register").send(body).expect(201);
  return {
    accessToken: res.body.tokens.accessToken,
    refreshToken: res.body.tokens.refreshToken,
    userId: res.body.user.id,
    auth: `Bearer ${res.body.tokens.accessToken}`,
  };
}

export async function firstHospitalId(session: Session): Promise<string> {
  const res = await (await http()).get("/v1/hospitals").set("Authorization", session.auth).expect(200);
  return res.body[0].id;
}

/** Reads seeded reference ids straight from the database. */
export async function conditionIds(limit: number): Promise<string[]> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await pool.query<{ id: string }>("select id from conditions order by sort_order limit $1", [limit]);
  await pool.end();
  return r.rows.map((x) => x.id);
}

/** Minimal valid JPEG so magic-byte validation passes. */
export function jpegBytes(): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.from("\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00", "latin1"),
    Buffer.alloc(300),
    Buffer.from([0xff, 0xd9]),
  ]);
}
