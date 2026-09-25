import { pgTable, uuid, varchar, smallint, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { users } from "./identity";

/**
 * A member's rating of a completed hospital appointment, transport booking, pet-clinic visit or
 * independent-specialist request. `targetType`/`targetId` is the catalog entity being rated (its
 * `rating` column is recomputed from this table on every insert); `requestType`/`requestId` is the
 * underlying booking that earned the right to review, and is unique so a booking can only be
 * reviewed once.
 */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    targetType: varchar("target_type", { length: 24 }).notNull(), // hospital | transport_provider | pet_clinic | independent_specialist
    targetId: uuid("target_id").notNull(),
    requestType: varchar("request_type", { length: 24 }).notNull(), // appointment | transport | service_request
    requestId: uuid("request_id").notNull(),
    rating: smallint("rating").notNull(),
    comment: varchar("comment", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reviews_request_uq").on(t.requestType, t.requestId),
    index("reviews_target_ix").on(t.targetType, t.targetId, t.createdAt),
  ],
);
