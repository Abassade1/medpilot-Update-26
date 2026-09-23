import {
  pgTable, uuid, varchar, timestamp, integer, boolean, bigint, char, text, numeric, date,
  primaryKey, uniqueIndex, index, type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { catalogStatus } from "./enums";
import { independentSpecialistCategories, petClinics, transportProviders } from "./catalog";
import { users } from "./identity";

const ts = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/**
 * Country -> region (province/state) -> city. One tree, so every dependent
 * dropdown, address match and coverage check reads the same source of truth.
 */
export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey(),
    parentId: uuid("parent_id").references((): AnyPgColumn => locations.id, { onDelete: "cascade" }),
    level: varchar("level", { length: 10 }).notNull(), // country | region | city
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 10 }),
    /** Comma-separated alternative spellings a geocoder might return. */
    aliases: varchar("aliases", { length: 200 }).notNull().default(""),
    hasAirport: boolean("has_airport").notNull().default(false),
    hasHelipad: boolean("has_helipad").notNull().default(false),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("locations_parent_ix").on(t.parentId, t.sortOrder)],
);

/** A provider serves the location it is attached to and everything beneath it. */
export const transportProviderCoverage = pgTable(
  "transport_provider_coverage",
  {
    providerId: uuid("provider_id").notNull().references(() => transportProviders.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.providerId, t.locationId] }), index("coverage_location_ix").on(t.locationId)],
);

export const petServices = pgTable(
  "pet_services",
  {
    id: uuid("id").primaryKey(),
    clinicId: uuid("clinic_id").notNull().references(() => petClinics.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: varchar("description", { length: 300 }).notNull().default(""),
    kind: varchar("kind", { length: 12 }).notNull().default("appointment"), // appointment | sitting
    priceAmount: bigint("price_amount", { mode: "number" }),
    priceCurrency: char("price_currency", { length: 3 }).notNull().default("USD"),
    durationLabel: varchar("duration_label", { length: 40 }).notNull().default(""),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("pet_services_clinic_ix").on(t.clinicId, t.sortOrder)],
);

export const independentSpecialists = pgTable(
  "independent_specialists",
  {
    id: uuid("id").primaryKey(),
    categoryId: uuid("category_id").notNull().references(() => independentSpecialistCategories.id),
    name: varchar("name", { length: 120 }).notNull(),
    role: varchar("role", { length: 120 }).notNull(),
    bio: text("bio").notNull().default(""),
    rating: numeric("rating", { precision: 2, scale: 1 }).notNull().default("0"),
    locationLabel: varchar("location_label", { length: 120 }).notNull().default(""),
    languages: varchar("languages", { length: 120 }).notNull().default("English"),
    yearsExperience: integer("years_experience"),
    availabilityLabel: varchar("availability_label", { length: 120 }).notNull().default(""),
    photoAsset: varchar("photo_asset", { length: 80 }),
    verified: boolean("verified").notNull().default(false),
    acceptingRequests: boolean("accepting_requests").notNull().default(true),
    status: catalogStatus("status").notNull().default("published"),
    ...ts,
  },
  (t) => [index("indep_spec_cat_ix").on(t.categoryId, t.status)],
);

export const independentServices = pgTable(
  "independent_services",
  {
    id: uuid("id").primaryKey(),
    specialistId: uuid("specialist_id").notNull().references(() => independentSpecialists.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: varchar("description", { length: 300 }).notNull().default(""),
    priceAmount: bigint("price_amount", { mode: "number" }),
    priceCurrency: char("price_currency", { length: 3 }).notNull().default("USD"),
    durationLabel: varchar("duration_label", { length: 40 }).notNull().default(""),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("indep_services_spec_ix").on(t.specialistId, t.sortOrder)],
);

/**
 * A member's request to a pet clinic or an independent specialist. One table
 * for both, since they share a lifecycle: pending -> confirmed/cancelled.
 */
export const serviceRequests = pgTable(
  "service_requests",
  {
    id: uuid("id").primaryKey(),
    reference: varchar("reference", { length: 20 }).notNull(),
    userId: uuid("user_id").notNull().references(() => users.id),
    /** pet_appointment | pet_sitting | specialist_booking | specialist_connect */
    kind: varchar("kind", { length: 24 }).notNull(),
    targetType: varchar("target_type", { length: 24 }).notNull(), // pet_clinic | independent_specialist
    targetId: uuid("target_id").notNull(),
    serviceId: uuid("service_id"),
    preferredDate: date("preferred_date"),
    endDate: date("end_date"),
    preferredTime: varchar("preferred_time", { length: 5 }),
    message: varchar("message", { length: 500 }),
    /** JSON: pet name/type for pet requests. Free text, so kept out of logs. */
    details: text("details"),
    status: varchar("status", { length: 12 }).notNull().default("pending"),
    cancelledReason: varchar("cancelled_reason", { length: 200 }),
    /** Set for bookings of a provider-created listing (kind = listing_booking). */
    listingId: uuid("listing_id"),
    providerId: uuid("provider_id"),
    ...ts,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("service_requests_provider_ix").on(t.providerId, t.status),
    index("service_requests_slot_ix").on(t.listingId, t.preferredDate),
    uniqueIndex("service_requests_reference_uq").on(t.reference),
    index("service_requests_user_ix").on(t.userId, t.status, t.createdAt),
  ],
);

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  pushEnabled: boolean("push_enabled").notNull().default(true),
  emailUpdates: boolean("email_updates").notNull().default(true),
  appointmentReminders: boolean("appointment_reminders").notNull().default(true),
  language: varchar("language", { length: 8 }).notNull().default("en"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

