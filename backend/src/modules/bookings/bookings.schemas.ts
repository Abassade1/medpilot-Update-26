import { z } from "zod";
import { personName, phone } from "../auth/auth.schemas";

const futureDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .superRefine((v, ctx) => {
    // Date.parse rolls 31 Feb into 3 Mar instead of failing, so a real calendar
    // date is one that survives a round trip through its own components.
    const [y, m, day] = v.split("-").map(Number) as [number, number, number];
    const d = new Date(Date.UTC(y, m - 1, day));
    const real = d.getUTCFullYear() === y && d.getUTCMonth() === m - 1 && d.getUTCDate() === day;
    if (!real) return ctx.addIssue({ code: "custom", message: "That date doesn't exist" });
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    if (d.getTime() <= today.getTime()) return ctx.addIssue({ code: "custom", message: "Choose a date in the future" });
    if (d.getTime() > today.getTime() + 365 * 86400_000) ctx.addIssue({ code: "custom", message: "Choose a date within the next year" });
  });

export const EmergencyContactInput = z.object({
  firstName: personName("Firstname"),
  lastName: personName("Lastname"),
  phone,
  relationship: z.enum(["partner", "parent", "sibling", "friend", "other"]),
  accompanies: z.boolean().default(false),
});

export const CreateAppointmentBody = z.object({
  hospitalId: z.string().uuid(),
  packageId: z.string().uuid().nullish(),
  appointmentType: z.enum(["general_checkup", "specialist_consultation", "surgery"]),
  requestedDate: futureDate,
  underTreatment: z.boolean(),
  conditionNote: z.string().trim().max(200, "Keep this under 200 characters").optional(),
  emergencyContact: EmergencyContactInput,
}).superRefine((v, ctx) => {
  if (v.underTreatment && !v.conditionNote?.trim()) {
    ctx.addIssue({ code: "custom", path: ["conditionNote"], message: "Please describe your condition" });
  }
});

export const CreateTransportBody = z.object({
  providerId: z.string().uuid(),
  aircraftId: z.string().uuid().nullish(),
  pickupDate: futureDate,
  pickupTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM").nullish(),
  pickupCountry: z.string().trim().min(2).max(80),
  pickupRegion: z.string().trim().max(80).nullish(),
  pickupSiteType: z.enum(["airport", "helipad"]),
  pickupSiteCode: z.string().trim().max(20).nullish(),
  pickupLat: z.number().min(-90).max(90).nullish(),
  pickupLng: z.number().min(-180).max(180).nullish(),
  dropoffCountry: z.string().trim().min(2).max(80),
  dropoffRegion: z.string().trim().max(80).nullish(),
  dropoffSiteType: z.enum(["airport", "helipad"]),
  dropoffSiteCode: z.string().trim().max(20).nullish(),
  returnTrip: z.boolean().default(false),
  purposeIds: z.array(z.string().uuid()).max(10).default([]),
  otherPurpose: z.string().trim().max(200).nullish(),
  needIds: z.array(z.string().uuid()).max(10).default([]),
  otherNeed: z.string().trim().max(200).nullish(),
  emergencyContact: EmergencyContactInput,
}).superRefine((v, ctx) => {
  if (v.purposeIds.length === 0 && !v.otherPurpose?.trim()) {
    ctx.addIssue({ code: "custom", path: ["purposeIds"], message: "Choose at least one purpose" });
  }
  if (v.needIds.length === 0 && !v.otherNeed?.trim()) {
    ctx.addIssue({ code: "custom", path: ["needIds"], message: "Choose at least one need" });
  }
  if (v.pickupCountry.toLowerCase() === v.dropoffCountry.toLowerCase() &&
      (v.pickupRegion ?? "").toLowerCase() === (v.dropoffRegion ?? "").toLowerCase()) {
    ctx.addIssue({ code: "custom", path: ["dropoffCountry"], message: "Drop-off must differ from pickup" });
  }
});

export const StaffDecisionBody = z.object({
  scheduledAt: z.string().datetime().optional(),
  staffName: z.string().trim().max(120).optional(),
  staffRole: z.string().trim().max(120).optional(),
  flightNumber: z.string().trim().max(20).optional(),
  reason: z.string().trim().max(200).optional(),
});
