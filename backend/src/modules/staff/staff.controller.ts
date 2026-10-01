import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import type { Request } from "express";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { Roles } from "../../common/auth.guard";
import { validate } from "../../common/validate";
import { apiRoute } from "../../docs/registry";
import type { Db } from "../../db/client";
import { schema as s } from "../../db/client";
import { BookingsService } from "../bookings/bookings.service";
import { StaffDecisionBody } from "../bookings/bookings.schemas";
import { CompletionService } from "../bookings/completion.service";
import { ReminderService } from "../bookings/reminder.service";
import { ServicesService } from "../services/services.service";

const Uuid = z.string().uuid();
const Decision = z.enum(["confirm", "cancel", "complete"]);
const BookingsQuery = z.object({ status: z.enum(["pending", "confirmed"]).default("pending") });
const utcToday = () => new Date().toISOString().slice(0, 10);
/** First name and last initial: enough for staff to recognise a request without the full identity. */
const memberName = (first: string | null, last: string | null) => (first ? `${first} ${(last ?? "").slice(0, 1)}.`.trim() : "Member");

/**
 * Operations surface. Every route is role-gated (staff/admin); the member app never calls it.
 * It is what moves a request out of "pending", so members see confirmed / declined outcomes.
 */
@Controller("v1/staff")
export class StaffController {
  constructor(
    @Inject("DB") private readonly db: Db,
    private readonly bookings: BookingsService,
    private readonly services: ServicesService,
    private readonly completion: CompletionService,
    private readonly reminders: ReminderService,
  ) {}

  /** Everything waiting for a decision, oldest first. Contains references and dates, not clinical detail. */
  @Roles("staff", "admin")
  @Get("queue")
  async queue() {
    const [appts, transport, requests] = await Promise.all([
      this.db.select({ id: s.appointmentRequests.id, reference: s.appointmentRequests.reference, date: s.appointmentRequests.requestedDate, createdAt: s.appointmentRequests.createdAt })
        .from(s.appointmentRequests).where(and(eq(s.appointmentRequests.status, "pending"), isNull(s.appointmentRequests.deletedAt)))
        .orderBy(asc(s.appointmentRequests.createdAt)).limit(100),
      this.db.select({ id: s.transportRequests.id, reference: s.transportRequests.reference, date: s.transportRequests.pickupDate, createdAt: s.transportRequests.createdAt })
        .from(s.transportRequests).where(and(eq(s.transportRequests.status, "pending"), isNull(s.transportRequests.deletedAt)))
        .orderBy(asc(s.transportRequests.createdAt)).limit(100),
      this.db.select({ id: s.serviceRequests.id, reference: s.serviceRequests.reference, date: s.serviceRequests.preferredDate, createdAt: s.serviceRequests.createdAt })
        .from(s.serviceRequests).where(and(eq(s.serviceRequests.status, "pending"), isNull(s.serviceRequests.deletedAt)))
        .orderBy(asc(s.serviceRequests.createdAt)).limit(100),
    ]);
    return {
      appointments: appts, transport, serviceRequests: requests,
      total: appts.length + transport.length + requests.length,
    };
  }

  /**
   * The working list for the operations console: pending requests to decide, or confirmed bookings
   * to complete. Names who the booking is with and the member's first name; no clinical detail.
   * Marketplace bookings are left out because their providers handle them in the portal.
   */
  @Roles("staff", "admin")
  @Get("bookings")
  async bookingsList(@Query() q: unknown) {
    const { status } = validate(BookingsQuery, q);
    const today = utcToday();
    const pending = status === "pending";
    const [appts, transport, requests] = await Promise.all([
      this.db.select({ r: s.appointmentRequests, target: s.hospitals.name, first: s.userProfiles.firstName, last: s.userProfiles.lastName })
        .from(s.appointmentRequests)
        .innerJoin(s.hospitals, eq(s.hospitals.id, s.appointmentRequests.hospitalId))
        .leftJoin(s.userProfiles, eq(s.userProfiles.userId, s.appointmentRequests.userId))
        .where(and(eq(s.appointmentRequests.status, status), isNull(s.appointmentRequests.deletedAt)))
        .orderBy(asc(pending ? s.appointmentRequests.createdAt : s.appointmentRequests.requestedDate)).limit(100),
      this.db.select({ r: s.transportRequests, target: s.transportProviders.name, first: s.userProfiles.firstName, last: s.userProfiles.lastName })
        .from(s.transportRequests)
        .innerJoin(s.transportProviders, eq(s.transportProviders.id, s.transportRequests.providerId))
        .leftJoin(s.userProfiles, eq(s.userProfiles.userId, s.transportRequests.userId))
        .where(and(pending ? eq(s.transportRequests.status, "pending") : inArray(s.transportRequests.status, ["confirmed", "in_transit"]), isNull(s.transportRequests.deletedAt)))
        .orderBy(asc(pending ? s.transportRequests.createdAt : s.transportRequests.pickupDate)).limit(100),
      this.db.select({ r: s.serviceRequests, clinic: s.petClinics.name, specialist: s.independentSpecialists.name, first: s.userProfiles.firstName, last: s.userProfiles.lastName })
        .from(s.serviceRequests)
        .leftJoin(s.petClinics, and(eq(s.serviceRequests.targetType, "pet_clinic"), eq(s.petClinics.id, s.serviceRequests.targetId)))
        .leftJoin(s.independentSpecialists, and(eq(s.serviceRequests.targetType, "independent_specialist"), eq(s.independentSpecialists.id, s.serviceRequests.targetId)))
        .leftJoin(s.userProfiles, eq(s.userProfiles.userId, s.serviceRequests.userId))
        .where(and(eq(s.serviceRequests.status, status), ne(s.serviceRequests.targetType, "listing"), isNull(s.serviceRequests.deletedAt)))
        .orderBy(asc(pending ? s.serviceRequests.createdAt : s.serviceRequests.preferredDate)).limit(100),
    ]);

    const row = (kind: "appointment" | "transport" | "service_request", kindLabel: string, r: { id: string; reference: string; status: string; createdAt: Date },
      target: string, first: string | null, last: string | null, date: string | null, time: string | null, lastDay: string | null) => ({
      kind, kindLabel, id: r.id, reference: `#${r.reference}`, status: r.status, target, member: memberName(first, last),
      date, time, createdAt: r.createdAt,
      canDecide: r.status === "pending",
      // Same rule the completion endpoint enforces: on or after the booking's (last) day.
      canComplete: r.status !== "pending" && (!lastDay || lastDay <= today),
    });
    const items = [
      ...appts.map((x) => row("appointment", "Hospital appointment", x.r, x.target, x.first, x.last, x.r.requestedDate, x.r.requestedTime, x.r.requestedDate)),
      ...transport.map((x) => row("transport", "Medical transport", x.r, x.target, x.first, x.last, x.r.pickupDate, x.r.pickupTime?.slice(0, 5) ?? null, x.r.pickupDate)),
      ...requests.map((x) => row("service_request", x.r.targetType === "pet_clinic" ? "Pet clinic" : "Independent specialist", x.r,
        x.clinic ?? x.specialist ?? "Provider", x.first, x.last, x.r.preferredDate, x.r.preferredTime, x.r.endDate ?? x.r.preferredDate)),
    ];
    // Pending: oldest request first. Confirmed: soonest booking first.
    items.sort((a, b) => pending
      ? a.createdAt.getTime() - b.createdAt.getTime()
      : (a.date ?? "9999").localeCompare(b.date ?? "9999"));
    return { status, items };
  }

  /** Runs the automatic completion sweep now instead of waiting for the next interval. */
  @Roles("staff", "admin")
  @HttpCode(200)
  @Post("completion-sweep")
  sweep() { return this.completion.sweep(); }

  /** Sends tomorrow's booking reminders now instead of waiting for the next interval. */
  @Roles("staff", "admin")
  @HttpCode(200)
  @Post("reminder-sweep")
  remind() { return this.reminders.sweep(); }

  @Roles("staff", "admin")
  @HttpCode(200)
  @Post("transport/:id/:decision")
  decideTransport(@Req() req: Request, @Param("id") id: string, @Param("decision") decision: string, @Body() body: unknown) {
    const d = validate(Decision, decision);
    if (d === "complete") return this.completion.completeByStaff(req.userId!, "transport", validate(Uuid, id));
    return this.bookings.staffDecideTransport(req.userId!, validate(Uuid, id), d, validate(StaffDecisionBody, body ?? {}));
  }

  @Roles("staff", "admin")
  @HttpCode(200)
  @Post("service-requests/:id/:decision")
  decideRequest(@Req() req: Request, @Param("id") id: string, @Param("decision") decision: string, @Body() body: unknown) {
    const d = validate(Decision, decision);
    if (d === "complete") return this.completion.completeByStaff(req.userId!, "service_request", validate(Uuid, id));
    const input = validate(StaffDecisionBody, body ?? {});
    return this.services.staffDecideRequest(req.userId!, validate(Uuid, id), d, input.reason);
  }
}

apiRoute({ method: "get", path: "/v1/staff/bookings", tag: "staff", summary: "Pending or confirmed bookings for the operations console (staff/admin)", auth: true, query: BookingsQuery });
apiRoute({ method: "get", path: "/v1/staff/queue", tag: "staff", summary: "Requests waiting for a decision (staff/admin)", auth: true });
apiRoute({ method: "post", path: "/v1/staff/transport/{id}/{decision}", tag: "staff", summary: "Confirm, decline or complete a transport request (staff/admin)", auth: true, body: StaffDecisionBody, status: 200 });
apiRoute({ method: "post", path: "/v1/staff/service-requests/{id}/{decision}", tag: "staff", summary: "Confirm, decline or complete a pet/specialist request (staff/admin)", auth: true, body: StaffDecisionBody, status: 200 });
apiRoute({ method: "post", path: "/v1/staff/reminder-sweep", tag: "staff", summary: "Send day-before reminders for tomorrow's confirmed bookings (staff/admin)", auth: true, status: 200 });
apiRoute({ method: "post", path: "/v1/staff/completion-sweep", tag: "staff", summary: "Complete every confirmed booking whose date has passed (staff/admin)", auth: true, status: 200 });
