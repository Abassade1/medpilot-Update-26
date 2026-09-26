import { Inject, Injectable } from "@nestjs/common";
import { sql, and, desc, eq, inArray, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Db } from "../../db/client";
import { schema as s } from "../../db/client";
import { loadEnv } from "../../config/env";
import { log } from "../../common/logger";
import { EmailService } from "../email/email.service";

/**
 * In-app inbox + push dispatch. Push payloads must never contain PHI —
 * titles/bodies here are generic by construction (spec §13). The console
 * driver logs in development; the expo driver posts to Expo Push.
 */
@Injectable()
export class NotificationsService {
  private readonly env = loadEnv();
  constructor(@Inject("DB") private readonly db: Db, private readonly email: EmailService) {}

  /**
   * `email: true` also emails the member (booking confirmations and cancellations), if their
   * address is verified and they haven't turned "Email updates" off. Delivery failures of either
   * push or email never fail the action that triggered the notification.
   */
  async notify(userId: string, n: { type: string; title: string; body: string; deepLink?: string; email?: boolean }) {
    await this.db.insert(s.notifications).values({
      id: uuidv7(), userId, type: n.type, title: n.title, body: n.body,
      data: n.deepLink ? JSON.stringify({ url: n.deepLink }) : null,
    });
    await this.push(userId, n).catch((e) => log.warn("push_failed", { userId, type: n.type, err: String(e) }));
    if (n.email) await this.mail(userId, n).catch((e) => log.warn("email_notify_failed", { userId, type: n.type, err: String(e) }));
  }

  private async mail(userId: string, n: { title: string; body: string }) {
    const [row] = await this.db.select({ email: s.users.email, verifiedAt: s.users.emailVerifiedAt, wants: s.userPreferences.emailUpdates })
      .from(s.users).leftJoin(s.userPreferences, eq(s.userPreferences.userId, s.users.id))
      .where(and(eq(s.users.id, userId), isNull(s.users.deletedAt))).limit(1);
    // An unverified address may be a typo belonging to someone else.
    if (!row || !row.verifiedAt || row.wants === false) return;
    // The body is the same generic copy as the push: no clinic or hospital names in an inbox.
    await this.email.send({ to: row.email, subject: n.title, text: n.body });
  }

  /** The inbox always records the notification; the member's "Push notifications" setting only governs the device alert. */
  private async push(userId: string, n: { title: string; body: string; deepLink?: string }) {
    const [prefs] = await this.db.select({ pushEnabled: s.userPreferences.pushEnabled })
      .from(s.userPreferences).where(eq(s.userPreferences.userId, userId)).limit(1);
    if (prefs && !prefs.pushEnabled) return;
    const devices = await this.db.select().from(s.devices).where(eq(s.devices.userId, userId));
    const tokens = devices.map((d) => d.pushToken).filter((t): t is string => !!t);
    if (!tokens.length) return;
    if (this.env.PUSH_DRIVER === "console") {
      log.info("push_console", { userId, tokens: tokens.length, title: n.title });
      return;
    }
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      // Required once "enhanced push security" is on for the Expo project; harmless otherwise.
      headers: {
        "content-type": "application/json",
        ...(this.env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${this.env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(tokens.map((to) => ({ to, title: n.title, body: n.body, data: { url: n.deepLink } }))),
    });
    const out = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    // Forget tokens Expo says are dead so we stop sending to them. Drizzle queries are lazy:
    // they only run when awaited, so these must be awaited, not discarded.
    const dead = (out.data ?? [])
      .map((r, i) => (r.details?.error === "DeviceNotRegistered" ? tokens[i] : undefined))
      .filter((t): t is string => !!t);
    if (dead.length) await this.db.update(s.devices).set({ pushToken: null }).where(inArray(s.devices.pushToken, dead));
  }

  async list(userId: string) {
    const rows = await this.db.select().from(s.notifications)
      .where(eq(s.notifications.userId, userId))
      .orderBy(desc(s.notifications.createdAt)).limit(50);
    // A real count, not a count of the page: with more than 50 notifications the
    // badge would otherwise understate how many are unread.
    const [{ n: unread }] = (await this.db.execute(
      sql`select count(*)::int n from notifications where user_id = ${userId} and read_at is null`,
    )).rows as [{ n: number }];
    return {
      unreadCount: unread,
      items: rows.map((r) => ({
        id: r.id, type: r.type, title: r.title, body: r.body,
        data: r.data ? JSON.parse(r.data) : null,
        read: !!r.readAt, createdAt: r.createdAt,
      })),
    };
  }

  async markRead(userId: string, ids: string[] | "all") {
    if (ids === "all") {
      await this.db.update(s.notifications).set({ readAt: new Date() })
        .where(and(eq(s.notifications.userId, userId), isNull(s.notifications.readAt)));
    } else if (ids.length) {
      await this.db.update(s.notifications).set({ readAt: new Date() })
        .where(and(eq(s.notifications.userId, userId), inArray(s.notifications.id, ids)));
    }
    return this.list(userId);
  }
}
