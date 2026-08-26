import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { and, eq, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Db } from "../../db/client";
import { schema as s } from "../../db/client";
import { loadEnv } from "../../config/env";
import { AppError } from "../../common/errors";
import type { AccessClaims } from "../../common/auth.guard";

export interface TokenPair { accessToken: string; refreshToken: string; expiresIn: number }

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

@Injectable()
export class TokenService {
  private readonly env = loadEnv();
  constructor(@Inject("DB") private readonly db: Db) {}

  signAccess(claims: Omit<AccessClaims, "ev"> & { ev: boolean }): string {
    return jwt.sign(claims as object, this.env.jwtPrivateKey, {
      algorithm: "RS256", expiresIn: this.env.ACCESS_TOKEN_TTL_SEC,
      issuer: "medpilot", audience: "medpilot-app",
    });
  }

  /** Mints a fresh chain (login/register) or a rotation link. */
  async issuePair(user: { id: string; role: string; emailVerifiedAt: Date | null }, plan: "basic" | "pro", deviceId?: string, replaceId?: string): Promise<TokenPair> {
    const raw = "rt_" + randomBytes(32).toString("base64url");
    const rtId = uuidv7();
    await this.db.insert(s.refreshTokens).values({
      id: rtId,
      userId: user.id,
      deviceId: deviceId ?? null,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86400_000),
    });
    if (replaceId) {
      await this.db.update(s.refreshTokens)
        .set({ revokedAt: new Date(), replacedBy: rtId })
        .where(eq(s.refreshTokens.id, replaceId));
    }
    const accessToken = this.signAccess({
      sub: user.id, sid: rtId, role: user.role, plan, ev: !!user.emailVerifiedAt,
    });
    return { accessToken, refreshToken: raw, expiresIn: this.env.ACCESS_TOKEN_TTL_SEC };
  }

  /**
   * Single-use rotation with reuse detection: presenting an already-consumed
   * token revokes every live token the user holds (spec §08).
   */
  async rotate(rawRefresh: string): Promise<{ pair: TokenPair; userId: string }> {
    const hash = sha256(rawRefresh);
    const [row] = await this.db.select().from(s.refreshTokens).where(eq(s.refreshTokens.tokenHash, hash)).limit(1);
    if (!row) throw AppError.unauthenticated("Your session has expired");

    if (row.revokedAt) {
      // Reuse of a consumed token — treat the whole account's sessions as compromised.
      await this.revokeAllForUser(row.userId);
      throw AppError.unauthenticated("Your session has expired");
    }
    if (row.expiresAt.getTime() < Date.now()) throw AppError.unauthenticated("Your session has expired");

    const [user] = await this.db.select().from(s.users)
      .where(and(eq(s.users.id, row.userId), isNull(s.users.deletedAt))).limit(1);
    if (!user || user.status !== "active") throw AppError.unauthenticated("Your session has expired");

    const plan = await this.currentPlan(user.id);
    const pair = await this.issuePair(user, plan, row.deviceId ?? undefined, row.id);
    return { pair, userId: user.id };
  }

  async revoke(rawRefresh: string): Promise<void> {
    await this.db.update(s.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(s.refreshTokens.tokenHash, sha256(rawRefresh)), isNull(s.refreshTokens.revokedAt)));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.update(s.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(s.refreshTokens.userId, userId), isNull(s.refreshTokens.revokedAt)));
  }

  async currentPlan(userId: string): Promise<"basic" | "pro"> {
    const [sub] = await this.db
      .select({ code: s.plans.code, status: s.subscriptions.status, end: s.subscriptions.currentPeriodEnd })
      .from(s.subscriptions)
      .innerJoin(s.plans, eq(s.plans.id, s.subscriptions.planId))
      .where(eq(s.subscriptions.userId, userId))
      .limit(1);
    if (!sub) return "basic";
    const live = (sub.status === "active" || sub.status === "grace") &&
      (!sub.end || sub.end.getTime() > Date.now());
    return live && sub.code === "pro" ? "pro" : "basic";
  }
}
