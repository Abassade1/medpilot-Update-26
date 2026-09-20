import { z } from "zod";
import { futureDate, time } from "../bookings/bookings.schemas";

const message = z.string().trim().max(500, "Keep this under 500 characters");

/** Longest run a sitter can be booked for in one request. */
export const MAX_SITTING_DAYS = 30;

export const PET_TYPES = ["dog", "cat", "horse", "bird", "small_animal", "other"] as const;

export const PetRequestBody = z.object({
  kind: z.enum(["appointment", "sitting"]),
  serviceId: z.string().uuid("Choose a service"),
  petName: z.string().trim().min(1, "Enter your pet's name").max(60, "Keep the name under 60 characters"),
  petType: z.enum(PET_TYPES, { message: "Choose the type of pet" }),
  preferredDate: futureDate,
  preferredTime: time.nullish(),
  /** Sitting only: the last day. Omit for a single day. */
  endDate: futureDate.nullish(),
  message: message.optional(),
}).superRefine((v, ctx) => {
  if (v.kind === "appointment" && v.endDate) {
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "An appointment is a single day" });
  }
  if (v.endDate) {
    if (v.endDate < v.preferredDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "The end date can't be before the start date" });
    } else {
      const span = (Date.parse(v.endDate) - Date.parse(v.preferredDate)) / 86_400_000;
      if (span > MAX_SITTING_DAYS) {
        ctx.addIssue({ code: "custom", path: ["endDate"], message: `Sitting can be booked for up to ${MAX_SITTING_DAYS} days at a time` });
      }
    }
  }
});

export const SpecialistRequestBody = z.object({
  kind: z.enum(["booking", "connect"]),
  serviceId: z.string().uuid().nullish(),
  preferredDate: futureDate.nullish(),
  preferredTime: time.nullish(),
  message: message.optional(),
}).superRefine((v, ctx) => {
  if (v.kind === "booking") {
    if (!v.serviceId) ctx.addIssue({ code: "custom", path: ["serviceId"], message: "Choose a service" });
    if (!v.preferredDate) ctx.addIssue({ code: "custom", path: ["preferredDate"], message: "Choose a date" });
  } else if (!v.message?.trim()) {
    // A connect request has no service or date, so the message is the whole request.
    ctx.addIssue({ code: "custom", path: ["message"], message: "Tell the specialist what you need" });
  }
});

export const SpecialistListQuery = z.object({
  categoryId: z.string().uuid().optional(),
  q: z.string().trim().max(80).optional(),
});
