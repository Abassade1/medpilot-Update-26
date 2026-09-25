import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { validate } from "../../common/validate";
import { apiRoute } from "../../docs/registry";
import { ReviewsService } from "./reviews.service";
import { CreateReviewBody, ReviewsQuery } from "./reviews.schemas";

@Controller("v1/reviews")
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post() create(@Req() req: Request, @Body() body: unknown) { return this.reviews.create(req.userId!, validate(CreateReviewBody, body)); }
  @Get() list(@Query() q: unknown) { return this.reviews.list(validate(ReviewsQuery, q)); }
}

apiRoute({ method: "post", path: "/v1/reviews", tag: "bookings", summary: "Rate a completed appointment, transport, pet-clinic or specialist visit", auth: true, body: CreateReviewBody });
apiRoute({ method: "get", path: "/v1/reviews", tag: "catalog", summary: "Reviews for a hospital, transport provider, pet clinic or independent specialist", auth: true, query: ReviewsQuery });
