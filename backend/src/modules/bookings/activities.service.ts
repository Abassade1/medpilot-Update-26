import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { schema as s } from "../../db/client";
import { decodeCursor, encodeCursor, PageQuery } from "../../common/pagination";

/** The member's chronological feed. Rows are written only by other services. */
@Injectable()
export class ActivitiesService {
  constructor(@Inject("DB") private readonly db: Db) {}

  async list(userId: string, q: PageQuery & { type?: string }) {
    const conds = [eq(s.activities.userId, userId)] as any[];
    if (q.type) conds.push(eq(s.activities.type, q.type as never));
    if (q.cursor) {
      const c = decodeCursor(q.cursor);
      if (c) {
        conds.push(or(
          lt(s.activities.occurredAt, c.at),
          and(eq(s.activities.occurredAt, c.at), lt(s.activities.id, c.id)),
        ));
      }
    }
    const rows = await this.db.select().from(s.activities)
      .where(and(...conds))
      .orderBy(desc(s.activities.occurredAt), desc(s.activities.id))
      .limit(q.limit + 1);

    const page = rows.slice(0, q.limit);
    const nextCursor = rows.length > q.limit
      ? encodeCursor(page[page.length - 1]!.occurredAt, page[page.length - 1]!.id)
      : null;
    return {
      items: page.map((a) => ({
        id: a.id, type: a.type, title: a.title, subtitle: a.subtitle,
        status: a.status, targetType: a.targetType, targetId: a.targetId,
        occurredAt: a.occurredAt,
        day: this.dayLabel(a.occurredAt),
        time: a.occurredAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      })),
      nextCursor,
    };
  }

  private dayLabel(d: Date): string {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const that = new Date(d); that.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - that.getTime()) / 86400_000);
    if (diff <= 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return "Earlier this week";
    return that.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
}
