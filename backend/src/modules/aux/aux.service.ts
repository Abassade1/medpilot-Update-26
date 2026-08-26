import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Db } from "../../db/client";
import { schema as s } from "../../db/client";
import { AppError } from "../../common/errors";
import { loadEnv } from "../../config/env";
import { AuditService } from "../auth/audit.service";
import { QuotaService } from "../billing/quota.service";
import { NotificationsService } from "../notifications/notifications.service";
import { StorageService, BUCKETS } from "../storage/storage.service";
import { DeterministicAuxDriver, type AuxDriver } from "./aux.driver";

export const DISCLAIMER =
  "AUX provides general guidance only and is not a medical diagnosis. Always consult a qualified clinician. In an emergency call 911 or your local emergency number.";
const DISCLAIMER_VERSION = "v1";
const MEAL_DISCLAIMER = "Estimates only. Not a substitute for professional dietary advice.";

@Injectable()
export class AuxService {
  private readonly env = loadEnv();
  private readonly driver: AuxDriver;

  constructor(
    @Inject("DB") private readonly db: Db,
    private readonly quota: QuotaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {
    if (this.env.AUX_DRIVER === "llm") {
      // The llm driver ships when Q5 (regulatory posture) is resolved and a
      // BAA-covered provider is configured. Fail loudly rather than silently
      // degrading a clinical feature.
      throw new Error("AUX_DRIVER=llm is not configured; use deterministic");
    }
    this.driver = new DeterministicAuxDriver();
  }

  // ---- triage funnel -------------------------------------------------------
  async triageStep(userId: string, input: { symptomCode?: string; sessionId?: string; conditionCode?: string }) {
    // Step 1: symptom chip → open a session, return the follow-up chips.
    if (input.symptomCode) {
      const [symptom] = await this.db.select().from(s.triageSymptoms)
        .where(and(eq(s.triageSymptoms.code, input.symptomCode), eq(s.triageSymptoms.active, true))).limit(1);
      if (!symptom) throw new AppError("validation_failed", "Unknown symptom");
      const sessionId = uuidv7();
      await this.db.transaction(async (tx) => {
        await tx.insert(s.aiSessions).values({
          id: sessionId, userId, kind: "triage",
          modelVersion: this.driver.modelVersion, disclaimerVersion: DISCLAIMER_VERSION,
        });
        await tx.insert(s.aiMessages).values({
          id: uuidv7(), sessionId, role: "user", content: `symptom:${symptom.code}`,
        });
      });
      const conditions = await this.db.select().from(s.triageConditions)
        .where(eq(s.triageConditions.active, true)).orderBy(asc(s.triageConditions.sortOrder));
      return {
        sessionId,
        step: "conditions" as const,
        prompt: { title: `${symptom.label}!`, subtitle: "Sorry to hear that! Do you have any of the following?" },
        conditions: conditions.map((c) => ({ code: c.code, label: c.label, emoji: c.emoji })),
      };
    }

    // Step 2: condition chip → produce and persist the result.
    if (!input.sessionId || !input.conditionCode) {
      throw new AppError("validation_failed", "Provide a symptomCode to start, or sessionId + conditionCode to continue");
    }
    const session = await this.ownedSession(userId, input.sessionId);
    if (session.status !== "active") throw new AppError("conflict", "This session is already complete");

    const [condition] = await this.db.select().from(s.triageConditions)
      .where(eq(s.triageConditions.code, input.conditionCode)).limit(1);
    if (!condition) throw new AppError("validation_failed", "Unknown condition");

    const [first] = await this.db.select().from(s.aiMessages)
      .where(eq(s.aiMessages.sessionId, session.id)).orderBy(asc(s.aiMessages.createdAt)).limit(1);
    const symptomCode = first?.content.replace("symptom:", "") ?? "unknown";

    const memberConditions = (await this.db.select({ code: s.conditions.code })
      .from(s.userConditions)
      .innerJoin(s.conditions, eq(s.conditions.id, s.userConditions.conditionId))
      .where(eq(s.userConditions.userId, userId))).map((c) => c.code);

    const out = await this.driver.triage(symptomCode, condition.code, memberConditions);

    await this.db.transaction(async (tx) => {
      await tx.insert(s.aiMessages).values({
        id: uuidv7(), sessionId: session.id, role: "user", content: `condition:${condition.code}`,
      });
      await tx.insert(s.aiMessages).values({
        id: uuidv7(), sessionId: session.id, role: "assistant", content: JSON.stringify(out),
      });
      await tx.insert(s.triageResults).values({
        id: uuidv7(), sessionId: session.id,
        title: out.title, summary: out.summary,
        possibleCauses: out.possibleCauses, recommendedTreatment: out.recommendedTreatment,
        severity: out.severity,
      });
      await tx.update(s.aiSessions).set({ status: "completed", completedAt: new Date() })
        .where(eq(s.aiSessions.id, session.id));
      await tx.insert(s.activities).values({
        id: uuidv7(), userId, type: "diagnosis",
        title: `${out.title} assessment`,
        subtitle: "AUX diagnosis session",
        status: "completed", targetType: "ai_session", targetId: session.id,
      });
    });
    await this.audit.write({ actorUserId: userId, action: "aux.triage_completed", resourceType: "ai_session", resourceId: session.id });
    return { sessionId: session.id, step: "result" as const, result: await this.sessionResult(userId, session.id) };
  }

  private async ownedSession(userId: string, id: string) {
    const [session] = await this.db.select().from(s.aiSessions).where(eq(s.aiSessions.id, id)).limit(1);
    if (!session || session.userId !== userId) throw AppError.notFound("Session");
    return session;
  }

  async sessionResult(userId: string, id: string) {
    const session = await this.ownedSession(userId, id);
    const [r] = await this.db.select().from(s.triageResults).where(eq(s.triageResults.sessionId, id)).limit(1);
    if (!r) throw AppError.notFound("Result");
    return {
      sessionId: session.id,
      title: r.title, summary: r.summary,
      possibleCauses: r.possibleCauses, recommendedTreatment: r.recommendedTreatment,
      severity: r.severity,
      disclaimer: DISCLAIMER,
      createdAt: r.createdAt,
    };
  }

  async translate(userId: string, id: string, locale: string) {
    const r = await this.sessionResult(userId, id);
    const translated = await this.driver.translate(
      { title: r.title, summary: r.summary, possibleCauses: r.possibleCauses, recommendedTreatment: r.recommendedTreatment },
      locale,
    );
    if (!translated) {
      throw new AppError("validation_failed", "Translation isn't available for that language yet", {
        fields: { locale: "Only 'fr' is available right now" },
      });
    }
    return { locale, ...translated, disclaimer: DISCLAIMER };
  }

  async escalate(userId: string, id: string, kind: "doctor" | "hospital" | "evacuation") {
    await this.sessionResult(userId, id); // ownership + existence
    await this.db.insert(s.activities).values({
      id: uuidv7(), userId, type: "diagnosis",
      title: "Escalation requested",
      subtitle: kind === "doctor" ? "Connect my Doctor" : kind === "hospital" ? "Connect to Hospital" : "Request Emergency Evac",
      status: "pending", targetType: "ai_session", targetId: id,
    });
    await this.notifications.notify(userId, {
      type: "aux.escalation", title: "We're on it",
      body: "Your request has reached our care team. Someone will contact you shortly.",
      deepLink: `medpilot://aux/sessions/${id}`,
    });
    await this.audit.write({ actorUserId: userId, action: `aux.escalate_${kind}`, resourceType: "ai_session", resourceId: id });
    return { status: "received", kind };
  }

  // ---- meal analysis -------------------------------------------------------
  async mealUploadUrl(userId: string, input: { mimeType: "image/jpeg" | "image/png"; sizeBytes: number }) {
    // quota gate BEFORE any bytes move (spec §04 J5); consumed on success below
    const u = await this.quota.usage(userId, "meal_analysis");
    if (!u.unlimited && u.used >= u.limit) {
      throw new AppError("quota_exceeded", "You've used your free meal analysis", {
        meta: { metric: "meal_analysis", limit: u.limit, used: u.used },
      });
    }
    return this.storage.createUploadTicket({
      ownerUserId: userId, bucket: BUCKETS.phi,
      mimeType: input.mimeType, sizeBytes: input.sizeBytes,
      maxBytes: 8 * 1024 * 1024, allowed: ["image/jpeg", "image/png"],
    });
  }

  async createMeal(userId: string, fileId: string) {
    const file = await this.storage.assertStored(fileId, userId);
    await this.quota.consume(userId, "meal_analysis");
    const id = uuidv7();
    const sessionId = uuidv7();
    await this.db.transaction(async (tx) => {
      await tx.insert(s.aiSessions).values({
        id: sessionId, userId, kind: "meal",
        modelVersion: this.driver.modelVersion, disclaimerVersion: DISCLAIMER_VERSION,
      });
      await tx.insert(s.mealAnalyses).values({ id, userId, sessionId, imageFileId: file.id });
    });

    const process = async () => {
      try {
        const out = await this.driver.analyzeMeal();
        await this.db.transaction(async (tx) => {
          await tx.update(s.mealAnalyses).set({
            status: "complete",
            caloriesEstimate: out.calories,
            baselineDeltaPct: out.baselineDeltaPct.toString(),
            completedAt: new Date(),
          }).where(eq(s.mealAnalyses.id, id));
          await tx.insert(s.mealSegments).values(out.segments.map((seg, i) => ({
            id: uuidv7(), analysisId: id, label: seg.label,
            percentage: seg.percentage.toString(), colorHex: seg.colorHex, sortOrder: i,
          })));
          await tx.insert(s.mealDetails).values(out.details.map((d, i) => ({
            id: uuidv7(), analysisId: id, code: d.code, label: d.label, body: d.body ?? null, sortOrder: i,
          })));
          await tx.update(s.aiSessions).set({ status: "completed", completedAt: new Date() })
            .where(eq(s.aiSessions.id, sessionId));
          await tx.insert(s.activities).values({
            id: uuidv7(), userId, type: "meal",
            title: "Meal analysis",
            subtitle: `${out.calories} estimated calories`,
            status: "completed", targetType: "meal_analysis", targetId: id,
          });
        });
      } catch {
        // failure refunds the quota so the member's one free analysis isn't burned
        await this.db.update(s.mealAnalyses).set({ status: "failed", failureReason: "Analysis failed" })
          .where(eq(s.mealAnalyses.id, id));
        await this.quota.refund(userId, "meal_analysis");
      }
    };
    // test runs synchronously for determinism; dev keeps the analysing-screen UX
    if (this.env.NODE_ENV === "test") await process();
    else setTimeout(process, 1500);

    return { id, status: "queued" as const, pollAfterMs: 1200 };
  }

  async getMeal(userId: string, id: string) {
    const [m] = await this.db.select().from(s.mealAnalyses).where(eq(s.mealAnalyses.id, id)).limit(1);
    if (!m || m.userId !== userId) throw AppError.notFound("Analysis");
    if (m.status !== "complete") {
      return { id: m.id, status: m.status, failureReason: m.failureReason, pollAfterMs: 800 };
    }
    const [segments, details] = await Promise.all([
      this.db.select().from(s.mealSegments).where(eq(s.mealSegments.analysisId, id)).orderBy(asc(s.mealSegments.sortOrder)),
      this.db.select().from(s.mealDetails).where(eq(s.mealDetails.analysisId, id)).orderBy(asc(s.mealDetails.sortOrder)),
    ]);
    return {
      id: m.id, status: m.status,
      caloriesEstimate: m.caloriesEstimate,
      baselineDeltaPct: m.baselineDeltaPct ? Number(m.baselineDeltaPct) : null,
      segments: segments.map((x) => ({ label: x.label, percentage: Number(x.percentage), colorHex: x.colorHex })),
      details: details.map((x) => ({ code: x.code, label: x.label, body: x.body })),
      disclaimer: MEAL_DISCLAIMER,
      completedAt: m.completedAt,
    };
  }
}
