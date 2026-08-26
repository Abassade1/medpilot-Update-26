import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { Roles } from "../../common/auth.guard";
import { validate } from "../../common/validate";
import { BookingsService } from "./bookings.service";
import { IdempotencyService } from "./idempotency";
import { CreateAppointmentBody, CreateTransportBody, StaffDecisionBody } from "./bookings.schemas";
import { ActivitiesService } from "./activities.service";
import { apiRoute } from "../../docs/registry";
import { PageQuery } from "../../common/pagination";

const Uuid = z.string().uuid();
const ActivityQ = PageQuery.extend({
  type: z.enum(["appointment", "transport", "diagnosis", "meal", "record", "plan"]).optional(),
});

@Controller("v1")
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly idem: IdempotencyService,
    private readonly activities: ActivitiesService,
  ) {}

  @Post("appointments")
  async createAppointment(@Req() req: Request, @Body() body: unknown, @Headers("idempotency-key") key?: string) {
    const input = validate(CreateAppointmentBody, body);
    const { body: out } = await this.idem.run(req.userId!, "appointments", key,
      () => this.bookings.createAppointment(req.userId!, input));
    return out;
  }

  @Get("appointments")
  listAppointments(@Req() req: Request) { return this.bookings.listAppointments(req.userId!); }

  @Get("appointments/:id")
  getAppointment(@Req() req: Request, @Param("id") id: string) {
    return this.bookings.getAppointment(req.userId!, validate(Uuid, id));
  }

  @HttpCode(200)
  @Post("appointments/:id/cancel")
  cancelAppointment(@Req() req: Request, @Param("id") id: string) {
    return this.bookings.cancelAppointment(req.userId!, validate(Uuid, id));
  }

  /** Ops console surface — role-gated; not used by the member app. */
  @Roles("staff", "admin")
  @HttpCode(200)
  @Post("staff/appointments/:id/:decision")
  staffDecide(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("decision") decision: string,
    @Body() body: unknown,
  ) {
    const d = validate(z.enum(["confirm", "cancel"]), decision);
    return this.bookings.staffDecideAppointment(req.userId!, validate(Uuid, id), d, validate(StaffDecisionBody, body ?? {}));
  }

  @Post("transport-bookings")
  async createTransport(@Req() req: Request, @Body() body: unknown, @Headers("idempotency-key") key?: string) {
    const input = validate(CreateTransportBody, body);
    const { body: out } = await this.idem.run(req.userId!, "transport-bookings", key,
      () => this.bookings.createTransport(req.userId!, input));
    return out;
  }

  @Get("transport-bookings")
  listTransport(@Req() req: Request) { return this.bookings.listTransport(req.userId!); }

  @Get("transport-bookings/:id")
  getTransport(@Req() req: Request, @Param("id") id: string) {
    return this.bookings.getTransport(req.userId!, validate(Uuid, id));
  }

  @Get("activities")
  listActivities(@Req() req: Request, @Query() query: unknown) {
    const q = validate(ActivityQ, query);
    return this.activities.list(req.userId!, q);
  }
}

apiRoute({ method: "post", path: "/v1/appointments", tag: "bookings", summary: "Request an appointment (Idempotency-Key honoured)", auth: true, body: CreateAppointmentBody });
apiRoute({ method: "get", path: "/v1/appointments", tag: "bookings", summary: "My appointment requests", auth: true });
apiRoute({ method: "get", path: "/v1/appointments/{id}", tag: "bookings", summary: "Appointment detail", auth: true });
apiRoute({ method: "post", path: "/v1/appointments/{id}/cancel", tag: "bookings", summary: "Cancel while pending", auth: true, status: 200 });
apiRoute({ method: "post", path: "/v1/staff/appointments/{id}/{decision}", tag: "staff", summary: "Confirm or cancel a request (staff/admin)", auth: true, body: StaffDecisionBody, status: 200 });
apiRoute({ method: "post", path: "/v1/transport-bookings", tag: "bookings", summary: "Request medical transport (Idempotency-Key honoured)", auth: true, body: CreateTransportBody });
apiRoute({ method: "get", path: "/v1/transport-bookings", tag: "bookings", summary: "My transport bookings", auth: true });
apiRoute({ method: "get", path: "/v1/transport-bookings/{id}", tag: "bookings", summary: "Transport detail", auth: true });
apiRoute({ method: "get", path: "/v1/activities", tag: "bookings", summary: "Activity feed (keyset paginated, filterable)", auth: true, query: ActivityQ });
