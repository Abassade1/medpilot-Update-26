import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { sql, type SQL } from "drizzle-orm";
import type { Db } from "../../db/client";
import { log } from "../../common/logger";
import { loadEnv } from "../../config/env";
import { NotificationsService } from "../notifications/notifications.service";

type Kind = "appointment" | "transport" | "service_request";
type Due = { id: string; user_id: string; time: string | null };

const utcTomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

// Push copy stays generic: which hospital or clinic someone is visiting is health information.
const COPY: Record<Kind, { title: string; what: string; link: (id: string) => string }> = {
  appointment: { title: "Appointment tomorrow", what: "Your appointment", link: (id) => `medpilot://appointments/${id}` },
  transport: { title: "Transport tomorrow", what: "Your transport pickup", link: (id) => `medpilot://transport/${id}` },
  service_request: { title: "Booking tomorrow", what: "Your booking", link: (id) => `medpilot://requests/${id}` },
};

/**
 * Sends a reminder the day before each confirmed booking, unless the member has turned
 * "Appointment reminders" off. Push delivery itself still follows their push setting.
 */
@Injectable()
export class ReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly env = loadEnv();
  private timer: NodeJS.Timeout | null = null;

  constructor(@Inject("DB") private readonly db: Db, private readonly notifications: NotificationsService) {}

  onModuleInit() {
    const minutes = this.env.REMINDER_SWEEP_MINUTES;
    if (!minutes || process.env.NODE_ENV === "test") return;
    this.timer = setInterval(() => {
      this.sweep().catch((e) => log.warn("reminder_sweep_failed", { err: String(e) }));
    }, minutes * 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Finds the due bookings and claims each one by inserting its reminder row in the same
   * statement; only rows this call actually inserted come back, so nothing is sent twice.
   */
  private async claim(kind: Kind, due: SQL, forDate: string): Promise<Due[]> {
    const res = await this.db.execute(sql`
      with due as (${due}),
      claimed as (
        insert into booking_reminders (request_type, request_id, for_date)
        select ${kind}, id, ${forDate}::date from due
        on conflict do nothing
        returning request_id
      )
      select due.id, due.user_id, due.time from due join claimed on claimed.request_id = due.id
    `);
    return res.rows as Due[];
  }

  async sweep() {
    const day = utcTomorrow();
    const wantsReminders = sql`coalesce((select appointment_reminders from user_preferences p where p.user_id = r.user_id), true)`;

    const appointments = await this.claim("appointment", sql`
      select r.id, r.user_id, r.requested_time as time from appointment_requests r
      where r.status = 'confirmed' and r.requested_date = ${day}::date and r.deleted_at is null and ${wantsReminders}
    `, day);
    const transport = await this.claim("transport", sql`
      select r.id, r.user_id, to_char(r.pickup_time, 'HH24:MI') as time from transport_requests r
      where r.status = 'confirmed' and r.pickup_date = ${day}::date and r.deleted_at is null and ${wantsReminders}
    `, day);
    const requests = await this.claim("service_request", sql`
      select r.id, r.user_id, r.preferred_time as time from service_requests r
      where r.status = 'confirmed' and r.preferred_date = ${day}::date and r.deleted_at is null and ${wantsReminders}
    `, day);

    for (const [kind, rows] of [["appointment", appointments], ["transport", transport], ["service_request", requests]] as const) {
      const c = COPY[kind];
      for (const r of rows) {
        await this.notifications.notify(r.user_id, {
          type: `${kind}.reminder`, title: c.title,
          body: `${c.what} is tomorrow${r.time ? ` at ${r.time}` : ""}. Tap for the details.`,
          deepLink: c.link(r.id),
        });
      }
    }
    const result = { appointments: appointments.length, transport: transport.length, serviceRequests: requests.length };
    if (result.appointments + result.transport + result.serviceRequests > 0) log.info("reminder_sweep", result);
    return result;
  }
}
