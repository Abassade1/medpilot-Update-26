import { z } from "zod";
import { loadEnv } from "../../config/env";
import { LOCATION_MODES, PRICE_TYPES, PROVIDER_TYPES } from "./taxonomy";

const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) => text(max).optional();
const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
// Either an https link the provider pasted in, or one of our own uploaded-image links (which is
// http in local dev only — API_PUBLIC_URL is required to be https everywhere it matters, see
// assertDeployableDrivers — so this never opens the door to a random pasted http:// image).
const ownFileUrl = () => `${loadEnv().API_PUBLIC_URL}/v1/files/`;
const httpsUrl = z.string().trim().url("Enter a full web address")
  .refine((u) => u.startsWith("https://") || u.startsWith(ownFileUrl()), "Images must use https");

export const ProviderTypeCode = z.enum(Object.keys(PROVIDER_TYPES) as [string, ...string[]]);

const profileFields = {
  description: optText(2000),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number").nullish().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email address").max(254).nullish().or(z.literal("")),
  website: z.string().trim().url("Enter a full web address, like https://example.com").max(200).nullish().or(z.literal("")),
  address: optText(200),
  country: optText(80),
  region: optText(80),
  city: optText(80),
  serviceAreas: optText(1000),
  operatingHours: optText(300),
  languages: optText(200),
  certifications: optText(2000),
  logoUrl: httpsUrl.nullish().or(z.literal("")),
  coverUrl: httpsUrl.nullish().or(z.literal("")),
};

export const CreateProviderBody = z.object({
  type: ProviderTypeCode,
  name: text(120).min(2, "Enter the business or provider name"),
  ...profileFields,
});
export const PatchProviderBody = z.object({
  name: text(120).min(2, "Enter the business or provider name").optional(),
  ...profileFields,
}).refine((o) => Object.keys(o).length > 0, "Nothing to update");
export const VerificationBody = z.object({
  licenseInfo: text(300).min(3, "Enter your licence, registration or certificate details"),
});

export const LocationMode = z.enum(LOCATION_MODES.map((m) => m.value) as [string, ...string[]]);
export const PriceType = z.enum(PRICE_TYPES.map((p) => p.value) as [string, ...string[]]);

const listingFields = {
  category: optText(40),
  subcategory: optText(60),
  description: optText(4000),
  priceAmount: z.number().int("Enter the price in whole cents").min(0).max(100_000_000).nullish(),
  priceCurrency: z.string().trim().length(3).toUpperCase().optional(),
  priceType: PriceType.optional(),
  durationMinutes: z.number().int().min(5, "At least 5 minutes").max(60 * 24 * 60).nullish(),
  capacity: z.number().int().min(1, "At least 1").max(500).optional(),
  locationModes: z.array(LocationMode).max(3).optional(),
  country: optText(80),
  region: optText(80),
  city: optText(80),
  serviceRadiusKm: z.number().int().min(1).max(20000).nullish(),
  requirements: optText(2000),
  preparation: optText(2000),
  cancellationPolicy: optText(2000),
  terms: optText(4000),
  attributes: z.record(z.string(), z.union([z.string().max(500), z.number(), z.boolean(), z.array(z.string().max(60)).max(20)])).optional(),
  includes: z.array(z.object({ label: text(140).min(1), listingId: z.string().uuid().optional() })).max(30).optional(),
  images: z.array(httpsUrl).max(8).optional(),
};

export const CreateListingBody = z.object({
  kind: z.enum(["service", "package"]),
  name: text(140).min(2, "Give it a name"),
  ...listingFields,
});
export const PatchListingBody = z.object({
  name: text(140).min(2, "Give it a name").optional(),
  ...listingFields,
}).refine((o) => Object.keys(o).length > 0, "Nothing to update");

export const AvailabilityBody = z.object({
  windows: z.array(z.object({ weekday: z.number().int().min(0).max(6), start: HHMM, end: HHMM })).max(50),
  blackouts: z.array(Day).max(366),
}).superRefine((v, ctx) => {
  v.windows.forEach((w, i) => {
    if (w.end <= w.start) ctx.addIssue({ code: "custom", path: ["windows", i, "end"], message: "The end must be after the start" });
  });
  for (let d = 0; d < 7; d++) {
    const day = v.windows.map((w, i) => ({ ...w, i })).filter((w) => w.weekday === d).sort((a, b) => a.start.localeCompare(b.start));
    for (let k = 1; k < day.length; k++) {
      if (day[k]!.start < day[k - 1]!.end) ctx.addIssue({ code: "custom", path: ["windows", day[k]!.i, "start"], message: "Windows on the same day can't overlap" });
    }
  }
});

export const DiscoverQuery = z.object({
  q: text(80).optional(),
  kind: z.enum(["service", "package"]).optional(),
  type: ProviderTypeCode.optional(),
  category: text(40).optional(),
  country: text(80).optional(),
  region: text(80).optional(),
  city: text(80).optional(),
  priceMax: z.coerce.number().int().min(0).optional(), // whole currency units
  bookable: z.enum(["true", "false"]).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc"]).optional(),
});
export const ListingsQuery = z.object({
  kind: z.enum(["service", "package"]).optional(),
  status: z.enum(["draft", "review", "published", "unpublished", "archived"]).optional(),
});
export const ImageUploadUrlBody = z.object({
  mimeType: z.enum(["image/jpeg", "image/png"]),
  sizeBytes: z.number().int().positive(),
});

export const TeamMemberRole = z.enum(["manager", "staff"]);
export const InviteMemberBody = z.object({
  email: z.string().trim().min(1, "Email address is required").email("Enter a valid email address").max(254)
    .transform((v) => v.toLowerCase()),
  role: TeamMemberRole,
});
export const InviteTokenBody = z.object({ token: z.string().min(10).max(200) });

export const SlotsQuery = z.object({ date: Day });
export const BookListingBody = z.object({
  date: Day,
  time: HHMM,
  notes: optText(500),
  contactPhone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number").optional(),
});
export const BookingsQuery = z.object({ status: z.enum(["pending", "confirmed", "completed", "cancelled"]).optional() });
export const DecisionBody = z.object({ reason: optText(200) });
