import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { Public } from "../../common/auth.guard";
import { validate } from "../../common/validate";
import { BillingService } from "./billing.service";
import { NotificationsService } from "../notifications/notifications.service";
import { apiRoute } from "../../docs/registry";

const VerifyBody = z.object({
  platform: z.enum(["apple", "google"]),
  receipt: z.string().min(1).max(20_000),
  productId: z.string().min(1).max(80),
});
const ReadBody = z.object({ ids: z.union([z.literal("all"), z.array(z.string().uuid()).max(100)]) });

@Controller("v1")
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly notifications: NotificationsService,
  ) {}

  @Public()
  @Get("plans") plans() { return this.billing.listPlans(); }

  @Get("me/subscription") mine(@Req() req: Request) { return this.billing.mySubscription(req.userId!); }

  @HttpCode(200)
  @Post("me/subscription/verify")
  verify(@Req() req: Request, @Body() body: unknown) {
    return this.billing.verifyReceipt(req.userId!, validate(VerifyBody, body));
  }

  @Get("notifications") list(@Req() req: Request) { return this.notifications.list(req.userId!); }

  @HttpCode(200)
  @Post("notifications/read")
  read(@Req() req: Request, @Body() body: unknown) {
    const { ids } = validate(ReadBody, body);
    return this.notifications.markRead(req.userId!, ids);
  }
}

apiRoute({ method: "get", path: "/v1/plans", tag: "billing", summary: "Available plans", auth: false });
apiRoute({ method: "get", path: "/v1/me/subscription", tag: "billing", summary: "Current plan + quota usage", auth: true });
apiRoute({ method: "post", path: "/v1/me/subscription/verify", tag: "billing", summary: "Verify a store receipt and grant Pro", auth: true, body: VerifyBody, status: 200 });
apiRoute({ method: "get", path: "/v1/notifications", tag: "notifications", summary: "In-app inbox + unread count", auth: true });
apiRoute({ method: "post", path: "/v1/notifications/read", tag: "notifications", summary: "Mark notifications read", auth: true, body: ReadBody, status: 200 });
