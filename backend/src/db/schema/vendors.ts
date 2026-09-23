import {
  pgTable, uuid, varchar, timestamp, integer, smallint, text, primaryKey, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { users } from "./identity";

const ts = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/**
 * A business or independent professional who lists services on the platform. One provider per user;
 * `type` selects the taxonomy (categories and type-specific fields) the portal offers.
 */
export const providers = pgTable(
  "providers",
  {
    id: uuid("id").primaryKey(),
    ownerUserId: uuid("owner_user_id").notNull().references(() => users.id),
    type: varchar("type", { length: 32 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description").notNull().default(""),
    phone: varchar("phone", { length: 24 }),
    email: varchar("email", { length: 254 }),
    website: varchar("website", { length: 200 }),
    address: varchar("address", { length: 200 }),
    country: varchar("country", { length: 80 }),
    region: varchar("region", { length: 80 }),
    city: varchar("city", { length: 80 }),
    serviceAreas: text("service_areas").notNull().default(""),
    operatingHours: varchar("operating_hours", { length: 300 }).notNull().default(""),
    languages: varchar("languages", { length: 200 }).notNull().default(""),
    certifications: text("certifications").notNull().default(""),
    logoUrl: varchar("logo_url", { length: 400 }),
    coverUrl: varchar("cover_url", { length: 400 }),
    /** unverified -> pending (documents submitted) -> verified | rejected */
    verificationStatus: varchar("verification_status", { length: 12 }).notNull().default("unverified"),
    verificationInfo: varchar("verification_info", { length: 300 }),
    verificationNote: varchar("verification_note", { length: 300 }),
    ...ts,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("providers_owner_uq").on(t.ownerUserId), index("providers_type_ix").on(t.type)],
);

/**
 * A service or a package a provider offers. `attributes` holds the type-specific fields defined by the
 * taxonomy, `includes` the items in a package. Members only ever see rows with status = published.
 */
export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey(),
    providerId: uuid("provider_id").notNull().references(() => providers.id),
    kind: varchar("kind", { length: 10 }).notNull(), // service | package
    category: varchar("category", { length: 40 }).notNull().default(""),
    subcategory: varchar("subcategory", { length: 60 }).notNull().default(""),
    name: varchar("name", { length: 140 }).notNull(),
    description: text("description").notNull().default(""),
    priceAmount: integer("price_amount"), // minor units
    priceCurrency: varchar("price_currency", { length: 3 }).notNull().default("USD"),
    priceType: varchar("price_type", { length: 12 }).notNull().default("fixed"), // fixed | from | per_hour | per_day | quote
    durationMinutes: integer("duration_minutes"),
    capacity: integer("capacity").notNull().default(1),
    locationModes: varchar("location_modes", { length: 60 }).notNull().default("onsite"), // csv of onsite,home,remote
    country: varchar("country", { length: 80 }),
    region: varchar("region", { length: 80 }),
    city: varchar("city", { length: 80 }),
    serviceRadiusKm: integer("service_radius_km"),
    requirements: text("requirements").notNull().default(""),
    preparation: text("preparation").notNull().default(""),
    cancellationPolicy: text("cancellation_policy").notNull().default(""),
    terms: text("terms").notNull().default(""),
    attributes: text("attributes").notNull().default("{}"),
    includes: text("includes").notNull().default("[]"),
    images: text("images").notNull().default("[]"),
    /** draft -> review (unverified provider) -> published -> unpublished -> archived */
    status: varchar("status", { length: 12 }).notNull().default("draft"),
    rejectionNote: varchar("rejection_note", { length: 300 }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    ...ts,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("listings_provider_ix").on(t.providerId, t.status), index("listings_discover_ix").on(t.status, t.category)],
);

/** A weekly window a listing can be booked in, e.g. Monday 09:00–17:00. */
export const listingWindows = pgTable(
  "listing_windows",
  {
    id: uuid("id").primaryKey(),
    listingId: uuid("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(), // 0 = Sunday … 6 = Saturday
    startTime: varchar("start_time", { length: 5 }).notNull(),
    endTime: varchar("end_time", { length: 5 }).notNull(),
  },
  (t) => [index("listing_windows_ix").on(t.listingId, t.weekday)],
);

export const listingBlackouts = pgTable(
  "listing_blackouts",
  {
    listingId: uuid("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
    day: varchar("day", { length: 10 }).notNull(), // YYYY-MM-DD
  },
  (t) => [primaryKey({ columns: [t.listingId, t.day] })],
);
