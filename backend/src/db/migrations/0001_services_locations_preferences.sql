ALTER TYPE "public"."ai_kind" ADD VALUE 'chat';--> statement-breakpoint
CREATE TABLE "independent_services" (
	"id" uuid PRIMARY KEY NOT NULL,
	"specialist_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" varchar(300) DEFAULT '' NOT NULL,
	"price_amount" bigint,
	"price_currency" char(3) DEFAULT 'USD' NOT NULL,
	"duration_label" varchar(40) DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "independent_specialists" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"role" varchar(120) NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"rating" numeric(2, 1) DEFAULT '0' NOT NULL,
	"location_label" varchar(120) DEFAULT '' NOT NULL,
	"languages" varchar(120) DEFAULT 'English' NOT NULL,
	"years_experience" integer,
	"availability_label" varchar(120) DEFAULT '' NOT NULL,
	"photo_asset" varchar(80),
	"verified" boolean DEFAULT false NOT NULL,
	"accepting_requests" boolean DEFAULT true NOT NULL,
	"status" "catalog_status" DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"parent_id" uuid,
	"level" varchar(10) NOT NULL,
	"name" varchar(120) NOT NULL,
	"code" varchar(10),
	"aliases" varchar(200) DEFAULT '' NOT NULL,
	"has_airport" boolean DEFAULT false NOT NULL,
	"has_helipad" boolean DEFAULT false NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pet_services" (
	"id" uuid PRIMARY KEY NOT NULL,
	"clinic_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" varchar(300) DEFAULT '' NOT NULL,
	"kind" varchar(12) DEFAULT 'appointment' NOT NULL,
	"price_amount" bigint,
	"price_currency" char(3) DEFAULT 'USD' NOT NULL,
	"duration_label" varchar(40) DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" varchar(20) NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(24) NOT NULL,
	"target_type" varchar(24) NOT NULL,
	"target_id" uuid NOT NULL,
	"service_id" uuid,
	"preferred_date" date,
	"end_date" date,
	"preferred_time" varchar(5),
	"message" varchar(500),
	"details" text,
	"status" varchar(12) DEFAULT 'pending' NOT NULL,
	"cancelled_reason" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transport_provider_coverage" (
	"provider_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	CONSTRAINT "transport_provider_coverage_provider_id_location_id_pk" PRIMARY KEY("provider_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"email_updates" boolean DEFAULT true NOT NULL,
	"appointment_reminders" boolean DEFAULT true NOT NULL,
	"language" varchar(8) DEFAULT 'en' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_requests" ADD COLUMN "requested_time" varchar(5);--> statement-breakpoint
ALTER TABLE "independent_services" ADD CONSTRAINT "independent_services_specialist_id_independent_specialists_id_fk" FOREIGN KEY ("specialist_id") REFERENCES "public"."independent_specialists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "independent_specialists" ADD CONSTRAINT "independent_specialists_category_id_independent_specialist_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."independent_specialist_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_locations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_services" ADD CONSTRAINT "pet_services_clinic_id_pet_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."pet_clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_provider_coverage" ADD CONSTRAINT "transport_provider_coverage_provider_id_transport_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."transport_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_provider_coverage" ADD CONSTRAINT "transport_provider_coverage_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "indep_services_spec_ix" ON "independent_services" USING btree ("specialist_id","sort_order");--> statement-breakpoint
CREATE INDEX "indep_spec_cat_ix" ON "independent_specialists" USING btree ("category_id","status");--> statement-breakpoint
CREATE INDEX "locations_parent_ix" ON "locations" USING btree ("parent_id","sort_order");--> statement-breakpoint
CREATE INDEX "pet_services_clinic_ix" ON "pet_services" USING btree ("clinic_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "service_requests_reference_uq" ON "service_requests" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "service_requests_user_ix" ON "service_requests" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "coverage_location_ix" ON "transport_provider_coverage" USING btree ("location_id");