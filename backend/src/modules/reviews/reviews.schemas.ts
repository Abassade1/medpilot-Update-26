import { z } from "zod";

export const ReviewTargetType = z.enum(["hospital", "transport_provider", "pet_clinic", "independent_specialist"]);

export const CreateReviewBody = z.object({
  targetType: ReviewTargetType,
  requestId: z.string().uuid(),
  rating: z.number().int().min(1, "Choose a rating from 1 to 5").max(5, "Choose a rating from 1 to 5"),
  comment: z.string().trim().max(500).optional(),
});

export const ReviewsQuery = z.object({
  targetType: ReviewTargetType,
  targetId: z.string().uuid(),
});
