import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";
import type { Db } from "../../db/client";
import { schema as s } from "../../db/client";
import { AppError } from "../../common/errors";
import { AuditService } from "../auth/audit.service";
import type { CreateReviewBody, ReviewsQuery } from "./reviews.schemas";

const utcToday = () => new Date().toISOString().slice(0, 10);

@Injectable()
export class ReviewsService {
  constructor(@Inject("DB") private readonly db: Db, private readonly audit: AuditService) {}

  /** Resolves the booking behind a review, checking ownership and that it's actually finished. */
  private async eligibleBooking(userId: string, targetType: z.infer<typeof CreateReviewBody>["targetType"], requestId: string) {
    const today = utcToday();
    const notReady = () => new AppError("conflict", "You can leave a review once your visit is complete");

    if (targetType === "hospital") {
      const [a] = await this.db.select().from(s.appointmentRequests).where(eq(s.appointmentRequests.id, requestId)).limit(1);
      if (!a || a.userId !== userId) throw AppError.notFound("Appointment");
      if (!(a.status === "completed" || (a.status === "confirmed" && a.requestedDate < today))) throw notReady();
      return { requestType: "appointment", targetId: a.hospitalId };
    }
    if (targetType === "transport_provider") {
      const [t] = await this.db.select().from(s.transportRequests).where(eq(s.transportRequests.id, requestId)).limit(1);
      if (!t || t.userId !== userId) throw AppError.notFound("Transport booking");
      if (!(t.status === "completed" || (t.status === "confirmed" && t.pickupDate < today))) throw notReady();
      return { requestType: "transport", targetId: t.providerId };
    }
    const [r] = await this.db.select().from(s.serviceRequests).where(eq(s.serviceRequests.id, requestId)).limit(1);
    if (!r || r.userId !== userId || r.targetType !== targetType) throw AppError.notFound("Request");
    if (!(r.status === "completed" || (r.status === "confirmed" && !!r.preferredDate && r.preferredDate < today))) throw notReady();
    return { requestType: "service_request", targetId: r.targetId };
  }

  async create(userId: string, input: z.infer<typeof CreateReviewBody>) {
    const { requestType, targetId } = await this.eligibleBooking(userId, input.targetType, input.requestId);

    const [existing] = await this.db.select({ id: s.reviews.id }).from(s.reviews)
      .where(and(eq(s.reviews.requestType, requestType), eq(s.reviews.requestId, input.requestId))).limit(1);
    if (existing) throw new AppError("conflict", "You've already reviewed this");

    const id = uuidv7();
    await this.db.insert(s.reviews).values({
      id, userId, targetType: input.targetType, targetId, requestType, requestId: input.requestId,
      rating: input.rating, comment: input.comment?.trim() || null,
    });
    await this.recompute(input.targetType, targetId);
    await this.audit.write({ actorUserId: userId, action: "review.created", resourceType: "review", resourceId: id });
    return { id, rating: input.rating };
  }

  /** Recomputes the target's displayed rating as the average of every review it has. */
  private async recompute(targetType: string, targetId: string) {
    const [row] = (await this.db.execute(
      sql`select coalesce(round(avg(rating)::numeric, 1), 0)::text as avg from reviews where target_type = ${targetType} and target_id = ${targetId}`,
    )).rows as [{ avg: string }];
    const rating = row!.avg;
    switch (targetType) {
      case "hospital": await this.db.update(s.hospitals).set({ rating }).where(eq(s.hospitals.id, targetId)); break;
      case "transport_provider": await this.db.update(s.transportProviders).set({ rating }).where(eq(s.transportProviders.id, targetId)); break;
      case "pet_clinic": await this.db.update(s.petClinics).set({ rating }).where(eq(s.petClinics.id, targetId)); break;
      case "independent_specialist": await this.db.update(s.independentSpecialists).set({ rating }).where(eq(s.independentSpecialists.id, targetId)); break;
    }
  }

  async list(q: z.infer<typeof ReviewsQuery>) {
    const rows = await this.db.select({ r: s.reviews, firstName: s.userProfiles.firstName, lastName: s.userProfiles.lastName })
      .from(s.reviews).leftJoin(s.userProfiles, eq(s.userProfiles.userId, s.reviews.userId))
      .where(and(eq(s.reviews.targetType, q.targetType), eq(s.reviews.targetId, q.targetId)))
      .orderBy(desc(s.reviews.createdAt)).limit(50);
    return rows.map(({ r, firstName, lastName }) => ({
      id: r.id, rating: r.rating, comment: r.comment,
      reviewer: firstName ? `${firstName} ${(lastName ?? "").slice(0, 1)}.` : "Member",
      createdAt: r.createdAt,
    }));
  }
}
