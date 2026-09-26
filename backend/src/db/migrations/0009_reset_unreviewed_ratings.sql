-- Ratings used to be seeded by hand. A rating is now only ever an average of member reviews,
-- and 0 means "no reviews yet", so clear every rating that has no reviews behind it.
UPDATE "hospitals" SET "rating" = 0 WHERE NOT EXISTS (SELECT 1 FROM "reviews" r WHERE r."target_type" = 'hospital' AND r."target_id" = "hospitals"."id");--> statement-breakpoint
UPDATE "transport_providers" SET "rating" = 0 WHERE NOT EXISTS (SELECT 1 FROM "reviews" r WHERE r."target_type" = 'transport_provider' AND r."target_id" = "transport_providers"."id");--> statement-breakpoint
UPDATE "pet_clinics" SET "rating" = 0 WHERE NOT EXISTS (SELECT 1 FROM "reviews" r WHERE r."target_type" = 'pet_clinic' AND r."target_id" = "pet_clinics"."id");--> statement-breakpoint
UPDATE "independent_specialists" SET "rating" = 0 WHERE NOT EXISTS (SELECT 1 FROM "reviews" r WHERE r."target_type" = 'independent_specialist' AND r."target_id" = "independent_specialists"."id");--> statement-breakpoint
-- Never shown any more (packages use their hospital's rating; hospital specialists have none).
UPDATE "specialists" SET "rating" = 0;--> statement-breakpoint
UPDATE "medical_packages" SET "rating" = 0;
