import {
  pgTable, uuid, varchar, timestamp, integer, char, numeric, text, boolean, date, bigint,
  primaryKey, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { users } from "./identity";
import { files } from "./health";
import {
  aiKind, aiStatus, aiRole, severity, mealStatus,
  planCode, planInterval, subStatus, subSource, usageMetric,
} from "./enums";

export const aiSessions = pgTable(
  "ai_sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    kind: aiKind("kind").notNull(),
    status: aiStatus("status").notNull().default("active"),
    modelVersion: varchar("model_version", { length: 60 }).notNull(),
    disclaimerVersion: varchar("disclaimer_version", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("ai_sessions_user_ix").on(t.userId, t.createdAt)],
);

export const aiMessages = pgTable("ai_messages", {
  id: uuid("id").primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => aiSessions.id, { onDelete: "cascade" }),
  role: aiRole("role").notNull(),
  content: text("content").notNull(),
  contentTranslated: text("content_translated"), // JSON {locale: text}
  audioFileId: uuid("audio_file_id").references(() => files.id),
  tokenCount: integer("token_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const triageResults = pgTable("triage_results", {
  id: uuid("id").primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => aiSessions.id, { onDelete: "cascade" }).unique(),
  title: varchar("title", { length: 120 }).notNull(),
  summary: text("summary").notNull(),
  possibleCauses: text("possible_causes").notNull(),
  recommendedTreatment: text("recommended_treatment").notNull(),
  severity: severity("severity").notNull().default("routine"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const triageSymptoms = pgTable("triage_symptoms", {
  id: uuid("id").primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  label: varchar("label", { length: 80 }).notNull(),
  emoji: varchar("emoji", { length: 8 }),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const triageConditions = pgTable("triage_conditions", {
  id: uuid("id").primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  label: varchar("label", { length: 80 }).notNull(),
  emoji: varchar("emoji", { length: 8 }),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const mealAnalyses = pgTable(
  "meal_analyses",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    sessionId: uuid("session_id").references(() => aiSessions.id),
    imageFileId: uuid("image_file_id").notNull().references(() => files.id),
    status: mealStatus("status").notNull().default("queued"),
    caloriesEstimate: integer("calories_estimate"),
    baselineDeltaPct: numeric("baseline_delta_pct", { precision: 5, scale: 2 }),
    failureReason: varchar("failure_reason", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("meal_user_ix").on(t.userId, t.createdAt)],
);

export const mealSegments = pgTable("meal_segments", {
  id: uuid("id").primaryKey(),
  analysisId: uuid("analysis_id").notNull().references(() => mealAnalyses.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 60 }).notNull(),
  percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
  colorHex: char("color_hex", { length: 7 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const mealDetails = pgTable("meal_details", {
  id: uuid("id").primaryKey(),
  analysisId: uuid("analysis_id").notNull().references(() => mealAnalyses.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 30 }).notNull(),
  label: varchar("label", { length: 80 }).notNull(),
  body: text("body"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey(),
  code: planCode("code").notNull().unique(),
  name: varchar("name", { length: 60 }).notNull(),
  priceAmount: bigint("price_amount", { mode: "number" }).notNull(),
  priceCurrency: char("price_currency", { length: 3 }).notNull().default("USD"),
  interval: planInterval("interval").notNull().default("month"),
  appleProductId: varchar("apple_product_id", { length: 80 }),
  googleProductId: varchar("google_product_id", { length: 80 }),
  features: text("features").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").notNull().references(() => plans.id),
    status: subStatus("status").notNull().default("active"),
    source: subSource("source").notNull(),
    originalTransactionId: varchar("original_transaction_id", { length: 120 }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subscriptions_user_uq").on(t.userId),
    uniqueIndex("subscriptions_orig_txn_uq").on(t.originalTransactionId),
  ],
);

export const usageCounters = pgTable(
  "usage_counters",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    metric: usageMetric("metric").notNull(),
    periodStart: date("period_start").notNull(),
    used: integer("used").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.metric, t.periodStart] })],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 60 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: varchar("body", { length: 500 }).notNull(),
    data: text("data"), // JSON deep-link payload
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_unread_ix").on(t.userId, t.createdAt)],
);
