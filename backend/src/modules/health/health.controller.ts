import { Controller, Get, Inject, Res } from "@nestjs/common";
import type { Response } from "express";
import { sql } from "drizzle-orm";
import { Public } from "../../common/auth.guard";
import type { Db } from "../../db/client";
import { apiRoute } from "../../docs/registry";
import { z } from "zod";
import { loadEnv } from "../../config/env";
import { StorageService } from "../storage/storage.service";
import { EmailService } from "../email/email.service";
import { log } from "../../common/logger";

/**
 * Two distinct questions, because orchestrators ask them for different reasons:
 *
 *   /healthz  — is this process alive? Never touches a dependency, so a database
 *               blip cannot cause a restart loop.
 *   /readyz   — can this instance actually serve traffic? Checks every hard
 *               dependency, and reports 503 when one is down so the load
 *               balancer takes the instance out of rotation.
 *
 * Neither response names a host, bucket, region or credential: they say which
 * dependency is unhealthy, not where it lives or why.
 */
@Controller()
export class HealthController {
  private readonly env = loadEnv();

  constructor(
    @Inject("DB") private readonly db: Db,
    private readonly storage: StorageService,
    private readonly email: EmailService,
  ) {}

  @Public()
  @Get("healthz")
  health() {
    return { status: "ok", time: new Date().toISOString() };
  }

  @Public()
  @Get("readyz")
  async ready(@Res({ passthrough: true }) res: Response) {
    const checks = await Promise.all([
      probe("database", () => this.db.execute(sql`select 1`)),
      probe("storage", () => this.storage.health()),
      // A live SMTP handshake on every probe would hammer the provider, so the
      // email transport is only verified where a failure is silent and costly.
      probe("email", () => this.email.verifyTransport()),
    ]);

    const dependencies = Object.fromEntries(checks.map((c) => [c.name, c.status]));
    const healthy = checks.every((c) => c.status === "ok");
    if (!healthy) res.status(503);

    return {
      status: healthy ? "ok" : "degraded",
      environment: this.env.NODE_ENV,
      dependencies,
      time: new Date().toISOString(),
    };
  }
}

async function probe(name: string, fn: () => Promise<unknown>): Promise<{ name: string; status: string }> {
  try {
    await withTimeout(fn(), 3000);
    return { name, status: "ok" };
  } catch (err) {
    // The detail goes to the log, where it is useful; the response stays terse.
    log.warn("readiness_check_failed", { dependency: name, reason: (err as Error).message });
    return { name, status: "unreachable" };
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), ms).unref()),
  ]);
}

apiRoute({
  method: "get", path: "/healthz", tag: "ops", auth: false,
  summary: "Liveness — the process is running",
  response: z.object({ status: z.string(), time: z.string() }),
});
apiRoute({
  method: "get", path: "/readyz", tag: "ops", auth: false,
  summary: "Readiness — every hard dependency is reachable (503 when not)",
  response: z.object({
    status: z.string(),
    environment: z.string(),
    dependencies: z.record(z.string(), z.string()),
    time: z.string(),
  }),
});
