import { Inject, Injectable } from "@nestjs/common";
import argon2 from "argon2";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";
import type { Db } from "../../db/client";
import { schema as s } from "../../db/client";
import { AppError } from "../../common/errors";
import { loadEnv } from "../../config/env";
import { AuthService } from "../auth/auth.service";
import { TokenService } from "../auth/token.service";
import { AuditService } from "../auth/audit.service";
import { StorageService, BUCKETS } from "../storage/storage.service";
import type {
  BiometricBody, CreateRecordBody, PatchProfileBody, PutConditionsBody,
  RecordUploadUrlBody, RegisterDeviceBody, SetPasswordBody, UpsertContactBody,
} from "./users.schemas";

const MAX_RECORDS = 8;
const MAX_RECORD_BYTES = 10 * 1024 * 1024;

@Injectable()
export class UsersService {
  private readonly env = loadEnv();
  constructor(
    @Inject("DB") private readonly db: Db,
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  // ---- profile -----------------------------------------------------------
  async me(userId: string) {
    const [user] = await this.db.select().from(s.users)
      .where(and(eq(s.users.id, userId), isNull(s.users.deletedAt))).limit(1);
    if (!user) throw AppError.unauthenticated();
    const [profile] = await this.db.select().from(s.userProfiles).where(eq(s.userProfiles.userId, userId)).limit(1);
    const plan = await this.tokens.currentPlan(userId);
    return {
      id: user.id,
      email: user.email,
      emailVerified: !!user.emailVerifiedAt,
      plan,
      profile: profile && {
        firstName: profile.firstName,
        lastName: profile.lastName,
        fullName: `${profile.firstName} ${profile.lastName}`,
        phone: profile.phoneE164,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        maritalStatus: profile.maritalStatus,
        locationLabel: profile.locationLabel,
        avatarAsset: "avatar", // v1 asset bridge until avatar upload ships a real file
      },
    };
  }

  async patchProfile(userId: string, input: z.infer<typeof PatchProfileBody>) {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (input.firstName !== undefined) set.firstName = input.firstName;
    if (input.lastName !== undefined) set.lastName = input.lastName;
    if (input.phone !== undefined) set.phoneE164 = input.phone;
    if (input.gender !== undefined) set.gender = input.gender;
    if (input.maritalStatus !== undefined) set.maritalStatus = input.maritalStatus;
    if (input.locationLabel !== undefined) set.locationLabel = input.locationLabel;
    if (input.locationCountry !== undefined) set.locationCountry = input.locationCountry;
    if (input.locationRegion !== undefined) set.locationRegion = input.locationRegion;
    await this.db.update(s.userProfiles).set(set).where(eq(s.userProfiles.userId, userId));
    return this.me(userId);
  }

  async setupStatus(userId: string) { return this.auth.setupStatus(userId); }

  /**
   * Sets the account password. Once a password exists, changing it requires
   * the current one; every other session is then revoked (spec §14).
   */
  async setPassword(userId: string, input: z.infer<typeof SetPasswordBody>) {
    const [user] = await this.db.select().from(s.users).where(eq(s.users.id, userId)).limit(1);
    if (!user) throw AppError.unauthenticated();
    if (user.passwordHash) {
      if (!input.currentPassword) {
        throw new AppError("validation_failed", "Current password is required", {
          fields: { currentPassword: "Current password is required" },
        });
      }
      const ok = await argon2.verify(user.passwordHash, input.currentPassword).catch(() => false);
      if (!ok) {
        throw new AppError("validation_failed", "Incorrect password", {
          fields: { currentPassword: "Incorrect password" },
        });
      }
    }
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
    await this.db.update(s.users).set({ passwordHash, updatedAt: new Date() }).where(eq(s.users.id, userId));
    await this.tokens.revokeAllForUser(userId);
    await this.audit.write({ actorUserId: userId, action: "user.password_set", resourceType: "user", resourceId: userId });
    // fresh pair so the current device stays signed in after the global revoke
    const plan = await this.tokens.currentPlan(userId);
    const pair = await this.tokens.issuePair(user, plan);
    return { tokens: pair };
  }

  async deleteAccount(userId: string) {
    // Soft-delete + anonymise PII; clinical rows retain under the pseudonymous id (spec §08).
    await this.db.transaction(async (tx) => {
      await tx.update(s.users).set({
        status: "deleted", deletedAt: new Date(),
        email: `deleted+${userId}@invalid.medpilot.app` as never,
        passwordHash: null, updatedAt: new Date(),
      }).where(eq(s.users.id, userId));
      await tx.update(s.userProfiles).set({
        firstName: "Deleted", lastName: "Member", phoneE164: "+0000000000",
        locationLabel: null, updatedAt: new Date(),
      }).where(eq(s.userProfiles.userId, userId));
    });
    await this.tokens.revokeAllForUser(userId);
    await this.audit.write({ actorUserId: userId, action: "user.delete_requested", resourceType: "user", resourceId: userId });
  }

  // ---- conditions ----------------------------------------------------------
  async listConditionsReference() {
    return this.db.select({ id: s.conditions.id, code: s.conditions.code, label: s.conditions.label })
      .from(s.conditions).where(eq(s.conditions.active, true)).orderBy(asc(s.conditions.sortOrder));
  }

  async myConditions(userId: string) {
    return this.db.select({ id: s.conditions.id, code: s.conditions.code, label: s.conditions.label })
      .from(s.userConditions)
      .innerJoin(s.conditions, eq(s.conditions.id, s.userConditions.conditionId))
      .where(eq(s.userConditions.userId, userId))
      .orderBy(asc(s.conditions.sortOrder));
  }

  /** Replace-set semantics, matching the screen's single Proceed action. */
  async putConditions(userId: string, input: z.infer<typeof PutConditionsBody>) {
    if (input.conditionIds.length) {
      const known = await this.db.select({ id: s.conditions.id }).from(s.conditions)
        .where(eq(s.conditions.active, true));
      const valid = new Set(known.map((k) => k.id));
      for (const cid of input.conditionIds) {
        if (!valid.has(cid)) throw new AppError("validation_failed", "Unknown condition selected");
      }
    }
    await this.db.transaction(async (tx) => {
      await tx.delete(s.userConditions).where(eq(s.userConditions.userId, userId));
      if (input.conditionIds.length) {
        await tx.insert(s.userConditions).values(input.conditionIds.map((conditionId) => ({ userId, conditionId })));
      }
    });
    await this.audit.write({ actorUserId: userId, action: "phi.conditions_updated", resourceType: "user_conditions", resourceId: userId });
    return this.myConditions(userId);
  }

  // ---- emergency contact ---------------------------------------------------
  async myContact(userId: string) {
    const [c] = await this.db.select().from(s.emergencyContacts).where(eq(s.emergencyContacts.userId, userId)).limit(1);
    return c ? {
      id: c.id, firstName: c.firstName, lastName: c.lastName,
      phone: c.phoneE164, relationship: c.relationship,
    } : null;
  }

  async upsertContact(userId: string, input: z.infer<typeof UpsertContactBody>) {
    const existing = await this.myContact(userId);
    if (existing) {
      await this.db.update(s.emergencyContacts).set({
        firstName: input.firstName, lastName: input.lastName,
        phoneE164: input.phone, relationship: input.relationship, updatedAt: new Date(),
      }).where(eq(s.emergencyContacts.userId, userId));
      return (await this.myContact(userId))!;
    }
    await this.db.insert(s.emergencyContacts).values({
      id: uuidv7(), userId, firstName: input.firstName, lastName: input.lastName,
      phoneE164: input.phone, relationship: input.relationship,
    });
    return (await this.myContact(userId))!;
  }

  // ---- medical records -----------------------------------------------------
  async listRecords(userId: string) {
    const rows = await this.db.select({
      r: s.medicalRecords, f: s.files,
    }).from(s.medicalRecords)
      .innerJoin(s.files, eq(s.files.id, s.medicalRecords.fileId))
      .where(and(eq(s.medicalRecords.userId, userId), isNull(s.medicalRecords.deletedAt)))
      .orderBy(desc(s.medicalRecords.createdAt));
    return rows.map(({ r, f }) => ({
      id: r.id,
      displayName: r.displayName,
      kind: r.kind,
      source: r.source,
      status: r.status,
      sizeBytes: f.sizeBytes,
      downloadUrl: r.status === "ready" ? this.storage.signedDownloadUrl(f) : null,
      createdAt: r.createdAt,
    }));
  }

  async recordUploadUrl(userId: string, input: z.infer<typeof RecordUploadUrlBody>) {
    const existing = await this.listRecords(userId);
    if (existing.length >= MAX_RECORDS) {
      throw new AppError("validation_failed", `You can upload up to ${MAX_RECORDS} files`);
    }
    return this.storage.createUploadTicket({
      ownerUserId: userId, bucket: BUCKETS.phi,
      mimeType: input.mimeType, sizeBytes: input.sizeBytes,
      maxBytes: MAX_RECORD_BYTES,
      allowed: [
        "application/pdf", "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/jpeg", "image/png",
      ],
    });
  }

  async createRecord(userId: string, input: z.infer<typeof CreateRecordBody>) {
    const file = await this.storage.assertStored(input.fileId, userId);
    const kind = file.mimeType === "application/pdf" ? "pdf"
      : file.mimeType.startsWith("image/") ? "image" : "doc";
    const id = uuidv7();
    await this.db.insert(s.medicalRecords).values({
      id, userId, fileId: file.id, displayName: input.displayName,
      kind, source: input.source, status: "ready",
    });
    await this.db.insert(s.activities).values({
      id: uuidv7(), userId, type: "record",
      title: "Medical record uploaded", subtitle: input.displayName.slice(0, 190),
      status: "completed", targetType: "medical_record", targetId: id,
    });
    await this.audit.write({ actorUserId: userId, action: "phi.record_created", resourceType: "medical_record", resourceId: id });
    return (await this.listRecords(userId)).find((r) => r.id === id)!;
  }

  async deleteRecord(userId: string, recordId: string) {
    const [r] = await this.db.select().from(s.medicalRecords)
      .where(and(eq(s.medicalRecords.id, recordId), isNull(s.medicalRecords.deletedAt))).limit(1);
    if (!r) throw AppError.notFound("Record");
    if (r.userId !== userId) throw AppError.notFound("Record"); // 404, not 403 — don't confirm existence
    await this.db.update(s.medicalRecords).set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(s.medicalRecords.id, recordId));
    await this.storage.deleteObject(r.fileId);
    await this.audit.write({ actorUserId: userId, action: "phi.record_deleted", resourceType: "medical_record", resourceId: recordId });
  }

  // ---- devices -------------------------------------------------------------
  async registerDevice(userId: string, input: z.infer<typeof RegisterDeviceBody>) {
    const [existing] = await this.db.select().from(s.devices)
      .where(and(eq(s.devices.userId, userId), eq(s.devices.installId, input.installId))).limit(1);
    if (existing) {
      await this.db.update(s.devices).set({
        pushToken: input.pushToken ?? existing.pushToken, lastSeenAt: new Date(), updatedAt: new Date(),
      }).where(eq(s.devices.id, existing.id));
      return { id: existing.id };
    }
    const id = uuidv7();
    await this.db.insert(s.devices).values({
      id, userId, platform: input.platform, installId: input.installId, pushToken: input.pushToken ?? null,
    });
    return { id };
  }

  async setBiometric(userId: string, input: z.infer<typeof BiometricBody>) {
    const [user] = await this.db.select({ hash: s.users.passwordHash }).from(s.users).where(eq(s.users.id, userId)).limit(1);
    if (input.enabled && !user?.hash) {
      // biometric unlock guards a stored session; a password must exist first (spec §14)
      throw new AppError("validation_failed", "Set a password before enabling biometric unlock");
    }
    const [device] = await this.db.select().from(s.devices)
      .where(and(eq(s.devices.userId, userId), eq(s.devices.installId, input.installId))).limit(1);
    if (!device) throw AppError.notFound("Device");
    await this.db.update(s.devices).set({
      biometricEnabled: input.enabled,
      biometricPubkey: input.enabled ? input.publicKey ?? null : null,
      updatedAt: new Date(),
    }).where(eq(s.devices.id, device.id));
    await this.audit.write({ actorUserId: userId, action: "device.biometric", resourceType: "device", resourceId: device.id, metadata: { enabled: input.enabled } });
    return { enabled: input.enabled };
  }
}
