import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { uuidv7 } from "uuidv7";
import { z } from "zod";
import type { Db } from "../../db/client";
import { schema as s } from "../../db/client";
import { AppError } from "../../common/errors";
import { AuditService } from "../auth/audit.service";
import { QuotaService } from "../billing/quota.service";
import { NotificationsService } from "../notifications/notifications.service";
import { UsersService } from "../users/users.service";
import { LocationsService } from "../locations/locations.service";
import type { CreateAppointmentBody, CreateTransportBody, RescheduleAppointmentBody, StaffDecisionBody } from "./bookings.schemas";

const utcToday = () => new Date().toISOString().slice(0, 10);

const TYPE_LABEL: Record<string, string> = {
  general_checkup: "Check-up",
  specialist_consultation: "Specialist Consultation",
  surgery: "Surgery",
};

@Injectable()
export class BookingsService {
  constructor(
    @Inject("DB") private readonly db: Db,
    private readonly quota: QuotaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
    private readonly locations: LocationsService,
  ) {}

  /** User-facing reference in the format the UI shows: CA25-3198-324. */
  private reference(): string {
    const yy = String(new Date().getUTCFullYear()).slice(-2);
    return `CA${yy}-${randomInt(1000, 9999)}-${randomInt(100, 999)}`;
  }

  // ---- appointments --------------------------------------------------------
  async createAppointment(userId: string, input: z.infer<typeof CreateAppointmentBody>) {
    const [hospital] = await this.db.select().from(s.hospitals)
      .where(and(eq(s.hospitals.id, input.hospitalId), eq(s.hospitals.status, "published"))).limit(1);
    if (!hospital) throw AppError.notFound("Hospital");
    if (!hospital.bookable) {
      throw new AppError("validation_failed", "This hospital isn't accepting bookings right now");
    }
    if (input.packageId) {
      const [pkg] = await this.db.select().from(s.medicalPackages)
        .where(and(eq(s.medicalPackages.id, input.packageId), eq(s.medicalPackages.status, "published"))).limit(1);
      if (!pkg) throw AppError.notFound("Package");
      if (pkg.hospitalId !== hospital.id) {
        throw new AppError("validation_failed", "That package doesn't belong to this hospital");
      }
    }

    await this.quota.consume(userId, "clinic_access");
    try {
      const contact = await this.users.upsertContact(userId, input.emergencyContact);
      const id = uuidv7();
      const reference = this.reference();
      await this.db.transaction(async (tx) => {
        await tx.insert(s.appointmentRequests).values({
          id, reference, userId,
          hospitalId: hospital.id, packageId: input.packageId ?? null,
          appointmentType: input.appointmentType,
          requestedDate: input.requestedDate,
          requestedTime: input.requestedTime ?? null,
          underTreatment: input.underTreatment,
          conditionNote: input.conditionNote?.trim() || null,
          emergencyContactId: contact.id,
          contactAccompanies: input.emergencyContact.accompanies,
        });
        await tx.insert(s.activities).values({
          id: uuidv7(), userId, type: "appointment",
          title: hospital.name,
          subtitle: `${TYPE_LABEL[input.appointmentType]} · requested for ${input.requestedDate}`,
          status: "pending", targetType: "appointment", targetId: id,
        });
      });
      await this.notifications.notify(userId, {
        type: "appointment.requested",
        title: "Request received",
        body: "Your appointment request is in. A representative will be in contact shortly.",
        deepLink: `medpilot://appointments/${id}`,
      });
      await this.audit.write({ actorUserId: userId, action: "booking.appointment_created", resourceType: "appointment", resourceId: id });
      return this.getAppointment(userId, id);
    } catch (e) {
      await this.quota.refund(userId, "clinic_access");
      throw e;
    }
  }

  /** Members may change or cancel an appointment until it is finished or already cancelled. */
  private static ACTIVE = new Set(["pending", "confirmed"]);

  private appointmentView = (
    a: typeof s.appointmentRequests.$inferSelect,
    h: typeof s.hospitals.$inferSelect,
    c?: typeof s.emergencyContacts.$inferSelect | null,
    reviewed = false,
  ) => ({
    id: a.id,
    reference: `#${a.reference}`,
    status: a.status,
    appointmentType: a.appointmentType,
    appointmentTypeLabel: TYPE_LABEL[a.appointmentType] ?? a.appointmentType,
    requestedDate: a.requestedDate,
    requestedTime: a.requestedTime,
    scheduledAt: a.scheduledAt,
    hospital: {
      id: h.id, name: h.name, logoAsset: h.logoAsset,
      location: h.city ? `${h.city}, ${h.countryLabel}` : h.countryLabel,
    },
    contactPerson: a.assignedStaffName
      ? { name: a.assignedStaffName, role: a.assignedStaffRole ?? "Consultant", photoAsset: "doctor1" }
      : null,
    underTreatment: a.underTreatment,
    conditionNote: a.conditionNote,
    emergencyContact: c
      ? { name: `${c.firstName} ${c.lastName}`, phone: c.phoneE164, relationship: c.relationship, accompanies: a.contactAccompanies }
      : null,
    cancelledReason: a.cancelledReason,
    // The server decides what is allowed, so the app never has to guess.
    canReschedule: BookingsService.ACTIVE.has(a.status),
    canCancel: BookingsService.ACTIVE.has(a.status),
    canReview: a.status === "completed" || (a.status === "confirmed" && a.requestedDate < utcToday()),
    reviewed,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  });

  private async reviewedIds(requestType: string, ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const rows = await this.db.select({ id: s.reviews.requestId }).from(s.reviews)
      .where(and(eq(s.reviews.requestType, requestType), inArray(s.reviews.requestId, ids)));
    return new Set(rows.map((r) => r.id));
  }

  async listAppointments(userId: string) {
    const rows = await this.db.select({ a: s.appointmentRequests, h: s.hospitals, c: s.emergencyContacts })
      .from(s.appointmentRequests)
      .innerJoin(s.hospitals, eq(s.hospitals.id, s.appointmentRequests.hospitalId))
      .leftJoin(s.emergencyContacts, eq(s.emergencyContacts.id, s.appointmentRequests.emergencyContactId))
      .where(and(eq(s.appointmentRequests.userId, userId), isNull(s.appointmentRequests.deletedAt)))
      .orderBy(desc(s.appointmentRequests.createdAt)).limit(50);
    const reviewed = await this.reviewedIds("appointment", rows.map((r) => r.a.id));
    return rows.map(({ a, h, c }) => this.appointmentView(a, h, c, reviewed.has(a.id)));
  }

  async getAppointment(userId: string, id: string) {
    const [row] = await this.db.select({ a: s.appointmentRequests, h: s.hospitals, c: s.emergencyContacts })
      .from(s.appointmentRequests)
      .innerJoin(s.hospitals, eq(s.hospitals.id, s.appointmentRequests.hospitalId))
      .leftJoin(s.emergencyContacts, eq(s.emergencyContacts.id, s.appointmentRequests.emergencyContactId))
      .where(and(eq(s.appointmentRequests.id, id), isNull(s.appointmentRequests.deletedAt))).limit(1);
    if (!row || row.a.userId !== userId) throw AppError.notFound("Appointment");
    const reviewed = await this.reviewedIds("appointment", [id]);
    return this.appointmentView(row.a, row.h, row.c, reviewed.has(id));
  }

  /**
   * Members may cancel while an appointment is pending or confirmed. Completed
   * and already-cancelled appointments are history and cannot be changed.
   */
  async cancelAppointment(userId: string, id: string) {
    const [a] = await this.db.select().from(s.appointmentRequests)
      .where(and(eq(s.appointmentRequests.id, id), isNull(s.appointmentRequests.deletedAt))).limit(1);
    if (!a || a.userId !== userId) throw AppError.notFound("Appointment");
    if (!BookingsService.ACTIVE.has(a.status)) {
      throw new AppError("conflict", a.status === "cancelled"
        ? "This appointment has already been cancelled."
        : "A completed appointment can't be cancelled.");
    }
    await this.db.update(s.appointmentRequests)
      .set({ status: "cancelled", cancelledReason: "Cancelled by member", updatedAt: new Date() })
      .where(eq(s.appointmentRequests.id, id));
    await this.db.insert(s.activities).values({
      id: uuidv7(), userId, type: "appointment", title: "Appointment cancelled",
      subtitle: `Reference #${a.reference}`, status: "cancelled",
      targetType: "appointment", targetId: id,
    });
    await this.quota.refund(userId, "clinic_access", a.createdAt);
    await this.audit.write({ actorUserId: userId, action: "booking.appointment_cancelled", resourceType: "appointment", resourceId: id });
    return this.getAppointment(userId, id);
  }

  /**
   * Changes the date, time or type of an active appointment.
   *
   * A confirmed appointment that moves is no longer confirmed: the hospital
   * agreed to a specific slot, so it returns to "pending" for re-confirmation
   * and the previously scheduled time is cleared. Re-sending the same values is
   * a no-op, so a retry after a dropped connection changes nothing.
   */
  async rescheduleAppointment(userId: string, id: string, input: z.infer<typeof RescheduleAppointmentBody>) {
    const [a] = await this.db.select().from(s.appointmentRequests)
      .where(and(eq(s.appointmentRequests.id, id), isNull(s.appointmentRequests.deletedAt))).limit(1);
    if (!a || a.userId !== userId) throw AppError.notFound("Appointment");
    if (!BookingsService.ACTIVE.has(a.status)) {
      throw new AppError("conflict", a.status === "cancelled"
        ? "A cancelled appointment can't be changed. Book a new one instead."
        : "A completed appointment can't be changed.");
    }

    const next = {
      requestedDate: input.requestedDate ?? a.requestedDate,
      requestedTime: input.requestedTime === undefined ? a.requestedTime : input.requestedTime,
      appointmentType: input.appointmentType ?? a.appointmentType,
    };
    const unchanged =
      next.requestedDate === a.requestedDate &&
      next.requestedTime === a.requestedTime &&
      next.appointmentType === a.appointmentType;
    if (unchanged) return this.getAppointment(userId, id);

    const wasConfirmed = a.status === "confirmed";
    await this.db.update(s.appointmentRequests).set({
      ...next,
      ...(wasConfirmed ? { status: "pending" as const, scheduledAt: null } : {}),
      updatedAt: new Date(),
    }).where(eq(s.appointmentRequests.id, id));

    const [h] = await this.db.select().from(s.hospitals).where(eq(s.hospitals.id, a.hospitalId)).limit(1);
    await this.db.insert(s.activities).values({
      id: uuidv7(), userId, type: "appointment", title: h?.name ?? "Appointment updated",
      subtitle: `Rescheduled to ${next.requestedDate}${next.requestedTime ? ` at ${next.requestedTime}` : ""}`,
      status: "pending", targetType: "appointment", targetId: id,
    });
    await this.notifications.notify(userId, {
      type: "appointment.rescheduled",
      title: "Change received",
      body: wasConfirmed
        ? "Your new time has been sent for confirmation. Your previous slot is released."
        : "Your appointment request has been updated.",
      deepLink: `medpilot://appointments/${id}`,
    });
    await this.audit.write({ actorUserId: userId, action: "booking.appointment_rescheduled", resourceType: "appointment", resourceId: id });
    return this.getAppointment(userId, id);
  }

  /** Staff-only transition; drives the "Contact Person" the member sees. */
  async staffDecideAppointment(staffId: string, id: string, decision: "confirm" | "cancel", input: z.infer<typeof StaffDecisionBody>) {
    const [a] = await this.db.select().from(s.appointmentRequests)
      .where(and(eq(s.appointmentRequests.id, id), isNull(s.appointmentRequests.deletedAt))).limit(1);
    if (!a) throw AppError.notFound("Appointment");
    if (a.status !== "pending") throw new AppError("conflict", "This request has already been decided");

    if (decision === "confirm") {
      await this.db.update(s.appointmentRequests).set({
        status: "confirmed",
        assignedStaffName: input.staffName ?? "MedPilot Concierge",
        assignedStaffRole: input.staffRole ?? "Specialist Consultant",
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        updatedAt: new Date(),
      }).where(eq(s.appointmentRequests.id, id));
      await this.notifications.notify(a.userId, {
        type: "appointment.confirmed", title: "Appointment confirmed",
        body: "Your appointment has been confirmed. Open the app for details.",
        deepLink: `medpilot://appointments/${id}`, email: true,
      });
    } else {
      await this.db.update(s.appointmentRequests).set({
        status: "cancelled", cancelledReason: input.reason ?? "Declined by operations", updatedAt: new Date(),
      }).where(eq(s.appointmentRequests.id, id));
      await this.quota.refund(a.userId, "clinic_access", a.createdAt);
      await this.notifications.notify(a.userId, {
        type: "appointment.cancelled", title: "Appointment update",
        body: "We couldn't confirm your appointment request. Open the app for details.",
        deepLink: `medpilot://appointments/${id}`, email: true,
      });
    }
    await this.db.insert(s.activities).values({
      id: uuidv7(), userId: a.userId, type: "appointment",
      title: decision === "confirm" ? "Appointment confirmed" : "Appointment cancelled",
      subtitle: `Reference #${a.reference}`,
      status: decision === "confirm" ? "booked" : "cancelled",
      targetType: "appointment", targetId: id,
    });
    await this.audit.write({ actorUserId: staffId, actorType: "staff", action: `booking.appointment_${decision}`, resourceType: "appointment", resourceId: id });
    const [row] = await this.db.select({ a: s.appointmentRequests, h: s.hospitals })
      .from(s.appointmentRequests)
      .innerJoin(s.hospitals, eq(s.hospitals.id, s.appointmentRequests.hospitalId))
      .where(eq(s.appointmentRequests.id, id)).limit(1);
    return this.appointmentView(row!.a, row!.h);
  }

  // ---- transport -----------------------------------------------------------
  async createTransport(userId: string, input: z.infer<typeof CreateTransportBody>) {
    const [provider] = await this.db.select().from(s.transportProviders)
      .where(and(eq(s.transportProviders.id, input.providerId), eq(s.transportProviders.status, "published"))).limit(1);
    if (!provider) throw AppError.notFound("Provider");

    if (input.aircraftId) {
      const [craft] = await this.db.select().from(s.aircraft).where(eq(s.aircraft.id, input.aircraftId)).limit(1);
      // cross-tenant guard: the aircraft must belong to the chosen operator
      if (!craft || !craft.active || craft.providerId !== provider.id) {
        throw new AppError("validation_failed", "That aircraft isn't available from this provider");
      }
    }
    if (input.purposeIds.length) {
      const known = await this.db.select().from(s.transportPurposes).where(eq(s.transportPurposes.active, true));
      const ok = new Set(known.map((k) => k.id));
      if (!input.purposeIds.every((p) => ok.has(p))) throw new AppError("validation_failed", "Unknown purpose selected");
    }
    if (input.needIds.length) {
      const known = await this.db.select().from(s.specialNeeds).where(eq(s.specialNeeds.active, true));
      const ok = new Set(known.map((k) => k.id));
      if (!input.needIds.every((n) => ok.has(n))) throw new AppError("validation_failed", "Unknown special need selected");
    }

    // The provider must actually be able to reach the pickup point. The app only offers such
    // providers, but the API is the authority: a stale or hand-built request is refused here.
    const pickupMatch = await this.locations.resolve({
      country: input.pickupCountry, region: input.pickupRegion ?? undefined, city: input.pickupCity ?? undefined,
    });
    const pickupNode = pickupMatch.city ?? pickupMatch.region ?? pickupMatch.country;
    if (!pickupMatch.matched || !pickupNode) {
      throw new AppError("validation_failed", "We don't operate at that pickup location", { fields: { pickupCountry: "We don't operate at that pickup location" } });
    }
    const avail = await this.locations.availability(pickupNode.id);
    if (!avail.services.some((sv) => sv.providers.some((pr) => pr.id === provider.id))) {
      throw new AppError("validation_failed", `${provider.name} doesn't serve that pickup location`, { fields: { pickupCountry: `${provider.name} doesn't serve that pickup location` } });
    }

    await this.quota.consume(userId, "evacuation");
    try {
      const contact = await this.users.upsertContact(userId, input.emergencyContact);
      const id = uuidv7();
      const reference = this.reference();
      await this.db.transaction(async (tx) => {
        await tx.insert(s.transportRequests).values({
          id, reference, userId, providerId: provider.id, aircraftId: input.aircraftId ?? null,
          pickupDate: input.pickupDate, pickupTime: input.pickupTime ?? null,
          pickupCountry: input.pickupCountry, pickupRegion: input.pickupRegion ?? null,
          pickupCity: input.pickupCity ?? null, pickupAddress: input.pickupAddress ?? null,
          pickupSiteType: input.pickupSiteType, pickupSiteCode: input.pickupSiteCode ?? null,
          pickupLat: input.pickupLat?.toString() ?? null, pickupLng: input.pickupLng?.toString() ?? null,
          dropoffCountry: input.dropoffCountry, dropoffRegion: input.dropoffRegion ?? null, dropoffCity: input.dropoffCity ?? null,
          dropoffSiteType: input.dropoffSiteType, dropoffSiteCode: input.dropoffSiteCode ?? null,
          returnTrip: input.returnTrip,
          otherPurpose: input.otherPurpose?.trim() || null,
          otherNeed: input.otherNeed?.trim() || null,
          emergencyContactId: contact.id,
          contactAccompanies: input.emergencyContact.accompanies,
        });
        if (input.purposeIds.length) {
          await tx.insert(s.transportRequestPurposes).values(input.purposeIds.map((purposeId) => ({ requestId: id, purposeId })));
        }
        if (input.needIds.length) {
          await tx.insert(s.transportRequestNeeds).values(input.needIds.map((needId) => ({ requestId: id, needId })));
        }
        await tx.insert(s.activities).values({
          id: uuidv7(), userId, type: "transport",
          title: provider.name,
          subtitle: `${input.pickupCountry} → ${input.dropoffCountry} · ${input.pickupDate}`,
          status: "pending", targetType: "transport", targetId: id,
        });
      });
      // medevac dispatch is time-critical: ops channel first (spec §13)
      await this.notifications.notify(userId, {
        type: "transport.requested", title: "Transport request received",
        body: "Our dispatch team has your request and will confirm shortly.",
        deepLink: `medpilot://transport/${id}`,
      });
      await this.audit.write({ actorUserId: userId, action: "booking.transport_created", resourceType: "transport", resourceId: id });
      return this.getTransport(userId, id);
    } catch (e) {
      await this.quota.refund(userId, "evacuation");
      throw e;
    }
  }

  private static TRANSPORT_ACTIVE = new Set(["pending", "confirmed"]);

  private async transportDetail(t: typeof s.transportRequests.$inferSelect, p: typeof s.transportProviders.$inferSelect) {
    const [purposes, needs, craft, contact] = await Promise.all([
      this.db.select({ label: s.transportPurposes.label }).from(s.transportRequestPurposes)
        .innerJoin(s.transportPurposes, eq(s.transportPurposes.id, s.transportRequestPurposes.purposeId))
        .where(eq(s.transportRequestPurposes.requestId, t.id)),
      this.db.select({ label: s.specialNeeds.label }).from(s.transportRequestNeeds)
        .innerJoin(s.specialNeeds, eq(s.specialNeeds.id, s.transportRequestNeeds.needId))
        .where(eq(s.transportRequestNeeds.requestId, t.id)),
      t.aircraftId ? this.db.select({ name: s.aircraft.name }).from(s.aircraft).where(eq(s.aircraft.id, t.aircraftId)).limit(1) : Promise.resolve([]),
      t.emergencyContactId ? this.db.select().from(s.emergencyContacts).where(eq(s.emergencyContacts.id, t.emergencyContactId)).limit(1) : Promise.resolve([]),
    ]);
    const c = contact[0];
    const reviewed = (await this.reviewedIds("transport", [t.id])).has(t.id);
    return {
      ...this.transportView(t, p, reviewed),
      purposes: [...purposes.map((x) => x.label), ...(t.otherPurpose ? [t.otherPurpose] : [])],
      needs: [...needs.map((x) => x.label), ...(t.otherNeed ? [t.otherNeed] : [])],
      aircraft: craft[0]?.name ?? null,
      emergencyContact: c ? { name: `${c.firstName} ${c.lastName}`, phone: c.phoneE164, relationship: c.relationship, accompanies: t.contactAccompanies } : null,
      canCancel: BookingsService.TRANSPORT_ACTIVE.has(t.status),
      cancelledReason: t.cancelledReason,
    };
  }

  private transportView = (
    t: typeof s.transportRequests.$inferSelect,
    p: typeof s.transportProviders.$inferSelect,
    reviewed = false,
  ) => ({
    id: t.id,
    reference: `#${t.reference}`,
    status: t.status,
    pickup: { country: t.pickupCountry, region: t.pickupRegion, city: t.pickupCity, address: t.pickupAddress, date: t.pickupDate, time: t.pickupTime, siteType: t.pickupSiteType, siteCode: t.pickupSiteCode },
    dropoff: { country: t.dropoffCountry, region: t.dropoffRegion, city: t.dropoffCity, siteType: t.dropoffSiteType, siteCode: t.dropoffSiteCode },
    returnTrip: t.returnTrip,
    flightNumber: t.flightNumber,
    departAt: t.departAt, arriveAt: t.arriveAt,
    provider: { id: p.id, name: p.name, logoAsset: p.logoAsset, tags: p.tags },
    canReview: t.status === "completed" || (t.status === "confirmed" && t.pickupDate < utcToday()),
    reviewed,
    createdAt: t.createdAt,
  });

  async listTransport(userId: string) {
    const rows = await this.db.select({ t: s.transportRequests, p: s.transportProviders })
      .from(s.transportRequests)
      .innerJoin(s.transportProviders, eq(s.transportProviders.id, s.transportRequests.providerId))
      .where(and(eq(s.transportRequests.userId, userId), isNull(s.transportRequests.deletedAt)))
      .orderBy(desc(s.transportRequests.createdAt)).limit(50);
    const reviewed = await this.reviewedIds("transport", rows.map((r) => r.t.id));
    return rows.map(({ t, p }) => ({ ...this.transportView(t, p, reviewed.has(t.id)), canCancel: BookingsService.TRANSPORT_ACTIVE.has(t.status) }));
  }

  private async loadTransport(id: string) {
    const [row] = await this.db.select({ t: s.transportRequests, p: s.transportProviders })
      .from(s.transportRequests)
      .innerJoin(s.transportProviders, eq(s.transportProviders.id, s.transportRequests.providerId))
      .where(and(eq(s.transportRequests.id, id), isNull(s.transportRequests.deletedAt))).limit(1);
    return row;
  }

  async getTransport(userId: string, id: string) {
    const row = await this.loadTransport(id);
    if (!row || row.t.userId !== userId) throw AppError.notFound("Transport booking");
    return this.transportDetail(row.t, row.p);
  }

  async cancelTransport(userId: string, id: string) {
    const row = await this.loadTransport(id);
    if (!row || row.t.userId !== userId) throw AppError.notFound("Transport booking");
    if (!BookingsService.TRANSPORT_ACTIVE.has(row.t.status)) {
      throw new AppError("conflict", row.t.status === "cancelled"
        ? "This transport request has already been cancelled."
        : "A transport that is under way or finished can't be cancelled here. Please contact your coordinator.");
    }
    await this.db.update(s.transportRequests)
      .set({ status: "cancelled", cancelledReason: "Cancelled by member", updatedAt: new Date() })
      .where(eq(s.transportRequests.id, id));
    await this.db.insert(s.activities).values({
      id: uuidv7(), userId, type: "transport", title: "Transport cancelled",
      subtitle: `Reference #${row.t.reference}`, status: "cancelled", targetType: "transport", targetId: id,
    });
    await this.quota.refund(userId, "evacuation", row.t.createdAt);
    await this.audit.write({ actorUserId: userId, action: "booking.transport_cancelled", resourceType: "transport", resourceId: id });
    return this.getTransport(userId, id);
  }

  async staffDecideTransport(staffId: string, id: string, decision: "confirm" | "cancel", input: z.infer<typeof StaffDecisionBody>) {
    const row = await this.loadTransport(id);
    if (!row) throw AppError.notFound("Transport booking");
    if (row.t.status !== "pending") throw new AppError("conflict", "This request has already been decided");
    if (decision === "confirm") {
      await this.db.update(s.transportRequests).set({
        status: "confirmed", flightNumber: input.flightNumber ?? null,
        departAt: input.scheduledAt ? new Date(input.scheduledAt) : null, updatedAt: new Date(),
      }).where(eq(s.transportRequests.id, id));
    } else {
      await this.db.update(s.transportRequests).set({
        status: "cancelled", cancelledReason: input.reason ?? "Declined by operations", updatedAt: new Date(),
      }).where(eq(s.transportRequests.id, id));
      await this.quota.refund(row.t.userId, "evacuation", row.t.createdAt);
    }
    await this.notifications.notify(row.t.userId, {
      type: decision === "confirm" ? "transport.confirmed" : "transport.cancelled",
      title: decision === "confirm" ? "Transport confirmed" : "Transport update",
      body: decision === "confirm"
        ? "Your medical transport has been confirmed. Open the app for the details."
        : "We couldn't confirm your transport request. Open the app for details.",
      deepLink: `medpilot://transport/${id}`, email: true,
    });
    await this.db.insert(s.activities).values({
      id: uuidv7(), userId: row.t.userId, type: "transport",
      title: decision === "confirm" ? "Transport confirmed" : "Transport cancelled",
      subtitle: `Reference #${row.t.reference}`, status: decision === "confirm" ? "booked" : "cancelled",
      targetType: "transport", targetId: id,
    });
    await this.audit.write({ actorUserId: staffId, actorType: "staff", action: `booking.transport_${decision}`, resourceType: "transport", resourceId: id });
    return this.transportDetail((await this.loadTransport(id))!.t, row.p);
  }
}
