import {
  pgTable, uuid, varchar, timestamp, integer, boolean, date, time, char, numeric, text,
  primaryKey, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./identity";
import { emergencyContacts } from "./health";
import { hospitals, medicalPackages, transportProviders, aircraft } from "./catalog";
import {
  appointmentType, appointmentStatus, transportStatus, siteType,
  activityType, activityStatus,
} from "./enums";

const ts = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const appointmentRequests = pgTable(
  "appointment_requests",
  {
    id: uuid("id").primaryKey(),
    reference: varchar("reference", { length: 20 }).notNull(),
    userId: uuid("user_id").notNull().references(() => users.id),
    hospitalId: uuid("hospital_id").notNull().references(() => hospitals.id),
    packageId: uuid("package_id").references(() => medicalPackages.id),
    appointmentType: appointmentType("appointment_type").notNull(),
    requestedDate: date("requested_date").notNull(),
    requestedTime: varchar("requested_time", { length: 5 }),
    underTreatment: boolean("under_treatment").notNull(),
    conditionNote: varchar("condition_note", { length: 200 }),
    emergencyContactId: uuid("emergency_contact_id").references(() => emergencyContacts.id),
    contactAccompanies: boolean("contact_accompanies").notNull().default(false),
    status: appointmentStatus("status").notNull().default("pending"),
    assignedStaffName: varchar("assigned_staff_name", { length: 120 }),
    assignedStaffRole: varchar("assigned_staff_role", { length: 120 }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    cancelledReason: varchar("cancelled_reason", { length: 200 }),
    ...ts,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("appointments_reference_uq").on(t.reference),
    index("appointments_user_ix").on(t.userId, t.status, t.requestedDate),
  ],
);

export const transportPurposes = pgTable("transport_purposes", {
  id: uuid("id").primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  label: varchar("label", { length: 120 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const specialNeeds = pgTable("special_needs", {
  id: uuid("id").primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  label: varchar("label", { length: 120 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const transportRequests = pgTable(
  "transport_requests",
  {
    id: uuid("id").primaryKey(),
    reference: varchar("reference", { length: 20 }).notNull(),
    userId: uuid("user_id").notNull().references(() => users.id),
    providerId: uuid("provider_id").notNull().references(() => transportProviders.id),
    aircraftId: uuid("aircraft_id").references(() => aircraft.id),
    pickupDate: date("pickup_date").notNull(),
    pickupTime: time("pickup_time"),
    pickupCountry: varchar("pickup_country", { length: 80 }).notNull(),
    pickupRegion: varchar("pickup_region", { length: 80 }),
    pickupCity: varchar("pickup_city", { length: 80 }),
    pickupAddress: varchar("pickup_address", { length: 160 }),
    pickupSiteType: siteType("pickup_site_type").notNull(),
    pickupSiteCode: varchar("pickup_site_code", { length: 20 }),
    pickupLat: numeric("pickup_lat", { precision: 9, scale: 6 }),
    pickupLng: numeric("pickup_lng", { precision: 9, scale: 6 }),
    dropoffCountry: varchar("dropoff_country", { length: 80 }).notNull(),
    dropoffRegion: varchar("dropoff_region", { length: 80 }),
    dropoffCity: varchar("dropoff_city", { length: 80 }),
    dropoffSiteType: siteType("dropoff_site_type").notNull(),
    dropoffSiteCode: varchar("dropoff_site_code", { length: 20 }),
    returnTrip: boolean("return_trip").notNull().default(false),
    otherPurpose: varchar("other_purpose", { length: 200 }),
    otherNeed: varchar("other_need", { length: 200 }),
    emergencyContactId: uuid("emergency_contact_id").references(() => emergencyContacts.id),
    contactAccompanies: boolean("contact_accompanies").notNull().default(false),
    status: transportStatus("status").notNull().default("pending"),
    flightNumber: varchar("flight_number", { length: 20 }),
    cancelledReason: varchar("cancelled_reason", { length: 200 }),
    departAt: timestamp("depart_at", { withTimezone: true }),
    arriveAt: timestamp("arrive_at", { withTimezone: true }),
    ...ts,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("transport_reference_uq").on(t.reference),
    index("transport_user_ix").on(t.userId, t.status, t.pickupDate),
    index("transport_pending_ix").on(t.status).where(sql`status = 'pending'`),
  ],
);

export const transportRequestPurposes = pgTable(
  "transport_request_purposes",
  {
    requestId: uuid("request_id").notNull().references(() => transportRequests.id, { onDelete: "cascade" }),
    purposeId: uuid("purpose_id").notNull().references(() => transportPurposes.id),
  },
  (t) => [primaryKey({ columns: [t.requestId, t.purposeId] })],
);

export const transportRequestNeeds = pgTable(
  "transport_request_needs",
  {
    requestId: uuid("request_id").notNull().references(() => transportRequests.id, { onDelete: "cascade" }),
    needId: uuid("need_id").notNull().references(() => specialNeeds.id),
  },
  (t) => [primaryKey({ columns: [t.requestId, t.needId] })],
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: activityType("type").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    subtitle: varchar("subtitle", { length: 200 }),
    status: activityStatus("status"),
    targetType: varchar("target_type", { length: 40 }),
    targetId: uuid("target_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activities_feed_ix").on(t.userId, t.occurredAt, t.id)],
);

/**
 * One row per reminder sent, keyed on the date it was for: inserting first is how a sweep claims a
 * booking (so two API instances can't both send), and a rescheduled booking gets a fresh reminder.
 */
export const bookingReminders = pgTable(
  "booking_reminders",
  {
    requestType: varchar("request_type", { length: 24 }).notNull(), // appointment | transport | service_request
    requestId: uuid("request_id").notNull(),
    forDate: date("for_date").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.requestType, t.requestId, t.forDate] })],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    key: varchar("key", { length: 80 }).notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    endpoint: varchar("endpoint", { length: 80 }).notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: text("response_body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.endpoint, t.key] })],
);
