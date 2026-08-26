import {
  pgTable, uuid, varchar, timestamp, integer, boolean, bigint, char, text, numeric,
  primaryKey, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { catalogStatus, transportCategory, petCategory } from "./enums";
import { files } from "./health";

const ts = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const hospitals = pgTable(
  "hospitals",
  {
    id: uuid("id").primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    specialty: varchar("specialty", { length: 120 }).notNull(),
    countryCode: char("country_code", { length: 2 }).notNull(),
    countryLabel: varchar("country_label", { length: 80 }).notNull(),
    city: varchar("city", { length: 80 }),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    logoFileId: uuid("logo_file_id").references(() => files.id),
    logoAsset: varchar("logo_asset", { length: 80 }), // maps to a bundled frontend asset in v1
    rating: numeric("rating", { precision: 2, scale: 1 }).notNull().default("0"),
    specialistCount: integer("specialist_count").notNull().default(0),
    about: text("about").notNull().default(""),
    careSystem: varchar("care_system", { length: 120 }).notNull().default(""),
    openHours: varchar("open_hours", { length: 80 }).notNull().default(""),
    openHoursNote: varchar("open_hours_note", { length: 80 }),
    helipadCode: varchar("helipad_code", { length: 40 }),
    accredited: boolean("accredited").notNull().default(false),
    bookable: boolean("bookable").notNull().default(true),
    status: catalogStatus("status").notNull().default("draft"),
    ...ts,
  },
  (t) => [index("hospitals_status_ix").on(t.status)],
);

export const specialists = pgTable("specialists", {
  id: uuid("id").primaryKey(),
  fullName: varchar("full_name", { length: 120 }).notNull(),
  shortName: varchar("short_name", { length: 60 }).notNull(),
  role: varchar("role", { length: 120 }).notNull(),
  specialization: varchar("specialization", { length: 160 }),
  experienceLabel: varchar("experience_label", { length: 80 }),
  operationCountry: varchar("operation_country", { length: 80 }),
  otherCountries: varchar("other_countries", { length: 160 }),
  languages: varchar("languages", { length: 160 }),
  expertise: text("expertise").array().notNull().default([]),
  rating: numeric("rating", { precision: 2, scale: 1 }).notNull().default("0"),
  photoAsset: varchar("photo_asset", { length: 80 }),
  available: boolean("available").notNull().default(true),
  certified: boolean("certified").notNull().default(false),
  status: catalogStatus("status").notNull().default("published"),
  ...ts,
});

export const hospitalSpecialists = pgTable(
  "hospital_specialists",
  {
    hospitalId: uuid("hospital_id").notNull().references(() => hospitals.id, { onDelete: "cascade" }),
    specialistId: uuid("specialist_id").notNull().references(() => specialists.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.hospitalId, t.specialistId] })],
);

export const transportProviders = pgTable(
  "transport_providers",
  {
    id: uuid("id").primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    category: transportCategory("category").notNull(),
    location: varchar("location", { length: 120 }).notNull().default(""),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    rating: numeric("rating", { precision: 2, scale: 1 }).notNull().default("0"),
    verified: boolean("verified").notNull().default(false),
    priceFromAmount: bigint("price_from_amount", { mode: "number" }),
    priceFromCurrency: char("price_from_currency", { length: 3 }).notNull().default("USD"),
    description: text("description").notNull().default(""),
    routes: text("routes").notNull().default(""),
    tags: varchar("tags", { length: 160 }).notNull().default(""),
    heroAsset: varchar("hero_asset", { length: 80 }),
    logoAsset: varchar("logo_asset", { length: 80 }),
    status: catalogStatus("status").notNull().default("draft"),
    ...ts,
  },
  (t) => [index("providers_status_cat_ix").on(t.status, t.category)],
);

export const aircraft = pgTable("aircraft", {
  id: uuid("id").primaryKey(),
  providerId: uuid("provider_id").notNull().references(() => transportProviders.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  capacityLabel: varchar("capacity_label", { length: 120 }).notNull().default(""),
  capacityNote: varchar("capacity_note", { length: 120 }),
  medicalCrew: varchar("medical_crew", { length: 120 }),
  medicalCrewNote: varchar("medical_crew_note", { length: 120 }),
  paramedicLabel: varchar("paramedic_label", { length: 120 }),
  maxAltitudeM: varchar("max_altitude_m", { length: 40 }),
  maxAltitudeFt: varchar("max_altitude_ft", { length: 40 }),
  priceAmount: bigint("price_amount", { mode: "number" }),
  priceCurrency: char("price_currency", { length: 3 }).notNull().default("USD"),
  heroAsset: varchar("hero_asset", { length: 80 }),
  active: boolean("active").notNull().default(true),
  ...ts,
});

export const aircraftFacilities = pgTable("aircraft_facilities", {
  id: uuid("id").primaryKey(),
  aircraftId: uuid("aircraft_id").notNull().references(() => aircraft.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 120 }).notNull(),
  imageAsset: varchar("image_asset", { length: 80 }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const medicalPackages = pgTable(
  "medical_packages",
  {
    id: uuid("id").primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    title: varchar("title", { length: 160 }).notNull(),
    hospitalId: uuid("hospital_id").notNull().references(() => hospitals.id),
    transportProviderId: uuid("transport_provider_id").references(() => transportProviders.id),
    priceAmount: bigint("price_amount", { mode: "number" }).notNull(),
    priceCurrency: char("price_currency", { length: 3 }).notNull().default("USD"),
    priceLabel: varchar("price_label", { length: 20 }).notNull(), // "$4.75m" display form (Q4 open)
    locationLabel: varchar("location_label", { length: 120 }).notNull().default(""),
    rating: numeric("rating", { precision: 2, scale: 1 }).notNull().default("0"),
    description: text("description").notNull().default(""),
    heroAsset: varchar("hero_asset", { length: 80 }),
    status: catalogStatus("status").notNull().default("draft"),
    ...ts,
  },
  (t) => [index("packages_status_ix").on(t.status)],
);

export const packageInclusions = pgTable("package_inclusions", {
  id: uuid("id").primaryKey(),
  packageId: uuid("package_id").notNull().references(() => medicalPackages.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 80 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const petClinics = pgTable("pet_clinics", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  category: petCategory("category").notNull(),
  location: varchar("location", { length: 120 }).notNull().default(""),
  rating: numeric("rating", { precision: 2, scale: 1 }).notNull().default("0"),
  priceFromAmount: bigint("price_from_amount", { mode: "number" }),
  priceFromCurrency: char("price_from_currency", { length: 3 }).notNull().default("USD"),
  description: text("description").notNull().default(""),
  openTo: varchar("open_to", { length: 200 }).notNull().default(""),
  logoEmoji: varchar("logo_emoji", { length: 8 }),
  heroAsset: varchar("hero_asset", { length: 80 }),
  verified: boolean("verified").notNull().default(false),
  status: catalogStatus("status").notNull().default("published"),
  ...ts,
});

export const serviceCategories = pgTable("service_categories", {
  id: uuid("id").primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  title: varchar("title", { length: 80 }).notNull(),
  description: varchar("description", { length: 160 }).notNull(),
  colorHex: char("color_hex", { length: 7 }).notNull(),
  imageAsset: varchar("image_asset", { length: 80 }),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const promoSlides = pgTable("promo_slides", {
  id: uuid("id").primaryKey(),
  title: varchar("title", { length: 120 }).notNull(),
  subtitle: varchar("subtitle", { length: 160 }).notNull(),
  priceLabel: varchar("price_label", { length: 20 }),
  packageId: uuid("package_id").references(() => medicalPackages.id, { onDelete: "set null" }),
  imageAsset: varchar("image_asset", { length: 80 }),
  sortOrder: integer("sort_order").notNull().default(0),
  activeFrom: timestamp("active_from", { withTimezone: true }),
  activeTo: timestamp("active_to", { withTimezone: true }),
});

export const independentSpecialistCategories = pgTable("independent_specialist_categories", {
  id: uuid("id").primaryKey(),
  title: varchar("title", { length: 80 }).notNull(),
  countLabel: varchar("count_label", { length: 40 }).notNull(),
  imageAsset: varchar("image_asset", { length: 80 }),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});
