import { Inject, Injectable } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Db } from "../../db/client";
import { schema as s } from "../../db/client";
import { AppError } from "../../common/errors";
import { loadEnv } from "../../config/env";
import { AuditService } from "../auth/audit.service";
import { QuotaService } from "./quota.service";

/**
 * Subscriptions are granted only from a server-verified store receipt — never
 * from a client claim (spec §14). The mock driver accepts a sandbox receipt
 * shape so the upgrade journey is testable before store products exist.
 */
@Injectable()
export class BillingService {
  private readonly env = loadEnv();
  constructor(
    @Inject("DB") private readonly db: Db,
    private readonly audit: AuditService,
    private readonly quota: QuotaService,
  ) {}

  async listPlans() {
    const rows = await this.db.select().from(s.plans).where(eq(s.plans.active, true)).orderBy(asc(s.plans.priceAmount));
    return rows.map((p) => ({
      id: p.id, code: p.code, name: p.name,
      priceLabel: p.priceAmount === 0 ? "Free" : `$${(p.priceAmount / 100).toFixed(0)}/${p.interval === "month" ? "monthly" : "yearly"}`,
      features: p.features,
    }));
  }

  async mySubscription(userId: string) {
    const [row] = await this.db.select({ sub: s.subscriptions, plan: s.plans })
      .from(s.subscriptions)
      .innerJoin(s.plans, eq(s.plans.id, s.subscriptions.planId))
      .where(eq(s.subscriptions.userId, userId)).limit(1);
    const usage = {
      mealAnalysis: await this.quota.usage(userId, "meal_analysis"),
      clinicAccess: await this.quota.usage(userId, "clinic_access"),
      evacuation: await this.quota.usage(userId, "evacuation"),
    };
    const shape = (u: { used: number; limit: number; unlimited: boolean }) =>
      ({ used: u.used, limit: u.unlimited ? null : u.limit });
    if (!row) {
      return {
        planCode: "basic" as const, status: "active" as const, currentPeriodEnd: null,
        usage: { mealAnalysis: shape(usage.mealAnalysis), clinicAccess: shape(usage.clinicAccess), evacuation: shape(usage.evacuation) },
      };
    }
    return {
      planCode: row.plan.code,
      status: row.sub.status,
      currentPeriodEnd: row.sub.currentPeriodEnd,
      cancelAtPeriodEnd: row.sub.cancelAtPeriodEnd,
      usage: { mealAnalysis: shape(usage.mealAnalysis), clinicAccess: shape(usage.clinicAccess), evacuation: shape(usage.evacuation) },
    };
  }

  async verifyReceipt(userId: string, input: { platform: "apple" | "google"; receipt: string; productId: string }) {
    if (this.env.BILLING_DRIVER !== "mock") {
      throw new AppError("upstream_unavailable", "Store verification isn't configured");
    }
    // Mock verification: a sandbox receipt is any non-empty opaque string; the
    // real driver calls Apple/Google here and reads the signed transaction.
    if (input.receipt.length < 8) {
      throw new AppError("validation_failed", "That purchase couldn't be verified", { fields: { receipt: "Invalid receipt" } });
    }
    const [plan] = await this.db.select().from(s.plans).where(eq(s.plans.code, "pro")).limit(1);
    if (!plan) throw AppError.notFound("Plan");

    const originalTransactionId = `${input.platform}:${input.receipt.slice(0, 40)}`;
    const [existing] = await this.db.select().from(s.subscriptions).where(eq(s.subscriptions.userId, userId)).limit(1);
    const periodEnd = new Date(Date.now() + 30 * 86400_000);

    if (existing) {
      await this.db.update(s.subscriptions).set({
        planId: plan.id, status: "active", source: input.platform,
        originalTransactionId, currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false, updatedAt: new Date(),
      }).where(eq(s.subscriptions.id, existing.id));
    } else {
      await this.db.insert(s.subscriptions).values({
        id: uuidv7(), userId, planId: plan.id, status: "active",
        source: input.platform, originalTransactionId, currentPeriodEnd: periodEnd,
      });
    }
    await this.db.insert(s.activities).values({
      id: uuidv7(), userId, type: "plan",
      title: "MedPilot Pro", subtitle: "Subscription active — unlimited analysis",
      status: "completed", targetType: "subscription",
    });
    await this.audit.write({ actorUserId: userId, action: "billing.subscription_activated", resourceType: "subscription", resourceId: userId });
    return this.mySubscription(userId);
  }
}
