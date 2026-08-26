import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
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
import type { CreateAppointmentBody, CreateTransportBody, StaffDecisionBody } from "./bookings.schemas";

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

  private appointmentView = (
    a: typeof s.appointmentRequests.$inferSelect,
    h: typeof s.hospitals.$inferSelect,
  ) => ({
    id: a.id,
    reference: `#${a.reference}`,
    status: a.status,
    appointmentType: a.appointmentType,
    appointmentTypeLabel: TYPE_LABEL[a.appointmentType] ?? a.appointmentType,
    requestedDate: a.requestedDate,
    scheduledAt: a.scheduledAt,
    hospital: {
      id: h.id, name: h.name, logoAsset: h.logoAsset,
      location: h.city ? `${h.city}, ${h.countryLabel}` : h.countryLabel,
    },
    contactPerson: a.assignedStaffName
      ? { name: a.assignedStaffName, role: a.assignedStaffRole ?? "Consultant", photoAsset: "doctor1" }
      : null,
    createdAt: a.createdAt,
  });

  async listAppointments(userId: string) {
    const rows = await this.db.select({ a: s.appointmentRequests, h: s.hospitals })
      .from(s.appointmentRequests)
      .innerJoin(s.hospitals, eq(s.hospitals.id, s.appointmentRequests.hospitalId))
      .where(and(eq(s.appointmentRequests.userId, userId), isNull(s.appointmentRequests.deletedAt)))
      .orderBy(desc(s.appointmentRequests.createdAt)).limit(50);
    return rows.map(({ a, h }) => this.appointmentView(a, h));
  }

  async getAppointment(userId: string, id: string) {
    const [row] = await this.db.select({ a: s.appointmentRequests, h: s.hospitals })
      .from(s.appointmentRequests)
      .innerJoin(s.hospitals, eq(s.hospitals.id, s.appointmentRequests.hospitalId))
      .where(and(eq(s.appointmentRequests.id, id), isNull(s.appointmentRequests.deletedAt))).limit(1);
    if (!row || row.a.userId !== userId) throw AppError.notFound("Appointment");
    return this.appointmentView(row.a, row.h);
  }

  /** Members may cancel only while the request is still pending (spec §14). */
  async cancelAppointment(userId: string, id: string) {
    const [a] = await this.db.select().from(s.appointmentRequests)
      .where(and(eq(s.appointmentRequests.id, id), isNull(s.appointmentRequests.deletedAt))).limit(1);
    if (!a || a.userId !== userId) throw AppError.notFound("Appointment");
    if (a.status !== "pending") {
      throw new AppError("conflict", "Only pending requests can be cancelled. Contact your representative.");
    }
    await this.db.update(s.appointmentRequests)
      .set({ status: "cancelled", cancelledReason: "Cancelled by member", updatedAt: new Date() })
      .where(eq(s.appointmentRequests.id, id));
    await this.db.insert(s.activities).values({
      id: uuidv7(), userId, type: "appointment", title: "Appointment cancelled",
      subtitle: `Reference #${a.reference}`, status: "cancelled",
      targetType: "appointment", targetId: id,
    });
    await this.quota.refund(userId, "clinic_access");
    await this.audit.write({ actorUserId: userId, action: "booking.appointment_cancelled", resourceType: "appointment", resourceId: id });
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
        deepLink: `medpilot://appointments/${id}`,
      });
    } else {
      await this.db.update(s.appointmentRequests).set({
        status: "cancelled", cancelledReason: input.reason ?? "Declined by operations", updatedAt: new Date(),
      }).where(eq(s.appointmentRequests.id, id));
      await this.quota.refund(a.userId, "clinic_access");
      await this.notifications.notify(a.userId, {
        type: "appointment.cancelled", title: "Appointment update",
        body: "We couldn't confirm your appointment request. Open the app for details.",
        deepLink: `medpilot://appointments/${id}`,
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
          pickupSiteType: input.pickupSiteType, pickupSiteCode: input.pickupSiteCode ?? null,
          pickupLat: input.pickupLat?.toString() ?? null, pickupLng: input.pickupLng?.toString() ?? null,
          dropoffCountry: input.dropoffCountry, dropoffRegion: input.dropoffRegion ?? null,
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

  private transportView = (
    t: typeof s.transportRequests.$inferSelect,
    p: typeof s.transportProviders.$inferSelect,
  ) => ({
    id: t.id,
    reference: `#${t.reference}`,
    status: t.status,
    pickup: { country: t.pickupCountry, region: t.pickupRegion, date: t.pickupDate, time: t.pickupTime, siteType: t.pickupSiteType, siteCode: t.pickupSiteCode },
    dropoff: { country: t.dropoffCountry, region: t.dropoffRegion, siteType: t.dropoffSiteType, siteCode: t.dropoffSiteCode },
    returnTrip: t.returnTrip,
    flightNumber: t.flightNumber,
    departAt: t.departAt, arriveAt: t.arriveAt,
    provider: { id: p.id, name: p.name, logoAsset: p.logoAsset, tags: p.tags },
    createdAt: t.createdAt,
  });

  async listTransport(userId: string) {
    const rows = await this.db.select({ t: s.transportRequests, p: s.transportProviders })
      .from(s.transportRequests)
      .innerJoin(s.transportProviders, eq(s.transportProviders.id, s.transportRequests.providerId))
      .where(and(eq(s.transportRequests.userId, userId), isNull(s.transportRequests.deletedAt)))
      .orderBy(desc(s.transportRequests.createdAt)).limit(50);
    return rows.map(({ t, p }) => this.transportView(t, p));
  }

  async getTransport(userId: string, id: string) {
    const [row] = await this.db.select({ t: s.transportRequests, p: s.transportProviders })
      .from(s.transportRequests)
      .innerJoin(s.transportProviders, eq(s.transportProviders.id, s.transportRequests.providerId))
      .where(and(eq(s.transportRequests.id, id), isNull(s.transportRequests.deletedAt))).limit(1);
    if (!row || row.t.userId !== userId) throw AppError.notFound("Transport booking");
    return this.transportView(row.t, row.p);
  }
}
