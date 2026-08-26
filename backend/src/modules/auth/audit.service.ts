import { Inject, Injectable } from "@nestjs/common";
import { uuidv7 } from "uuidv7";
import type { Db } from "../../db/client";
import { schema as s } from "../../db/client";

/** Append-only PHI/access audit (spec §18). Metadata must stay PHI-free. */
@Injectable()
export class AuditService {
  constructor(@Inject("DB") private readonly db: Db) {}
  async write(e: {
    actorUserId?: string; actorType?: "user" | "staff" | "system";
    action: string; resourceType: string; resourceId?: string;
    ip?: string; ua?: string; metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(s.auditLog).values({
      id: uuidv7(),
      actorUserId: e.actorUserId ?? null,
      actorType: e.actorType ?? "user",
      action: e.action,
      resourceType: e.resourceType,
      resourceId: e.resourceId ?? null,
      ip: e.ip ?? null,
      userAgent: e.ua?.slice(0, 300) ?? null,
      metadata: e.metadata ? JSON.stringify(e.metadata) : null,
    }).catch(() => { /* auditing must never break the request */ });
  }
}
