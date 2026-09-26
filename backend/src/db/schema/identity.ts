import {
  pgTable, uuid, varchar, timestamp, boolean, text, char, date, customType,
  uniqueIndex, index,
} from "drizzle-orm/pg-core";
import {
  userStatus, authProvider, platform, vtokenPurpose, gender, maritalStatus, userRole,
} from "./enums";

export const citext = customType<{ data: string }>({ dataType: () => "citext" });

const ts = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    email: citext("email").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    passwordHash: text("password_hash"),
    role: userRole("role").notNull().default("member"),
    status: userStatus("status").notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...ts,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // uniqueness only among non-deleted accounts, so an erased email can re-register
    uniqueIndex("users_email_active_uq").on(t.email).where(sqlActive()),
  ],
);
// drizzle needs the raw sql for the partial index predicate:
import { sql } from "drizzle-orm";
function sqlActive() { return sql`deleted_at is null`; }

export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  firstName: varchar("first_name", { length: 40 }).notNull(),
  lastName: varchar("last_name", { length: 40 }).notNull(),
  phoneE164: varchar("phone_e164", { length: 20 }),
  phoneCountry: char("phone_country", { length: 2 }).notNull().default("CA"),
  dateOfBirth: date("date_of_birth"),
  gender: gender("gender"),
  maritalStatus: maritalStatus("marital_status"),
  locationLabel: varchar("location_label", { length: 80 }),
  locationCountry: char("location_country", { length: 2 }),
  locationRegion: varchar("location_region", { length: 80 }),
  avatarFileId: uuid("avatar_file_id"),
  ...ts,
});

export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: authProvider("provider").notNull(),
    providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
    emailAtLink: citext("email_at_link"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("auth_identities_provider_uq").on(t.provider, t.providerUserId)],
);

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    platform: platform("platform").notNull(),
    installId: varchar("install_id", { length: 128 }).notNull(),
    pushToken: varchar("push_token", { length: 255 }),
    biometricEnabled: boolean("biometric_enabled").notNull().default(false),
    biometricPubkey: text("biometric_pubkey"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    ...ts,
  },
  (t) => [uniqueIndex("devices_user_install_uq").on(t.userId, t.installId)],
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
    tokenHash: char("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    replacedBy: uuid("replaced_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("refresh_tokens_hash_uq").on(t.tokenHash),
    index("refresh_tokens_user_live_ix").on(t.userId).where(sql`revoked_at is null`),
  ],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    purpose: vtokenPurpose("purpose").notNull(),
    tokenHash: char("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("verification_tokens_hash_uq").on(t.tokenHash)],
);
