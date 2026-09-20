ALTER TABLE "transport_requests" ADD COLUMN "pickup_city" varchar(80);--> statement-breakpoint
ALTER TABLE "transport_requests" ADD COLUMN "pickup_address" varchar(160);--> statement-breakpoint
ALTER TABLE "transport_requests" ADD COLUMN "dropoff_city" varchar(80);