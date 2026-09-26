import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { uuidv7 } from "uuidv7";
import { z } from "zod";
import type { Db } from "../../db/client";
import { schema as s } from "../../db/client";
import { AppError } from "../../common/errors";
import { containsPattern } from "../../common/like";
import { AuditService } from "../auth/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { PetRequestBody, SpecialistListQuery, SpecialistRequestBody } from "./services.schemas";
import { displayRating } from "../../common/rating";

const money = (amount: number | null, currency = "USD") =>
  amount == null ? null : `${currency === "USD" ? "$" : `${currency} `}${(amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const utcToday = () => new Date().toISOString().slice(0, 10);

const KIND_LABEL: Record<string, string> = {
  pet_appointment: "Pet appointment",
  pet_sitting: "Pet sitting",
  specialist_booking: "Specialist booking",
  specialist_connect: "Connection request",
  listing_booking: "Booking",
};

const ACTIVE = new Set(["pending", "confirmed"]);

@Injectable()
export class ServicesService {
  constructor(
    @Inject("DB") private readonly db: Db,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---- pet clinics -------------------------------------------------------------
  private serviceView = (x: { id: string; name: string; description: string; priceAmount: number | null; priceCurrency: string; durationLabel: string; kind?: string }) => ({
    id: x.id, name: x.name, description: x.description,
    priceLabel: money(x.priceAmount, x.priceCurrency), durationLabel: x.durationLabel,
    ...(x.kind ? { kind: x.kind as "appointment" | "sitting" } : {}),
  });

  async petClinicDetail(id: string) {
    const [c] = await this.db.select().from(s.petClinics)
      .where(and(eq(s.petClinics.id, id), eq(s.petClinics.status, "published"))).limit(1);
    if (!c) throw AppError.notFound("Provider");
    const services = await this.db.select().from(s.petServices)
      .where(and(eq(s.petServices.clinicId, id), eq(s.petServices.active, true)))
      .orderBy(asc(s.petServices.sortOrder));
    return {
      id: c.id, name: c.name, category: c.category, location: c.location, rating: displayRating(c.rating),
      verified: c.verified, description: c.description, openTo: c.openTo, logoEmoji: c.logoEmoji, heroAsset: c.heroAsset,
      priceFromLabel: money(c.priceFromAmount, c.priceFromCurrency),
      services: services.map(this.serviceView),
      canBookAppointment: services.some((x) => x.kind === "appointment"),
      canRequestSitting: services.some((x) => x.kind === "sitting"),
    };
  }

  // ---- independent specialists ---------------------------------------------------
  private specialistCard = (x: typeof s.independentSpecialists.$inferSelect, categoryTitle?: string) => ({
    id: x.id, name: x.name, role: x.role, rating: displayRating(x.rating), verified: x.verified,
    locationLabel: x.locationLabel, photoAsset: x.photoAsset, availabilityLabel: x.availabilityLabel,
    acceptingRequests: x.acceptingRequests, categoryId: x.categoryId, ...(categoryTitle ? { categoryTitle } : {}),
  });

  async listSpecialists(query: z.infer<typeof SpecialistListQuery>) {
    const conds = [eq(s.independentSpecialists.status, "published" as const)];
    if (query.categoryId) conds.push(eq(s.independentSpecialists.categoryId, query.categoryId));
    if (query.q) {
      const like = containsPattern(query.q);
      conds.push(or(ilike(s.independentSpecialists.name, like), ilike(s.independentSpecialists.role, like), ilike(s.independentSpecialists.locationLabel, like))!);
    }
    const rows = await this.db.select({ x: s.independentSpecialists, c: s.independentSpecialistCategories.title })
      .from(s.independentSpecialists)
      .innerJoin(s.independentSpecialistCategories, eq(s.independentSpecialistCategories.id, s.independentSpecialists.categoryId))
      .where(and(...conds)).orderBy(desc(s.independentSpecialists.rating), asc(s.independentSpecialists.name)).limit(50);
    return rows.map((r) => this.specialistCard(r.x, r.c));
  }

  async listSpecialistCategories() {
    const rows = await this.db.select().from(s.independentSpecialistCategories)
      .where(eq(s.independentSpecialistCategories.active, true)).orderBy(asc(s.independentSpecialistCategories.sortOrder));
    return rows.map((c) => ({ id: c.id, title: c.title, countLabel: c.countLabel, imageAsset: c.imageAsset }));
  }

  async specialistDetail(id: string) {
    const [row] = await this.db.select({ x: s.independentSpecialists, c: s.independentSpecialistCategories.title })
      .from(s.independentSpecialists)
      .innerJoin(s.independentSpecialistCategories, eq(s.independentSpecialistCategories.id, s.independentSpecialists.categoryId))
      .where(and(eq(s.independentSpecialists.id, id), eq(s.independentSpecialists.status, "published"))).limit(1);
    if (!row) throw AppError.notFound("Specialist");
    const services = await this.db.select().from(s.independentServices)
      .where(and(eq(s.independentServices.specialistId, id), eq(s.independentServices.active, true)))
      .orderBy(asc(s.independentServices.sortOrder));
    return {
      ...this.specialistCard(row.x, row.c),
      bio: row.x.bio, languages: row.x.languages, yearsExperience: row.x.yearsExperience,
      services: services.map(this.serviceView),
    };
  }

  // ---- requests -----------------------------------------------------------------
  private reference(): string {
    return `SR${String(new Date().getUTCFullYear()).slice(-2)}-${randomInt(1000, 9999)}-${randomInt(100, 999)}`;
  }

  private async insertRequest(values: Omit<typeof s.serviceRequests.$inferInsert, "id" | "reference">) {
    const id = uuidv7();
    // The reference is short and human-readable, so a collision is possible; retry a few times.
    for (let attempt = 0; ; attempt += 1) {
      try {
        await this.db.insert(s.serviceRequests).values({ ...values, id, reference: this.reference() });
        return id;
      } catch (e) {
        if (attempt >= 3 || !/service_requests_reference_uq/.test((e as Error).message)) throw e;
      }
    }
  }

  async createPetRequest(userId: string, clinicId: string, input: z.infer<typeof PetRequestBody>) {
    const [clinic] = await this.db.select().from(s.petClinics)
      .where(and(eq(s.petClinics.id, clinicId), eq(s.petClinics.status, "published"))).limit(1);
    if (!clinic) throw AppError.notFound("Provider");

    const [svc] = await this.db.select().from(s.petServices)
      .where(and(eq(s.petServices.id, input.serviceId), eq(s.petServices.clinicId, clinicId), eq(s.petServices.active, true))).limit(1);
    if (!svc) {
      throw new AppError("validation_failed", "That service isn't offered by this provider", {
        fields: { serviceId: "That service isn't offered by this provider" },
      });
    }
    if (svc.kind !== input.kind) {
      const msg = svc.kind === "sitting" ? "That is a sitting service. Request it as pet sitting." : "That is an appointment service. Book it as an appointment.";
      throw new AppError("validation_failed", msg, { fields: { serviceId: msg } });
    }

    const id = await this.insertRequest({
      userId, kind: input.kind === "sitting" ? "pet_sitting" : "pet_appointment",
      targetType: "pet_clinic", targetId: clinic.id, serviceId: svc.id,
      preferredDate: input.preferredDate, preferredTime: input.preferredTime ?? null,
      endDate: input.kind === "sitting" ? input.endDate ?? input.preferredDate : null,
      message: input.message?.trim() || null,
      details: JSON.stringify({ petName: input.petName, petType: input.petType }),
    });
    await this.afterCreate(userId, id, clinic.name, `${svc.name} · ${input.preferredDate}`);
    return this.getRequest(userId, id);
  }

  async createSpecialistRequest(userId: string, specialistId: string, input: z.infer<typeof SpecialistRequestBody>) {
    const [sp] = await this.db.select().from(s.independentSpecialists)
      .where(and(eq(s.independentSpecialists.id, specialistId), eq(s.independentSpecialists.status, "published"))).limit(1);
    if (!sp) throw AppError.notFound("Specialist");
    if (!sp.acceptingRequests) {
      throw new AppError("validation_failed", "This specialist isn't accepting new requests right now", {
        fields: { _: "This specialist isn't accepting new requests right now" },
      });
    }

    let svcName: string | null = null;
    let serviceId: string | null = null;
    if (input.serviceId) {
      const [svc] = await this.db.select().from(s.independentServices)
        .where(and(eq(s.independentServices.id, input.serviceId), eq(s.independentServices.specialistId, sp.id), eq(s.independentServices.active, true))).limit(1);
      if (!svc) {
        throw new AppError("validation_failed", "That service isn't offered by this specialist", {
          fields: { serviceId: "That service isn't offered by this specialist" },
        });
      }
      svcName = svc.name; serviceId = svc.id;
    }

    const id = await this.insertRequest({
      userId, kind: input.kind === "booking" ? "specialist_booking" : "specialist_connect",
      targetType: "independent_specialist", targetId: sp.id, serviceId,
      preferredDate: input.preferredDate ?? null, preferredTime: input.preferredTime ?? null,
      message: input.message?.trim() || null, details: null,
    });
    await this.afterCreate(userId, id, sp.name, input.kind === "booking" ? `${svcName} · ${input.preferredDate}` : "Connection request sent");
    return this.getRequest(userId, id);
  }

  private async afterCreate(userId: string, id: string, targetName: string, subtitle: string) {
    await this.db.insert(s.activities).values({
      id: uuidv7(), userId, type: "service", title: targetName, subtitle,
      status: "pending", targetType: "service_request", targetId: id,
    });
    await this.notifications.notify(userId, {
      type: "service.requested", title: "Request received",
      body: "Your request has been sent. You'll be notified when the provider responds.",
      deepLink: `medpilot://requests/${id}`,
    });
    await this.audit.write({ actorUserId: userId, action: "service.request_created", resourceType: "service_request", resourceId: id });
  }

  /** Resolves display details for a batch of requests in three queries, not 1+N. */
  private async views(rows: (typeof s.serviceRequests.$inferSelect)[]) {
    const clinicIds = rows.filter((r) => r.targetType === "pet_clinic").map((r) => r.targetId);
    const specIds = rows.filter((r) => r.targetType === "independent_specialist").map((r) => r.targetId);
    const clinics = clinicIds.length ? await this.db.select().from(s.petClinics).where(inArray(s.petClinics.id, clinicIds)) : [];
    const specs = specIds.length ? await this.db.select().from(s.independentSpecialists).where(inArray(s.independentSpecialists.id, specIds)) : [];
    const petSvc = clinicIds.length ? await this.db.select().from(s.petServices).where(inArray(s.petServices.clinicId, clinicIds)) : [];
    const listingIds = rows.filter((r) => r.targetType === "listing").map((r) => r.targetId);
    const listingRows = listingIds.length
      ? await this.db.select({ l: s.listings, p: s.providers }).from(s.listings).innerJoin(s.providers, eq(s.providers.id, s.listings.providerId)).where(inArray(s.listings.id, listingIds))
      : [];
    const indSvc = specIds.length ? await this.db.select().from(s.independentServices).where(inArray(s.independentServices.specialistId, specIds)) : [];
    const reviewableIds = rows.filter((r) => r.targetType !== "listing").map((r) => r.id);
    const reviewedRows = reviewableIds.length
      ? await this.db.select({ id: s.reviews.requestId }).from(s.reviews)
        .where(and(eq(s.reviews.requestType, "service_request"), inArray(s.reviews.requestId, reviewableIds)))
      : [];
    const reviewed = new Set(reviewedRows.map((x) => x.id));
    const today = utcToday();

    return rows.map((r) => {
      if (r.targetType === "listing") {
        const row = listingRows.find((x) => x.l.id === r.targetId);
        const d = r.details ? (JSON.parse(r.details) as { priceAmount?: number | null; priceCurrency?: string }) : {};
        return {
          id: r.id, reference: `#${r.reference}`, kind: r.kind, kindLabel: KIND_LABEL[r.kind] ?? r.kind,
          status: r.status as "pending" | "confirmed" | "cancelled" | "completed",
          target: {
            type: "listing" as const, id: r.targetId, name: row?.p.name ?? "Provider", subtitle: [row?.p.city, row?.p.country].filter(Boolean).join(", "),
            photoAsset: null, emoji: null,
          },
          service: { id: r.targetId, name: row?.l.name ?? "Service", priceLabel: money(d.priceAmount ?? null, d.priceCurrency ?? "USD") },
          preferredDate: r.preferredDate, endDate: r.endDate, preferredTime: r.preferredTime, message: r.message,
          details: null as { petName?: string; petType?: string } | null,
          // Vendor-marketplace bookings don't feed the catalog ratings system.
          canCancel: ACTIVE.has(r.status), canReview: false, reviewed: false, cancelledReason: r.cancelledReason, createdAt: r.createdAt,
        };
      }
      const isPet = r.targetType === "pet_clinic";
      const clinic = isPet ? clinics.find((c) => c.id === r.targetId) : undefined;
      const spec = !isPet ? specs.find((x) => x.id === r.targetId) : undefined;
      const svc = r.serviceId ? (isPet ? petSvc : indSvc).find((x) => x.id === r.serviceId) : undefined;
      return {
        id: r.id, reference: `#${r.reference}`, kind: r.kind, kindLabel: KIND_LABEL[r.kind] ?? r.kind,
        status: r.status as "pending" | "confirmed" | "cancelled" | "completed",
        target: {
          type: r.targetType as "pet_clinic" | "independent_specialist", id: r.targetId,
          name: clinic?.name ?? spec?.name ?? "Provider",
          subtitle: clinic?.location ?? spec?.role ?? "",
          photoAsset: spec?.photoAsset ?? clinic?.heroAsset ?? null, emoji: clinic?.logoEmoji ?? null,
        },
        service: svc ? { id: svc.id, name: svc.name, priceLabel: money(svc.priceAmount, svc.priceCurrency) } : null,
        preferredDate: r.preferredDate, endDate: r.endDate, preferredTime: r.preferredTime,
        message: r.message,
        details: r.details ? (JSON.parse(r.details) as { petName?: string; petType?: string }) : null,
        canCancel: ACTIVE.has(r.status),
        canReview: r.status === "completed" || (r.status === "confirmed" && !!r.preferredDate && r.preferredDate < today),
        reviewed: reviewed.has(r.id),
        cancelledReason: r.cancelledReason, createdAt: r.createdAt,
      };
    });
  }

  async listRequests(userId: string) {
    const rows = await this.db.select().from(s.serviceRequests)
      .where(and(eq(s.serviceRequests.userId, userId), isNull(s.serviceRequests.deletedAt)))
      .orderBy(desc(s.serviceRequests.createdAt)).limit(50);
    return this.views(rows);
  }

  async getRequest(userId: string, id: string) {
    const [r] = await this.db.select().from(s.serviceRequests)
      .where(and(eq(s.serviceRequests.id, id), isNull(s.serviceRequests.deletedAt))).limit(1);
    if (!r || r.userId !== userId) throw AppError.notFound("Request");
    return (await this.views([r]))[0]!;
  }

  async cancelRequest(userId: string, id: string) {
    const [r] = await this.db.select().from(s.serviceRequests)
      .where(and(eq(s.serviceRequests.id, id), isNull(s.serviceRequests.deletedAt))).limit(1);
    if (!r || r.userId !== userId) throw AppError.notFound("Request");
    if (!ACTIVE.has(r.status)) {
      throw new AppError("conflict", r.status === "cancelled" ? "This request has already been cancelled." : "A completed request can't be cancelled.");
    }
    await this.db.update(s.serviceRequests)
      .set({ status: "cancelled", cancelledReason: "Cancelled by member", updatedAt: new Date() })
      .where(eq(s.serviceRequests.id, id));
    await this.db.insert(s.activities).values({
      id: uuidv7(), userId, type: "service", title: "Request cancelled",
      subtitle: `Reference #${r.reference}`, status: "cancelled", targetType: "service_request", targetId: id,
    });
    if (r.providerId) {
      // A member cancelling a provider booking must reach the provider.
      const [p] = await this.db.select().from(s.providers).where(eq(s.providers.id, r.providerId)).limit(1);
      if (p) {
        await this.notifications.notify(p.ownerUserId, {
          type: "provider.booking_cancelled", title: "Booking cancelled",
          body: `A customer cancelled their booking for ${r.preferredDate}.`, deepLink: `medpilot://provider/bookings/${id}`,
        });
      }
    }
    await this.audit.write({ actorUserId: userId, action: "service.request_cancelled", resourceType: "service_request", resourceId: id });
    return this.getRequest(userId, id);
  }

  /** Operations decision on a pet / specialist request. */
  async staffDecideRequest(staffId: string, id: string, decision: "confirm" | "cancel", reason?: string) {
    const [r] = await this.db.select().from(s.serviceRequests)
      .where(and(eq(s.serviceRequests.id, id), isNull(s.serviceRequests.deletedAt))).limit(1);
    if (!r) throw AppError.notFound("Request");
    if (r.status !== "pending") throw new AppError("conflict", "This request has already been decided");
    await this.db.update(s.serviceRequests).set(
      decision === "confirm"
        ? { status: "confirmed", updatedAt: new Date() }
        : { status: "cancelled", cancelledReason: reason ?? "Declined by the provider", updatedAt: new Date() },
    ).where(eq(s.serviceRequests.id, id));
    await this.notifications.notify(r.userId, {
      type: decision === "confirm" ? "service.confirmed" : "service.cancelled",
      title: decision === "confirm" ? "Request confirmed" : "Request update",
      body: decision === "confirm"
        ? "The provider has confirmed your request. Open the app for the details."
        : "The provider couldn't take your request. Open the app for details.",
      deepLink: `medpilot://requests/${id}`,
    });
    await this.db.insert(s.activities).values({
      id: uuidv7(), userId: r.userId, type: "service",
      title: decision === "confirm" ? "Request confirmed" : "Request cancelled",
      subtitle: `Reference #${r.reference}`, status: decision === "confirm" ? "booked" : "cancelled",
      targetType: "service_request", targetId: id,
    });
    await this.audit.write({ actorUserId: staffId, actorType: "staff", action: `service.request_${decision}`, resourceType: "service_request", resourceId: id });
    return this.getRequest(r.userId, id);
  }
}
