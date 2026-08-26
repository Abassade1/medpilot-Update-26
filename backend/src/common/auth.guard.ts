import { CanActivate, ExecutionContext, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "./errors";
import { loadEnv } from "../config/env";

export const IS_PUBLIC = "isPublic";
/** Marks a route as reachable without a bearer token. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = "roles";
export const Roles = (...roles: string[]) => SetMetadata(ROLES, roles);

export interface AccessClaims {
  sub: string;      // user id
  sid: string;      // refresh-chain id (session)
  role: string;
  plan: "basic" | "pro";
  ev: boolean;      // email verified
}

/**
 * Verifies the RS256 access token on every non-@Public route and enforces
 * @Roles where present. Ownership checks stay in services — this guard only
 * establishes *who* is calling.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw AppError.unauthenticated();

    let claims: AccessClaims;
    try {
      claims = jwt.verify(token, loadEnv().jwtPublicKey, {
        algorithms: ["RS256"], issuer: "medpilot", audience: "medpilot-app",
      }) as unknown as AccessClaims;
    } catch {
      throw AppError.unauthenticated("Your session has expired");
    }

    req.userId = claims.sub;
    req.userRole = claims.role;
    req.emailVerified = claims.ev;
    (req as any).claims = claims;

    const roles = this.reflector.getAllAndOverride<string[]>(ROLES, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (roles?.length && !roles.includes(claims.role)) throw AppError.forbidden();
    return true;
  }
}
