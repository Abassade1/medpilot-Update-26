import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { validate } from "../../common/validate";
import { apiRoute } from "../../docs/registry";
import { IdempotencyService } from "../bookings/idempotency";
import { ServicesService } from "./services.service";
import { PetRequestBody, SpecialistListQuery, SpecialistRequestBody } from "./services.schemas";

const Uuid = z.string().uuid();

@Controller("v1")
export class ServicesController {
  constructor(private readonly services: ServicesService, private readonly idem: IdempotencyService) {}

  @Get("pet-clinics/:id")
  petClinic(@Param("id") id: string) { return this.services.petClinicDetail(validate(Uuid, id)); }

  @Post("pet-clinics/:id/requests")
  async petRequest(@Req() req: Request, @Param("id") id: string, @Body() body: unknown, @Headers("idempotency-key") key?: string) {
    const clinicId = validate(Uuid, id);
    const input = validate(PetRequestBody, body);
    const { body: out } = await this.idem.run(req.userId!, `pet-requests:${clinicId}`, key,
      () => this.services.createPetRequest(req.userId!, clinicId, input));
    return out;
  }

  @Get("independent-specialist-categories")
  categories() { return this.services.listSpecialistCategories(); }

  @Get("independent-specialists")
  specialists(@Query() q: unknown) { return this.services.listSpecialists(validate(SpecialistListQuery, q)); }

  @Get("independent-specialists/:id")
  specialist(@Param("id") id: string) { return this.services.specialistDetail(validate(Uuid, id)); }

  @Post("independent-specialists/:id/requests")
  async specialistRequest(@Req() req: Request, @Param("id") id: string, @Body() body: unknown, @Headers("idempotency-key") key?: string) {
    const specialistId = validate(Uuid, id);
    const input = validate(SpecialistRequestBody, body);
    const { body: out } = await this.idem.run(req.userId!, `specialist-requests:${specialistId}`, key,
      () => this.services.createSpecialistRequest(req.userId!, specialistId, input));
    return out;
  }

  @Get("service-requests")
  requests(@Req() req: Request) { return this.services.listRequests(req.userId!); }

  @Get("service-requests/:id")
  request(@Req() req: Request, @Param("id") id: string) { return this.services.getRequest(req.userId!, validate(Uuid, id)); }

  @HttpCode(200)
  @Post("service-requests/:id/cancel")
  cancel(@Req() req: Request, @Param("id") id: string) { return this.services.cancelRequest(req.userId!, validate(Uuid, id)); }
}

apiRoute({ method: "get", path: "/v1/pet-clinics/{id}", tag: "catalog", summary: "Pet clinic detail with the services it offers", auth: true });
apiRoute({ method: "post", path: "/v1/pet-clinics/{id}/requests", tag: "bookings", summary: "Book a pet appointment or request pet sitting", auth: true, body: PetRequestBody });
apiRoute({ method: "get", path: "/v1/independent-specialist-categories", tag: "catalog", summary: "Independent specialist categories", auth: true });
apiRoute({ method: "get", path: "/v1/independent-specialists", tag: "catalog", summary: "Browse independent specialists", auth: true, query: SpecialistListQuery });
apiRoute({ method: "get", path: "/v1/independent-specialists/{id}", tag: "catalog", summary: "Specialist profile with services", auth: true });
apiRoute({ method: "post", path: "/v1/independent-specialists/{id}/requests", tag: "bookings", summary: "Book a specialist or send a connection request", auth: true, body: SpecialistRequestBody });
apiRoute({ method: "get", path: "/v1/service-requests", tag: "bookings", summary: "My pet and specialist requests", auth: true });
apiRoute({ method: "get", path: "/v1/service-requests/{id}", tag: "bookings", summary: "One request", auth: true });
apiRoute({ method: "post", path: "/v1/service-requests/{id}/cancel", tag: "bookings", summary: "Cancel a request", auth: true, status: 200 });
