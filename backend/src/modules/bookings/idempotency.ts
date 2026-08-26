import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { Db } from "../../db/client";

/**
 * Replay guard for mutating endpoints. The client generates one key per form
 * instance; a retried request returns the stored first response verbatim so a
 * network timeout can never double-book (spec §11, §16).
 */
@Injectable()
export class IdempotencyService {
  constructor(@Inject("DB") private readonly db: Db) {}

  async run<T>(userId: string, endpoint: string, key: string | undefined, fn: () => Promise<T>): Promise<{ replayed: boolean; body: T }> {
    if (!key || key.length > 80) return { replayed: false, body: await fn() };
    const existing = (await this.db.execute(sql`
      select response_body from idempotency_keys
      where user_id = ${userId} and endpoint = ${endpoint} and key = ${key}
    `)).rows as { response_body: string }[];
    if (existing[0]) return { replayed: true, body: JSON.parse(existing[0].response_body) as T };
    const body = await fn();
    await this.db.execute(sql`
      insert into idempotency_keys (key, user_id, endpoint, response_status, response_body)
      values (${key}, ${userId}, ${endpoint}, 201, ${JSON.stringify(body)})
      on conflict do nothing
    `);
    return { replayed: false, body };
  }
}
