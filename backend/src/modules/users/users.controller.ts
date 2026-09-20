import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { z } from "zod";
import { validate } from "../../common/validate";
import { UsersService } from "./users.service";
import {
  BiometricBody, CreateRecordBody, PatchPreferencesBody, PatchProfileBody, PutConditionsBody,
  RecordUploadUrlBody, RegisterDeviceBody, SetPasswordBody, UpsertContactBody,
} from "./users.schemas";
import { apiRoute } from "../../docs/registry";

@Controller("v1/me")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get() me(@Req() req: Request) { return this.users.me(req.userId!); }

  @Get("setup-status") setup(@Req() req: Request) { return this.users.setupStatus(req.userId!); }

  @Get("preferences") preferences(@Req() req: Request) { return this.users.preferences(req.userId!); }

  @Patch("preferences")
  patchPreferences(@Req() req: Request, @Body() body: unknown) {
    return this.users.patchPreferences(req.userId!, validate(PatchPreferencesBody, body));
  }

  @Patch("profile")
  patchProfile(@Req() req: Request, @Body() body: unknown) {
    return this.users.patchProfile(req.userId!, validate(PatchProfileBody, body));
  }

  @HttpCode(200)
  @Post("password")
  setPassword(@Req() req: Request, @Body() body: unknown) {
    return this.users.setPassword(req.userId!, validate(SetPasswordBody, body));
  }

  @HttpCode(202)
  @Delete()
  async deleteAccount(@Req() req: Request) {
    await this.users.deleteAccount(req.userId!);
    return { message: "Your account is scheduled for deletion." };
  }

  @Get("conditions") myConditions(@Req() req: Request) { return this.users.myConditions(req.userId!); }

  @Put("conditions")
  putConditions(@Req() req: Request, @Body() body: unknown) {
    return this.users.putConditions(req.userId!, validate(PutConditionsBody, body));
  }

  @Get("emergency-contact")
  async contact(@Req() req: Request) {
    // wrapped: returning bare null yields an empty body over HTTP
    return { contact: await this.users.myContact(req.userId!) };
  }

  @Put("emergency-contact")
  async upsertContact(@Req() req: Request, @Body() body: unknown) {
    return { contact: await this.users.upsertContact(req.userId!, validate(UpsertContactBody, body)) };
  }

  @Get("records") records(@Req() req: Request) { return this.users.listRecords(req.userId!); }

  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @Post("records/upload-url")
  recordUploadUrl(@Req() req: Request, @Body() body: unknown) {
    return this.users.recordUploadUrl(req.userId!, validate(RecordUploadUrlBody, body));
  }

  @Post("records")
  createRecord(@Req() req: Request, @Body() body: unknown) {
    return this.users.createRecord(req.userId!, validate(CreateRecordBody, body));
  }

  @HttpCode(204)
  @Delete("records/:id")
  async deleteRecord(@Req() req: Request, @Param("id") id: string) {
    validate(z.string().uuid(), id);
    await this.users.deleteRecord(req.userId!, id);
  }

  @Post("devices")
  registerDevice(@Req() req: Request, @Body() body: unknown) {
    return this.users.registerDevice(req.userId!, validate(RegisterDeviceBody, body));
  }

  @Post("devices/biometric")
  biometric(@Req() req: Request, @Body() body: unknown) {
    return this.users.setBiometric(req.userId!, validate(BiometricBody, body));
  }
}

apiRoute({ method: "get", path: "/v1/me", tag: "me", summary: "Current user + profile", auth: true });
apiRoute({ method: "get", path: "/v1/me/setup-status", tag: "me", summary: "Onboarding checklist state (server truth)", auth: true });
apiRoute({ method: "patch", path: "/v1/me/profile", tag: "me", summary: "Edit profile / location", auth: true, body: PatchProfileBody });
apiRoute({ method: "post", path: "/v1/me/password", tag: "me", summary: "Set or change password (revokes other sessions)", auth: true, body: SetPasswordBody, status: 200 });
apiRoute({ method: "delete", path: "/v1/me", tag: "me", summary: "Request account deletion", auth: true, status: 202 });
apiRoute({ method: "get", path: "/v1/me/conditions", tag: "health-record", summary: "My recorded conditions", auth: true });
apiRoute({ method: "put", path: "/v1/me/conditions", tag: "health-record", summary: "Replace my conditions", auth: true, body: PutConditionsBody });
apiRoute({ method: "get", path: "/v1/me/emergency-contact", tag: "health-record", summary: "Current emergency contact", auth: true });
apiRoute({ method: "put", path: "/v1/me/emergency-contact", tag: "health-record", summary: "Create/update emergency contact", auth: true, body: UpsertContactBody });
apiRoute({ method: "get", path: "/v1/me/records", tag: "health-record", summary: "My uploaded medical records", auth: true });
apiRoute({ method: "post", path: "/v1/me/records/upload-url", tag: "health-record", summary: "Phase 1: presigned upload", auth: true, body: RecordUploadUrlBody });
apiRoute({ method: "post", path: "/v1/me/records", tag: "health-record", summary: "Phase 2: attach uploaded file", auth: true, body: CreateRecordBody });
apiRoute({ method: "delete", path: "/v1/me/records/{id}", tag: "health-record", summary: "Remove a record", auth: true, status: 204 });
apiRoute({ method: "post", path: "/v1/me/devices", tag: "me", summary: "Register device / push token", auth: true, body: RegisterDeviceBody });
apiRoute({ method: "post", path: "/v1/me/devices/biometric", tag: "me", summary: "Bind biometric unlock to a device", auth: true, body: BiometricBody });
apiRoute({ method: "get", path: "/v1/me/preferences", tag: "me", summary: "Notification and language preferences", auth: true });
apiRoute({ method: "patch", path: "/v1/me/preferences", tag: "me", summary: "Update preferences", auth: true, body: PatchPreferencesBody });
