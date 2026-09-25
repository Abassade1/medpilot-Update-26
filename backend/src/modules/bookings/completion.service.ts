import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { and, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Db } from "../../db/client";
import { schema as s } from "../../db/client";
import { AppError } from "../../common/errors";
import { log } from "../../common/logger";
import { loadEnv } from "../../config/env";
import { AuditService } from "../auth/audit.service";
import { NotificationsService } from "../notifications/notifications.service";

export type CompletionKind = "appointment" | "transport" | "service_request";

const utcToday = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

// Push copy stays generic: which hospital or clinic someone visited is health information.
const COPY: Record<CompletionKind, { activity: "appointment" | "transport" | "service"; title: string; body: string; link: (id: string) => string; targetType: string }> = {
  appointment: { activity: "appointment", title: "How was your appointment?", body: "Your appointment is complete. Tap to rate your visit.", link: (id) => `medpilot://appointments/${id}`, targetType: "appointment" },
  transport: { activity: "transport", title: "How was your transport?", body: "Your transport is complete. Tap to rate it.", link: (id) => `medpilot://transport/${id}`, targetType: "transport" },
  service_request: { activity: "service", title: "How was your visit?", body: "Your booking is complete. Tap to rate your visit.", link: (id) => `medpilot://requests/${id}`, targetType: "service_request" },
};

/**
 * Moves confirmed bookings to "completed" — by staff, or automatically once the booking date has
 * passed — and asks the member to rate the visit. Vendor-marketplace bookings are excluded: their
 * providers complete them from the portal.
 */
@Injectable()
export class CompletionService implements OnModuleInit, OnModuleDestroy {
  private readonly env = loadEnv();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject("DB") private readonly db: Db,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    const minutes = this.env.COMPLETION_SWEEP_MINUTES;
    if (!minutes || process.env.NODE_ENV === "test") return;
    this.timer = setInterval(() => {
      this.sweep().catch((e) => log.warn("completion_sweep_failed", { err: String(e) }));
    }, minutes * 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async afterComplete(kind: CompletionKind, rows: { id: string; userId: string; reference: string }[]) {
    const c = COPY[kind];
    for (const r of rows) {
      await this.db.insert(s.activities).values({
        id: uuidv7(), userId: r.userId, type: c.activity, title: "Completed",
        subtitle: `Reference #${r.reference}`, status: "completed", targetType: c.targetType, targetId: r.id,
      });
      await this.notifications.notify(r.userId, { type: `${kind}.completed`, title: c.title, body: c.body, deepLink: c.link(r.id) });
    }
  }

  /** Staff marks one booking complete, on or after its date. */
  async completeByStaff(staffId: string, kind: CompletionKind, id: string) {
    const today = utcToday();
    const returning = { id: sql<string>`id`, userId: sql<string>`user_id`, reference: sql<string>`reference` };
    let rows: { id: string; userId: string; reference: string }[];

    if (kind === "appointment") {
      const [a] = await this.db.select().from(s.appointmentRequests).where(and(eq(s.appointmentRequests.id, id), isNull(s.appointmentRequests.deletedAt))).limit(1);
      if (!a) throw AppError.notFound("Appointment");
      if (a.status !== "confirmed") throw new AppError("conflict", "Only a confirmed appointment can be completed");
      if (a.requestedDate > today) throw new AppError("conflict", "An appointment can be completed on or after its date");
      rows = await this.db.update(s.appointmentRequests).set({ status: "completed", updatedAt: new Date() })
        .where(and(eq(s.appointmentRequests.id, id), eq(s.appointmentRequests.status, "confirmed"))).returning(returning);
    } else if (kind === "transport") {
      const [t] = await this.db.select().from(s.transportRequests).where(and(eq(s.transportRequests.id, id), isNull(s.transportRequests.deletedAt))).limit(1);
      if (!t) throw AppError.notFound("Transport booking");
      if (t.status !== "confirmed" && t.status !== "in_transit") throw new AppError("conflict", "Only a confirmed or in-transit transport can be completed");
      if (t.pickupDate > today) throw new AppError("conflict", "A transport can be completed on or after its pickup date");
      rows = await this.db.update(s.transportRequests).set({ status: "completed", updatedAt: new Date() })
        .where(and(eq(s.transportRequests.id, id), inArray(s.transportRequests.status, ["confirmed", "in_transit"]))).returning(returning);
    } else {
      const [r] = await this.db.select().from(s.serviceRequests).where(and(eq(s.serviceRequests.id, id), isNull(s.serviceRequests.deletedAt))).limit(1);
      if (!r || r.targetType === "listing") throw AppError.notFound("Request");
      if (r.status !== "confirmed") throw new AppError("conflict", "Only a confirmed request can be completed");
      const lastDay = r.endDate ?? r.preferredDate;
      if (lastDay && lastDay > today) throw new AppError("conflict", "A request can be completed on or after its date");
      rows = await this.db.update(s.serviceRequests).set({ status: "completed", updatedAt: new Date() })
        .where(and(eq(s.serviceRequests.id, id), eq(s.serviceRequests.status, "confirmed"))).returning(returning);
    }

    await this.afterComplete(kind, rows);
    await this.audit.write({ actorUserId: staffId, actorType: "staff", action: `booking.${kind}_complete`, resourceType: kind, resourceId: id });
    return { id, status: "completed" as const };
  }

  /**
   * Completes every confirmed booking whose date ended more than a day ago. The transaction-scoped
   * advisory lock means only one API instance runs a sweep at a time.
   */
  async sweep() {
    const cutoff = addDays(utcToday(), -1);
    const returning = { id: sql<string>`id`, userId: sql<string>`user_id`, reference: sql<string>`reference` };
    const done = await this.db.transaction(async (tx) => {
      const lock = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtext('medpilot.completion_sweep')) as ok`);
      if (!(lock.rows[0] as { ok: boolean }).ok) return null;
      const appointments = await tx.update(s.appointmentRequests).set({ status: "completed", updatedAt: new Date() })
        .where(and(eq(s.appointmentRequests.status, "confirmed"), lt(s.appointmentRequests.requestedDate, cutoff), isNull(s.appointmentRequests.deletedAt)))
        .returning(returning);
      const transport = await tx.update(s.transportRequests).set({ status: "completed", updatedAt: new Date() })
        .where(and(inArray(s.transportRequests.status, ["confirmed", "in_transit"]), lt(s.transportRequests.pickupDate, cutoff), isNull(s.transportRequests.deletedAt)))
        .returning(returning);
      const requests = await tx.update(s.serviceRequests).set({ status: "completed", updatedAt: new Date() })
        .where(and(
          eq(s.serviceRequests.status, "confirmed"), ne(s.serviceRequests.targetType, "listing"), isNull(s.serviceRequests.deletedAt),
          sql`coalesce(${s.serviceRequests.endDate}, ${s.serviceRequests.preferredDate}) < ${cutoff}`,
        ))
        .returning(returning);
      return { appointments, transport, requests };
    });
    if (!done) return { appointments: 0, transport: 0, serviceRequests: 0 };
    await this.afterComplete("appointment", done.appointments);
    await this.afterComplete("transport", done.transport);
    await this.afterComplete("service_request", done.requests);
    const result = { appointments: done.appointments.length, transport: done.transport.length, serviceRequests: done.requests.length };
    if (result.appointments + result.transport + result.serviceRequests > 0) log.info("completion_sweep", result);
    return result;
  }
}
