import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { z } from "zod";
import { Public } from "../../common/auth.guard";
import { validate } from "../../common/validate";
import { AuthService } from "./auth.service";
import {
  AuthResponse, CheckEmailBody, ConfirmVerificationBody, ForgotBody,
  LoginBody, RefreshBody, RegisterBody, ResetBody, TokenPairShape,
} from "./auth.schemas";
import { apiRoute } from "../../docs/registry";

const ctxOf = (req: Request) => ({ ip: req.ip, ua: req.headers["user-agent"] });

@Controller("v1/auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post("register")
  register(@Body() body: unknown, @Req() req: Request) {
    return this.auth.register(validate(RegisterBody, body), ctxOf(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @HttpCode(200)
  @Post("login")
  login(@Body() body: unknown, @Req() req: Request) {
    const { email, password } = validate(LoginBody, body);
    return this.auth.login(email, password, ctxOf(req));
  }

  @Public()
  @HttpCode(200)
  @Post("refresh")
  refresh(@Body() body: unknown) {
    const { refreshToken } = validate(RefreshBody, body);
    return this.auth.refresh(refreshToken);
  }

  @HttpCode(204)
  @Post("logout")
  async logout(@Body() body: unknown) {
    const { refreshToken } = validate(RefreshBody, body);
    await this.auth.logout(refreshToken);
  }

  @HttpCode(204)
  @Post("logout-all")
  async logoutAll(@Req() req: Request) {
    await this.auth.logoutAll(req.userId!);
  }

  @Public()
  @HttpCode(200)
  @Post("check-email")
  async checkEmail(@Body() body: unknown) {
    const { email } = validate(CheckEmailBody, body);
    return { available: await this.auth.emailAvailable(email) };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @HttpCode(202)
  @Post("password/forgot")
  async forgot(@Body() body: unknown) {
    const { email } = validate(ForgotBody, body);
    await this.auth.forgotPassword(email);
    return { message: "If that account exists, a reset email is on its way." };
  }

  @Public()
  @HttpCode(204)
  @Post("password/reset")
  async reset(@Body() body: unknown) {
    const { token, password } = validate(ResetBody, body);
    await this.auth.resetPassword(token, password);
  }

  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @HttpCode(202)
  @Post("verification/resend")
  async resend(@Req() req: Request) {
    await this.auth.resendVerification(req.userId!);
    return { message: "Verification email sent." };
  }

  @Public()
  @HttpCode(204)
  @Post("verification/confirm")
  async confirm(@Body() body: unknown) {
    const { token } = validate(ConfirmVerificationBody, body);
    await this.auth.confirmVerification(token);
  }

  @Get("verification-status")
  status(@Req() req: Request) {
    return this.auth.verificationStatus(req.userId!);
  }
}

// ---- OpenAPI ---------------------------------------------------------------
apiRoute({ method: "post", path: "/v1/auth/register", tag: "auth", summary: "Create account", auth: false, body: RegisterBody, response: AuthResponse });
apiRoute({ method: "post", path: "/v1/auth/login", tag: "auth", summary: "Password sign-in", auth: false, body: LoginBody, response: AuthResponse, status: 200 });
apiRoute({ method: "post", path: "/v1/auth/refresh", tag: "auth", summary: "Rotate token pair", auth: false, body: RefreshBody, response: z.object({ tokens: TokenPairShape }), status: 200 });
apiRoute({ method: "post", path: "/v1/auth/logout", tag: "auth", summary: "Revoke this session", auth: true, body: RefreshBody, status: 204 });
apiRoute({ method: "post", path: "/v1/auth/logout-all", tag: "auth", summary: "Revoke every session", auth: true, status: 204 });
apiRoute({ method: "post", path: "/v1/auth/check-email", tag: "auth", summary: "Email availability", auth: false, body: CheckEmailBody, response: z.object({ available: z.boolean() }), status: 200 });
apiRoute({ method: "post", path: "/v1/auth/password/forgot", tag: "auth", summary: "Start password reset (always 202)", auth: false, body: ForgotBody, status: 202 });
apiRoute({ method: "post", path: "/v1/auth/password/reset", tag: "auth", summary: "Complete password reset", auth: false, body: ResetBody, status: 204 });
apiRoute({ method: "post", path: "/v1/auth/verification/resend", tag: "auth", summary: "Resend verification email", auth: true, status: 202 });
apiRoute({ method: "post", path: "/v1/auth/verification/confirm", tag: "auth", summary: "Confirm email from deep link", auth: false, body: ConfirmVerificationBody, status: 204 });
apiRoute({ method: "get", path: "/v1/auth/verification-status", tag: "auth", summary: "Poll email verification", auth: true, response: z.object({ emailVerified: z.boolean() }) });
