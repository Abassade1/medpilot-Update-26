import { Body, Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { z } from "zod";
import { validate } from "../../common/validate";
import { AuxService } from "./aux.service";
import { apiRoute } from "../../docs/registry";

const Uuid = z.string().uuid();
const TriageBody = z.object({
  symptomCode: z.string().max(40).optional(),
  sessionId: z.string().uuid().optional(),
  conditionCode: z.string().max(40).optional(),
});
const MealUrlBody = z.object({
  mimeType: z.enum(["image/jpeg", "image/png"]),
  sizeBytes: z.number().int().positive(),
});
const MealBody = z.object({ fileId: z.string().uuid() });
const TranslateBody = z.object({ locale: z.string().min(2).max(5) });
const EscalateBody = z.object({ kind: z.enum(["doctor", "hospital", "evacuation"]) });

@Controller("v1/aux")
export class AuxController {
  constructor(private readonly aux: AuxService) {}

  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @HttpCode(200)
  @Post("triage")
  triage(@Req() req: Request, @Body() body: unknown) {
    return this.aux.triageStep(req.userId!, validate(TriageBody, body));
  }

  @Get("sessions/:id")
  session(@Req() req: Request, @Param("id") id: string) {
    return this.aux.sessionResult(req.userId!, validate(Uuid, id));
  }

  @HttpCode(200)
  @Post("sessions/:id/translate")
  translate(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const { locale } = validate(TranslateBody, body);
    return this.aux.translate(req.userId!, validate(Uuid, id), locale);
  }

  @HttpCode(202)
  @Post("sessions/:id/escalate")
  escalate(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const { kind } = validate(EscalateBody, body);
    return this.aux.escalate(req.userId!, validate(Uuid, id), kind);
  }

  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Post("meals/upload-url")
  mealUrl(@Req() req: Request, @Body() body: unknown) {
    return this.aux.mealUploadUrl(req.userId!, validate(MealUrlBody, body));
  }

  @HttpCode(202)
  @Post("meals")
  meal(@Req() req: Request, @Body() body: unknown) {
    const { fileId } = validate(MealBody, body);
    return this.aux.createMeal(req.userId!, fileId);
  }

  @Get("meals/:id")
  getMeal(@Req() req: Request, @Param("id") id: string) {
    return this.aux.getMeal(req.userId!, validate(Uuid, id));
  }
}

apiRoute({ method: "post", path: "/v1/aux/triage", tag: "aux", summary: "Symptom funnel step (start or continue)", auth: true, body: TriageBody, status: 200 });
apiRoute({ method: "get", path: "/v1/aux/sessions/{id}", tag: "aux", summary: "Diagnosis result", auth: true });
apiRoute({ method: "post", path: "/v1/aux/sessions/{id}/translate", tag: "aux", summary: "Translate a result", auth: true, body: TranslateBody, status: 200 });
apiRoute({ method: "post", path: "/v1/aux/sessions/{id}/escalate", tag: "aux", summary: "Escalate to the care team", auth: true, body: EscalateBody, status: 202 });
apiRoute({ method: "post", path: "/v1/aux/meals/upload-url", tag: "aux", summary: "Phase 1: meal photo upload (quota-gated)", auth: true, body: MealUrlBody });
apiRoute({ method: "post", path: "/v1/aux/meals", tag: "aux", summary: "Phase 2: queue analysis", auth: true, body: MealBody, status: 202 });
apiRoute({ method: "get", path: "/v1/aux/meals/{id}", tag: "aux", summary: "Poll analysis result", auth: true });
