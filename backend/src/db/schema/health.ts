import {
  pgTable, uuid, varchar, timestamp, integer, boolean, bigint, char, text,
  primaryKey, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./identity";
import { recordKind, recordSource, recordStatus, fileScan, fileVisibility, relationship } from "./enums";

const ts = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey(),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    bucket: varchar("bucket", { length: 63 }).notNull(),
    objectKey: varchar("object_key", { length: 512 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    checksumSha256: char("checksum_sha256", { length: 64 }),
    scanStatus: fileScan("scan_status").notNull().default("pending"),
    visibility: fileVisibility("visibility").notNull().default("private"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("files_object_key_uq").on(t.objectKey)],
);

export const conditions = pgTable("conditions", {
  id: uuid("id").primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  label: varchar("label", { length: 80 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const userConditions = pgTable(
  "user_conditions",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    conditionId: uuid("condition_id").notNull().references(() => conditions.id),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.conditionId] })],
);

export const medicalRecords = pgTable(
  "medical_records",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    fileId: uuid("file_id").notNull().references(() => files.id),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    kind: recordKind("kind").notNull(),
    source: recordSource("source").notNull().default("upload"),
    status: recordStatus("status").notNull().default("uploading"),
    ...ts,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("medical_records_user_ix").on(t.userId).where(sql`deleted_at is null`)],
);

export const emergencyContacts = pgTable(
  "emergency_contacts",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 40 }).notNull(),
    lastName: varchar("last_name", { length: 40 }).notNull(),
    phoneE164: varchar("phone_e164", { length: 20 }).notNull(),
    relationship: relationship("relationship").notNull(),
    ...ts,
  },
  (t) => [uniqueIndex("emergency_contacts_user_uq").on(t.userId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey(),
    actorUserId: uuid("actor_user_id"),
    actorType: text("actor_type").notNull().default("user"),
    action: varchar("action", { length: 60 }).notNull(),
    resourceType: varchar("resource_type", { length: 60 }).notNull(),
    resourceId: uuid("resource_id"),
    ip: varchar("ip", { length: 45 }),
    userAgent: text("user_agent"),
    metadata: text("metadata"), // JSON string; PHI-free by policy
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_resource_ix").on(t.resourceType, t.resourceId, t.createdAt)],
);
