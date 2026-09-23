CREATE TABLE "listing_blackouts" (
	"listing_id" uuid NOT NULL,
	"day" varchar(10) NOT NULL,
	CONSTRAINT "listing_blackouts_listing_id_day_pk" PRIMARY KEY("listing_id","day")
);
--> statement-breakpoint
CREATE TABLE "listing_windows" (
	"id" uuid PRIMARY KEY NOT NULL,
	"listing_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider_id" uuid NOT NULL,
	"kind" varchar(10) NOT NULL,
	"category" varchar(40) DEFAULT '' NOT NULL,
	"subcategory" varchar(60) DEFAULT '' NOT NULL,
	"name" varchar(140) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_amount" integer,
	"price_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"price_type" varchar(12) DEFAULT 'fixed' NOT NULL,
	"duration_minutes" integer,
	"capacity" integer DEFAULT 1 NOT NULL,
	"location_modes" varchar(60) DEFAULT 'onsite' NOT NULL,
	"country" varchar(80),
	"region" varchar(80),
	"city" varchar(80),
	"service_radius_km" integer,
	"requirements" text DEFAULT '' NOT NULL,
	"preparation" text DEFAULT '' NOT NULL,
	"cancellation_policy" text DEFAULT '' NOT NULL,
	"terms" text DEFAULT '' NOT NULL,
	"attributes" text DEFAULT '{}' NOT NULL,
	"includes" text DEFAULT '[]' NOT NULL,
	"images" text DEFAULT '[]' NOT NULL,
	"status" varchar(12) DEFAULT 'draft' NOT NULL,
	"rejection_note" varchar(300),
	"published_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"phone" varchar(24),
	"email" varchar(254),
	"website" varchar(200),
	"address" varchar(200),
	"country" varchar(80),
	"region" varchar(80),
	"city" varchar(80),
	"service_areas" text DEFAULT '' NOT NULL,
	"operating_hours" varchar(300) DEFAULT '' NOT NULL,
	"languages" varchar(200) DEFAULT '' NOT NULL,
	"certifications" text DEFAULT '' NOT NULL,
	"logo_url" varchar(400),
	"cover_url" varchar(400),
	"verification_status" varchar(12) DEFAULT 'unverified' NOT NULL,
	"verification_info" varchar(300),
	"verification_note" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "listing_id" uuid;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "provider_id" uuid;--> statement-breakpoint
ALTER TABLE "listing_blackouts" ADD CONSTRAINT "listing_blackouts_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_windows" ADD CONSTRAINT "listing_windows_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_windows_ix" ON "listing_windows" USING btree ("listing_id","weekday");--> statement-breakpoint
CREATE INDEX "listings_provider_ix" ON "listings" USING btree ("provider_id","status");--> statement-breakpoint
CREATE INDEX "listings_discover_ix" ON "listings" USING btree ("status","category");--> statement-breakpoint
CREATE UNIQUE INDEX "providers_owner_uq" ON "providers" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "providers_type_ix" ON "providers" USING btree ("type");--> statement-breakpoint
CREATE INDEX "service_requests_provider_ix" ON "service_requests" USING btree ("provider_id","status");--> statement-breakpoint
CREATE INDEX "service_requests_slot_ix" ON "service_requests" USING btree ("listing_id","preferred_date");