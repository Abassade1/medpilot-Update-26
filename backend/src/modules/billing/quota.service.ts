import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { AppError } from "../../common/errors";
import { loadEnv } from "../../config/env";
import { TokenService } from "../auth/token.service";

export type Metric = "meal_analysis" | "clinic_access" | "evacuation";

/**
 * Metered free tier (spec §14). Counters live per calendar month; Pro plans
 * bypass entirely. Quota is checked *before* spend and consumed only on
 * success — failures call refund().
 */
@Injectable()
export class QuotaService {
  private readonly env = loadEnv();
  constructor(
    @Inject("DB") private readonly db: Db,
    private readonly tokens: TokenService,
  ) {}

  private limit(metric: Metric): number {
    return metric === "meal_analysis" ? this.env.QUOTA_MEAL_ANALYSIS
      : metric === "clinic_access" ? this.env.QUOTA_CLINIC_ACCESS
      : this.env.QUOTA_EVACUATION;
  }

  private periodStart(): string {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }

  async usage(userId: string, metric: Metric): Promise<{ used: number; limit: number; unlimited: boolean }> {
    const plan = await this.tokens.currentPlan(userId);
    if (plan === "pro") return { used: 0, limit: Infinity, unlimited: true };
    const rows = (await this.db.execute(sql`
      select used from usage_counters
      where user_id = ${userId} and metric = ${metric} and period_start = ${this.periodStart()}
    `)).rows as { used: number }[];
    return { used: rows[0]?.used ?? 0, limit: this.limit(metric), unlimited: false };
  }

  /** Atomically consumes one unit; throws quota_exceeded (402) when spent. */
  async consume(userId: string, metric: Metric): Promise<void> {
    const u = await this.usage(userId, metric);
    if (u.unlimited) return;
    const rows = (await this.db.execute(sql`
      insert into usage_counters (user_id, metric, period_start, used)
      values (${userId}, ${metric}, ${this.periodStart()}, 1)
      on conflict (user_id, metric, period_start)
      do update set used = usage_counters.used + 1
        where usage_counters.used < ${u.limit}
      returning used
    `)).rows;
    if (rows.length === 0) {
      throw new AppError("quota_exceeded", "You've used all of this on the free plan", {
        meta: { metric, limit: u.limit, used: u.limit },
      });
    }
  }

  async refund(userId: string, metric: Metric): Promise<void> {
    await this.db.execute(sql`
      update usage_counters set used = greatest(used - 1, 0)
      where user_id = ${userId} and metric = ${metric} and period_start = ${this.periodStart()}
    `).catch(() => {});
  }
}
