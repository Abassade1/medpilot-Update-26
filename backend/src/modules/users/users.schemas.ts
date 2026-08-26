import { z } from "zod";
import { personName, phone } from "../auth/auth.schemas";

export const PatchProfileBody = z.object({
  firstName: personName("Firstname").optional(),
  lastName: personName("Lastname").optional(),
  phone: phone.optional(),
  gender: z.enum(["male", "female", "undisclosed"]).nullish(),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).nullish(),
  locationLabel: z.string().trim().max(80).optional(),
  locationCountry: z.string().length(2).optional(),
  locationRegion: z.string().trim().max(80).optional(),
}).refine((o) => Object.keys(o).length > 0, "Nothing to update");

export const SetPasswordBody = z.object({
  password: z.string().min(8, "Use at least 8 characters").max(64, "Password is too long"),
  currentPassword: z.string().max(64).optional(), // required once a password exists
});

export const PutConditionsBody = z.object({
  conditionIds: z.array(z.string().uuid()).min(0).max(20),
});

export const UpsertContactBody = z.object({
  firstName: personName("Firstname"),
  lastName: personName("Lastname"),
  phone,
  relationship: z.enum(["partner", "parent", "sibling", "friend", "other"]),
});

export const RecordUploadUrlBody = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum([
    "application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg", "image/png",
  ]),
  sizeBytes: z.number().int().positive(),
  source: z.enum(["upload", "camera_scan"]).default("upload"),
});

export const CreateRecordBody = z.object({
  fileId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(255),
  source: z.enum(["upload", "camera_scan"]).default("upload"),
});

export const RegisterDeviceBody = z.object({
  platform: z.enum(["ios", "android"]),
  installId: z.string().trim().min(8).max(128),
  pushToken: z.string().trim().max(255).nullish(),
});

export const BiometricBody = z.object({
  installId: z.string().trim().min(8).max(128),
  enabled: z.boolean(),
  publicKey: z.string().max(2000).nullish(),
});
