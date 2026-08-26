import { Controller, Get, Inject } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { Public } from "../../common/auth.guard";
import type { Db } from "../../db/client";
import { apiRoute } from "../../docs/registry";
import { z } from "zod";

@Controller()
export class HealthController {
  constructor(@Inject("DB") private readonly db: Db) {}

  @Public()
  @Get("healthz")
  async health() {
    let database = "ok";
    try { await this.db.execute(sql`select 1`); } catch { database = "unreachable"; }
    return { status: database === "ok" ? "ok" : "degraded", database, time: new Date().toISOString() };
  }
}
apiRoute({ method: "get", path: "/healthz", tag: "ops", summary: "Liveness + database health", auth: false, response: z.object({ status: z.string(), database: z.string(), time: z.string() }) });
