import { Body, Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import type { Request } from "express";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { Roles } from "../../common/auth.guard";
import { validate } from "../../common/validate";
import { apiRoute } from "../../docs/registry";
import type { Db } from "../../db/client";
import { schema as s } from "../../db/client";
import { BookingsService } from "../bookings/bookings.service";
import { StaffDecisionBody } from "../bookings/bookings.schemas";
import { CompletionService } from "../bookings/completion.service";
import { ServicesService } from "../services/services.service";

const Uuid = z.string().uuid();
const Decision = z.enum(["confirm", "cancel", "complete"]);

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

  /** Runs the automatic completion sweep now instead of waiting for the next interval. */
  @Roles("staff", "admin")
  @HttpCode(200)
  @Post("completion-sweep")
  sweep() { return this.completion.sweep(); }

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

apiRoute({ method: "get", path: "/v1/staff/queue", tag: "staff", summary: "Requests waiting for a decision (staff/admin)", auth: true });
apiRoute({ method: "post", path: "/v1/staff/transport/{id}/{decision}", tag: "staff", summary: "Confirm, decline or complete a transport request (staff/admin)", auth: true, body: StaffDecisionBody, status: 200 });
apiRoute({ method: "post", path: "/v1/staff/service-requests/{id}/{decision}", tag: "staff", summary: "Confirm, decline or complete a pet/specialist request (staff/admin)", auth: true, body: StaffDecisionBody, status: 200 });
apiRoute({ method: "post", path: "/v1/staff/completion-sweep", tag: "staff", summary: "Complete every confirmed booking whose date has passed (staff/admin)", auth: true, status: 200 });
