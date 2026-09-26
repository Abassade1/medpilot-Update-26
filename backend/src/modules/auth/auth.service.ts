import { Inject, Injectable } from "@nestjs/common";
import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { uuidv7 } from "uuidv7";
import type { Db } from "../../db/client";
import { schema as s } from "../../db/client";
import { AppError } from "../../common/errors";
import { loadEnv } from "../../config/env";
import { TokenService } from "./token.service";
import { EmailService } from "../email/email.service";
import { AuditService } from "./audit.service";
import type { RegisterBody } from "./auth.schemas";

const ARGON: argon2.Options = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 };
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

@Injectable()
export class AuthService {
  private readonly env = loadEnv();
  constructor(
    @Inject("DB") private readonly db: Db,
    private readonly tokens: TokenService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
  ) {}

  private async findActiveByEmail(emailAddr: string) {
    const [u] = await this.db.select().from(s.users)
      .where(and(eq(s.users.email, emailAddr), isNull(s.users.deletedAt))).limit(1);
    return u;
  }

  async emailAvailable(emailAddr: string): Promise<boolean> {
    return !(await this.findActiveByEmail(emailAddr));
  }

  async register(input: z.infer<typeof RegisterBody>, ctx: { ip?: string; ua?: string }) {
    if (await this.findActiveByEmail(input.email)) {
      throw new AppError("conflict", "An account with this email already exists", {
        fields: { email: "An account with this email already exists" },
      });
    }
    const userId = uuidv7();
    // No password supplied = deferred: store nothing rather than a placeholder,
    // so setupStatus.passwordSet stays false until the member actually picks one.
    const passwordHash = input.password ? await argon2.hash(input.password, ARGON) : null;

    await this.db.transaction(async (tx) => {
      await tx.insert(s.users).values({ id: userId, email: input.email, passwordHash });
      await tx.insert(s.userProfiles).values({
        userId,
        firstName: input.firstName,
        lastName: input.lastName,
        phoneE164: input.phone,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender ?? null,
        maritalStatus: input.maritalStatus ?? null,
        locationLabel: "Ontario, CA",
        locationCountry: "CA",
        locationRegion: "Ontario",
      });
    });

    await this.queueVerificationEmail(userId, input.email);
    await this.audit.write({ actorUserId: userId, action: "auth.register", resourceType: "user", resourceId: userId, ip: ctx.ip, ua: ctx.ua });

    const [user] = await this.db.select().from(s.users).where(eq(s.users.id, userId)).limit(1);
    const pair = await this.tokens.issuePair(user!, "basic");
    return this.authPayload(userId, pair);
  }

  /**
   * Account for someone joining a provider's team from an emailed invite. Only name and password:
   * staff aren't patients, so none of the member profile (phone, date of birth) is asked for. The
   * invite link was delivered to this address, which proves it, so the email starts verified.
   * The caller must have validated the invite token for `email` first.
   */
  async registerInvited(input: { email: string; firstName: string; lastName: string; password: string }, ctx: { ip?: string; ua?: string }) {
    if (await this.findActiveByEmail(input.email)) {
      throw new AppError("conflict", "An account with this email already exists. Sign in to accept the invite.", {
        fields: { email: "An account with this email already exists. Sign in to accept the invite." },
      });
    }
    const userId = uuidv7();
    const passwordHash = await argon2.hash(input.password, ARGON);
    await this.db.transaction(async (tx) => {
      await tx.insert(s.users).values({ id: userId, email: input.email, passwordHash, emailVerifiedAt: new Date() });
      await tx.insert(s.userProfiles).values({ userId, firstName: input.firstName, lastName: input.lastName });
    });
    await this.audit.write({ actorUserId: userId, action: "auth.register_invited", resourceType: "user", resourceId: userId, ip: ctx.ip, ua: ctx.ua });
    const [user] = await this.db.select().from(s.users).where(eq(s.users.id, userId)).limit(1);
    return this.authPayload(userId, await this.tokens.issuePair(user!, "basic"));
  }

  async login(emailAddr: string, password: string, ctx: { ip?: string; ua?: string }) {
    const user = await this.findActiveByEmail(emailAddr);
    // Constant-shape failure: same error whether the email or password is wrong.
    const generic = () => new AppError("unauthenticated", "Incorrect email or password");
    if (!user || user.status !== "active" || !user.passwordHash) throw generic();
    const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!ok) {
      await this.audit.write({ actorUserId: user.id, action: "auth.login_failed", resourceType: "user", resourceId: user.id, ip: ctx.ip, ua: ctx.ua });
      throw generic();
    }
    await this.db.update(s.users).set({ lastLoginAt: new Date() }).where(eq(s.users.id, user.id));
    const plan = await this.tokens.currentPlan(user.id);
    const pair = await this.tokens.issuePair(user, plan);
    await this.audit.write({ actorUserId: user.id, action: "auth.login", resourceType: "user", resourceId: user.id, ip: ctx.ip, ua: ctx.ua });
    return this.authPayload(user.id, pair);
  }

  async refresh(rawToken: string) {
    const { pair } = await this.tokens.rotate(rawToken);
    return { tokens: pair };
  }

  async logout(rawToken: string): Promise<void> { await this.tokens.revoke(rawToken); }
  async logoutAll(userId: string): Promise<void> { await this.tokens.revokeAllForUser(userId); }

  /**
   * Mail clients cannot open a custom scheme, so deployed links are https on
   * WEB_PUBLIC_URL (a universal/app link that hands off to the app, with a web
   * fallback). Development has no web host, so it keeps the direct deep link.
   */
  private linkFor(path: "verify" | "reset", token: string): string {
    const base = this.env.WEB_PUBLIC_URL;
    return base
      ? `${base.replace(/\/$/, "")}/${path}?token=${encodeURIComponent(token)}`
      : `medpilot://${path}?token=${encodeURIComponent(token)}`;
  }

  // ---- email verification ----------------------------------------------
  private async queueVerificationEmail(userId: string, to: string) {
    const raw = "vt_" + randomBytes(24).toString("base64url");
    await this.db.insert(s.verificationTokens).values({
      id: uuidv7(), userId, purpose: "email_verify",
      tokenHash: sha256(raw + this.env.APP_SECRET),
      expiresAt: new Date(Date.now() + 24 * 3600_000),
    });
    await this.email.send({
      to, subject: "Verify your MedPilot email",
      text: "Tap the button below to verify your email address. This link expires in 24 hours and can be used once.",
      actionUrl: this.linkFor("verify", raw),
      actionLabel: "Verify my email",
    });
  }

  async resendVerification(userId: string) {
    const [user] = await this.db.select().from(s.users).where(eq(s.users.id, userId)).limit(1);
    if (!user) throw AppError.unauthenticated();
    if (user.emailVerifiedAt) return; // idempotent no-op
    await this.queueVerificationEmail(userId, user.email);
  }

  async confirmVerification(rawToken: string) {
    const hash = sha256(rawToken + this.env.APP_SECRET);
    const [row] = await this.db.select().from(s.verificationTokens)
      .where(eq(s.verificationTokens.tokenHash, hash)).limit(1);
    if (!row || row.purpose !== "email_verify" || row.consumedAt || row.expiresAt.getTime() < Date.now()) {
      throw new AppError("bad_request", "This verification link is invalid or has expired");
    }
    await this.db.transaction(async (tx) => {
      await tx.update(s.verificationTokens).set({ consumedAt: new Date() }).where(eq(s.verificationTokens.id, row.id));
      await tx.update(s.users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(s.users.id, row.userId));
    });
  }

  async verificationStatus(userId: string) {
    const [u] = await this.db.select({ v: s.users.emailVerifiedAt }).from(s.users).where(eq(s.users.id, userId)).limit(1);
    return { emailVerified: !!u?.v };
  }

  // ---- password reset ----------------------------------------------------
  /** Always succeeds from the caller's perspective — no account enumeration. */
  async forgotPassword(emailAddr: string) {
    const user = await this.findActiveByEmail(emailAddr);
    if (!user) return;
    const raw = "pr_" + randomBytes(24).toString("base64url");
    await this.db.insert(s.verificationTokens).values({
      id: uuidv7(), userId: user.id, purpose: "password_reset",
      tokenHash: sha256(raw + this.env.APP_SECRET),
      expiresAt: new Date(Date.now() + 3600_000),
    });
    await this.email.send({
      to: user.email, subject: "Reset your MedPilot password",
      text: "Use the button below to choose a new password. This link expires in one hour and can be used once.",
      actionUrl: this.linkFor("reset", raw),
      actionLabel: "Choose a new password",
    });
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const hash = sha256(rawToken + this.env.APP_SECRET);
    const [row] = await this.db.select().from(s.verificationTokens)
      .where(eq(s.verificationTokens.tokenHash, hash)).limit(1);
    if (!row || row.purpose !== "password_reset" || row.consumedAt || row.expiresAt.getTime() < Date.now()) {
      throw new AppError("bad_request", "This reset link is invalid or has expired");
    }
    const passwordHash = await argon2.hash(newPassword, ARGON);
    await this.db.transaction(async (tx) => {
      await tx.update(s.verificationTokens).set({ consumedAt: new Date() }).where(eq(s.verificationTokens.id, row.id));
      await tx.update(s.users).set({ passwordHash, updatedAt: new Date() }).where(eq(s.users.id, row.userId));
    });
    await this.tokens.revokeAllForUser(row.userId); // password change ends every session
    await this.audit.write({ actorUserId: row.userId, action: "auth.password_reset", resourceType: "user", resourceId: row.userId });
  }

  // ---- shared response shape ---------------------------------------------
  async authPayload(userId: string, pair: { accessToken: string; refreshToken: string; expiresIn: number }) {
    const [user] = await this.db.select().from(s.users).where(eq(s.users.id, userId)).limit(1);
    const [profile] = await this.db.select().from(s.userProfiles).where(eq(s.userProfiles.userId, userId)).limit(1);
    const setup = await this.setupStatus(userId);
    return {
      user: { id: user!.id, email: user!.email, emailVerified: !!user!.emailVerifiedAt },
      profile: {
        firstName: profile?.firstName ?? "",
        lastName: profile?.lastName ?? "",
        fullName: profile ? `${profile.firstName} ${profile.lastName}` : "",
      },
      tokens: pair,
      setup,
    };
  }

  /** Server truth for the onboarding checklist (spec §04 J1). */
  async setupStatus(userId: string) {
    const [u] = await this.db.select({ hash: s.users.passwordHash, v: s.users.emailVerifiedAt })
      .from(s.users).where(eq(s.users.id, userId)).limit(1);
    const [{ n }] = (await this.db.execute(
      sql`select count(*)::int n from user_conditions where user_id = ${userId}`,
    )).rows as [{ n: number }];
    const [{ r }] = (await this.db.execute(
      sql`select count(*)::int r from medical_records where user_id = ${userId} and deleted_at is null`,
    )).rows as [{ r: number }];
    return {
      passwordSet: !!u?.hash,
      historyComplete: n > 0 || r > 0,
      emailVerified: !!u?.v,
    };
  }
}
