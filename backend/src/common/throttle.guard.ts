import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Request } from "express";
import { loadEnv } from "../config/env";

/**
 * Rate limiting is disabled under NODE_ENV=test so the suite can drive many
 * requests from one IP. Limits are exercised against a running server instead
 * (see README "verifying rate limits"). Keyed by authenticated user when
 * available, falling back to IP for anonymous endpoints.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private readonly env = loadEnv();

  protected async shouldSkip(): Promise<boolean> {
    return this.env.NODE_ENV === "test";
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const r = req as Request;
    return r.userId ?? r.ip ?? "anonymous";
  }
}
