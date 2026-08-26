CREATE TYPE "public"."activity_status" AS ENUM('completed', 'booked', 'cancelled', 'pending');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('appointment', 'transport', 'diagnosis', 'meal', 'record', 'plan');--> statement-breakpoint
CREATE TYPE "public"."actor_type" AS ENUM('user', 'staff', 'system');--> statement-breakpoint
CREATE TYPE "public"."ai_kind" AS ENUM('triage', 'meal');--> statement-breakpoint
CREATE TYPE "public"."ai_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."ai_status" AS ENUM('active', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('pending', 'confirmed', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."appointment_type" AS ENUM('general_checkup', 'specialist_consultation', 'surgery');--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('google', 'amazon', 'apple');--> statement-breakpoint
CREATE TYPE "public"."catalog_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."file_scan" AS ENUM('pending', 'clean', 'infected');--> statement-breakpoint
CREATE TYPE "public"."file_visibility" AS ENUM('private', 'public');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'undisclosed');--> statement-breakpoint
CREATE TYPE "public"."marital_status" AS ENUM('single', 'married', 'divorced', 'widowed');--> statement-breakpoint
CREATE TYPE "public"."meal_status" AS ENUM('queued', 'processing', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."pet_category" AS ENUM('vet', 'pedicure', 'sitters');--> statement-breakpoint
CREATE TYPE "public"."plan_code" AS ENUM('basic', 'pro');--> statement-breakpoint
CREATE TYPE "public"."plan_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('ios', 'android');--> statement-breakpoint
CREATE TYPE "public"."record_kind" AS ENUM('pdf', 'doc', 'image');--> statement-breakpoint
CREATE TYPE "public"."record_source" AS ENUM('upload', 'camera_scan');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('uploading', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."relationship" AS ENUM('partner', 'parent', 'sibling', 'friend', 'other');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('routine', 'urgent', 'emergency');--> statement-breakpoint
CREATE TYPE "public"."site_type" AS ENUM('airport', 'helipad');--> statement-breakpoint
CREATE TYPE "public"."sub_source" AS ENUM('apple', 'google', 'complimentary');--> statement-breakpoint
CREATE TYPE "public"."sub_status" AS ENUM('active', 'grace', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transport_category" AS ENUM('jet', 'ambulance', 'boat');--> statement-breakpoint
CREATE TYPE "public"."transport_status" AS ENUM('pending', 'confirmed', 'in_transit', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."usage_metric" AS ENUM('meal_analysis', 'clinic_access', 'evacuation');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('member', 'staff', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."vtoken_purpose" AS ENUM('email_verify', 'password_reset');--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "auth_provider" NOT NULL,
	"provider_user_id" varchar(255) NOT NULL,
	"email_at_link" "citext",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"install_id" varchar(128) NOT NULL,
	"push_token" varchar(255),
	"biometric_enabled" boolean DEFAULT false NOT NULL,
	"biometric_pubkey" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid,
	"token_hash" char(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"first_name" varchar(40) NOT NULL,
	"last_name" varchar(40) NOT NULL,
	"phone_e164" varchar(20) NOT NULL,
	"phone_country" char(2) DEFAULT 'CA' NOT NULL,
	"date_of_birth" date NOT NULL,
	"gender" "gender",
	"marital_status" "marital_status",
	"location_label" varchar(80),
	"location_country" char(2),
	"location_region" varchar(80),
	"avatar_file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" "citext" NOT NULL,
	"email_verified_at" timestamp with time zone,
	"password_hash" text,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "vtoken_purpose" NOT NULL,
	"token_hash" char(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_user_id" uuid,
	"actor_type" text DEFAULT 'user' NOT NULL,
	"action" varchar(60) NOT NULL,
	"resource_type" varchar(60) NOT NULL,
	"resource_id" uuid,
	"ip" varchar(45),
	"user_agent" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conditions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(40) NOT NULL,
	"label" varchar(80) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "conditions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "emergency_contacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"first_name" varchar(40) NOT NULL,
	"last_name" varchar(40) NOT NULL,
	"phone_e164" varchar(20) NOT NULL,
	"relationship" "relationship" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_user_id" uuid,
	"bucket" varchar(63) NOT NULL,
	"object_key" varchar(512) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"checksum_sha256" char(64),
	"scan_status" "file_scan" DEFAULT 'pending' NOT NULL,
	"visibility" "file_visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "medical_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"kind" "record_kind" NOT NULL,
	"source" "record_source" DEFAULT 'upload' NOT NULL,
	"status" "record_status" DEFAULT 'uploading' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_conditions" (
	"user_id" uuid NOT NULL,
	"condition_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_conditions_user_id_condition_id_pk" PRIMARY KEY("user_id","condition_id")
);
--> statement-breakpoint
CREATE TABLE "aircraft" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"capacity_label" varchar(120) DEFAULT '' NOT NULL,
	"capacity_note" varchar(120),
	"medical_crew" varchar(120),
	"medical_crew_note" varchar(120),
	"paramedic_label" varchar(120),
	"max_altitude_m" varchar(40),
	"max_altitude_ft" varchar(40),
	"price_amount" bigint,
	"price_currency" char(3) DEFAULT 'USD' NOT NULL,
	"hero_asset" varchar(80),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aircraft_facilities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"aircraft_id" uuid NOT NULL,
	"label" varchar(120) NOT NULL,
	"image_asset" varchar(80),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hospital_specialists" (
	"hospital_id" uuid NOT NULL,
	"specialist_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "hospital_specialists_hospital_id_specialist_id_pk" PRIMARY KEY("hospital_id","specialist_id")
);
--> statement-breakpoint
CREATE TABLE "hospitals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"specialty" varchar(120) NOT NULL,
	"country_code" char(2) NOT NULL,
	"country_label" varchar(80) NOT NULL,
	"city" varchar(80),
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"logo_file_id" uuid,
	"logo_asset" varchar(80),
	"rating" numeric(2, 1) DEFAULT '0' NOT NULL,
	"specialist_count" integer DEFAULT 0 NOT NULL,
	"about" text DEFAULT '' NOT NULL,
	"care_system" varchar(120) DEFAULT '' NOT NULL,
	"open_hours" varchar(80) DEFAULT '' NOT NULL,
	"open_hours_note" varchar(80),
	"helipad_code" varchar(40),
	"accredited" boolean DEFAULT false NOT NULL,
	"bookable" boolean DEFAULT true NOT NULL,
	"status" "catalog_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hospitals_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "independent_specialist_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" varchar(80) NOT NULL,
	"count_label" varchar(40) NOT NULL,
	"image_asset" varchar(80),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_packages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" varchar(80) NOT NULL,
	"title" varchar(160) NOT NULL,
	"hospital_id" uuid NOT NULL,
	"transport_provider_id" uuid,
	"price_amount" bigint NOT NULL,
	"price_currency" char(3) DEFAULT 'USD' NOT NULL,
	"price_label" varchar(20) NOT NULL,
	"location_label" varchar(120) DEFAULT '' NOT NULL,
	"rating" numeric(2, 1) DEFAULT '0' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"hero_asset" varchar(80),
	"status" "catalog_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "medical_packages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "package_inclusions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"package_id" uuid NOT NULL,
	"label" varchar(80) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pet_clinics" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"category" "pet_category" NOT NULL,
	"location" varchar(120) DEFAULT '' NOT NULL,
	"rating" numeric(2, 1) DEFAULT '0' NOT NULL,
	"price_from_amount" bigint,
	"price_from_currency" char(3) DEFAULT 'USD' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"open_to" varchar(200) DEFAULT '' NOT NULL,
	"logo_emoji" varchar(8),
	"hero_asset" varchar(80),
	"verified" boolean DEFAULT false NOT NULL,
	"status" "catalog_status" DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_slides" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" varchar(120) NOT NULL,
	"subtitle" varchar(160) NOT NULL,
	"price_label" varchar(20),
	"package_id" uuid,
	"image_asset" varchar(80),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active_from" timestamp with time zone,
	"active_to" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(40) NOT NULL,
	"title" varchar(80) NOT NULL,
	"description" varchar(160) NOT NULL,
	"color_hex" char(7) NOT NULL,
	"image_asset" varchar(80),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "service_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "specialists" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" varchar(120) NOT NULL,
	"short_name" varchar(60) NOT NULL,
	"role" varchar(120) NOT NULL,
	"specialization" varchar(160),
	"experience_label" varchar(80),
	"operation_country" varchar(80),
	"other_countries" varchar(160),
	"languages" varchar(160),
	"expertise" text[] DEFAULT '{}' NOT NULL,
	"rating" numeric(2, 1) DEFAULT '0' NOT NULL,
	"photo_asset" varchar(80),
	"available" boolean DEFAULT true NOT NULL,
	"certified" boolean DEFAULT false NOT NULL,
	"status" "catalog_status" DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transport_providers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"category" "transport_category" NOT NULL,
	"location" varchar(120) DEFAULT '' NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"rating" numeric(2, 1) DEFAULT '0' NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"price_from_amount" bigint,
	"price_from_currency" char(3) DEFAULT 'USD' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"routes" text DEFAULT '' NOT NULL,
	"tags" varchar(160) DEFAULT '' NOT NULL,
	"hero_asset" varchar(80),
	"logo_asset" varchar(80),
	"status" "catalog_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "activity_type" NOT NULL,
	"title" varchar(160) NOT NULL,
	"subtitle" varchar(200),
	"status" "activity_status",
	"target_type" varchar(40),
	"target_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" varchar(20) NOT NULL,
	"user_id" uuid NOT NULL,
	"hospital_id" uuid NOT NULL,
	"package_id" uuid,
	"appointment_type" "appointment_type" NOT NULL,
	"requested_date" date NOT NULL,
	"under_treatment" boolean NOT NULL,
	"condition_note" varchar(200),
	"emergency_contact_id" uuid,
	"contact_accompanies" boolean DEFAULT false NOT NULL,
	"status" "appointment_status" DEFAULT 'pending' NOT NULL,
	"assigned_staff_name" varchar(120),
	"assigned_staff_role" varchar(120),
	"scheduled_at" timestamp with time zone,
	"cancelled_reason" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" varchar(80) NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" varchar(80) NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_user_id_endpoint_key_pk" PRIMARY KEY("user_id","endpoint","key")
);
--> statement-breakpoint
CREATE TABLE "special_needs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(40) NOT NULL,
	"label" varchar(120) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "special_needs_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "transport_purposes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(40) NOT NULL,
	"label" varchar(120) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "transport_purposes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "transport_request_needs" (
	"request_id" uuid NOT NULL,
	"need_id" uuid NOT NULL,
	CONSTRAINT "transport_request_needs_request_id_need_id_pk" PRIMARY KEY("request_id","need_id")
);
--> statement-breakpoint
CREATE TABLE "transport_request_purposes" (
	"request_id" uuid NOT NULL,
	"purpose_id" uuid NOT NULL,
	CONSTRAINT "transport_request_purposes_request_id_purpose_id_pk" PRIMARY KEY("request_id","purpose_id")
);
--> statement-breakpoint
CREATE TABLE "transport_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" varchar(20) NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"aircraft_id" uuid,
	"pickup_date" date NOT NULL,
	"pickup_time" time,
	"pickup_country" varchar(80) NOT NULL,
	"pickup_region" varchar(80),
	"pickup_site_type" "site_type" NOT NULL,
	"pickup_site_code" varchar(20),
	"pickup_lat" numeric(9, 6),
	"pickup_lng" numeric(9, 6),
	"dropoff_country" varchar(80) NOT NULL,
	"dropoff_region" varchar(80),
	"dropoff_site_type" "site_type" NOT NULL,
	"dropoff_site_code" varchar(20),
	"return_trip" boolean DEFAULT false NOT NULL,
	"other_purpose" varchar(200),
	"other_need" varchar(200),
	"emergency_contact_id" uuid,
	"contact_accompanies" boolean DEFAULT false NOT NULL,
	"status" "transport_status" DEFAULT 'pending' NOT NULL,
	"flight_number" varchar(20),
	"depart_at" timestamp with time zone,
	"arrive_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "ai_role" NOT NULL,
	"content" text NOT NULL,
	"content_translated" text,
	"audio_file_id" uuid,
	"token_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "ai_kind" NOT NULL,
	"status" "ai_status" DEFAULT 'active' NOT NULL,
	"model_version" varchar(60) NOT NULL,
	"disclaimer_version" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "meal_analyses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"image_file_id" uuid NOT NULL,
	"status" "meal_status" DEFAULT 'queued' NOT NULL,
	"calories_estimate" integer,
	"baseline_delta_pct" numeric(5, 2),
	"failure_reason" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "meal_details" (
	"id" uuid PRIMARY KEY NOT NULL,
	"analysis_id" uuid NOT NULL,
	"code" varchar(30) NOT NULL,
	"label" varchar(80) NOT NULL,
	"body" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_segments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"analysis_id" uuid NOT NULL,
	"label" varchar(60) NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"color_hex" char(7) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(60) NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" varchar(500) NOT NULL,
	"data" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" "plan_code" NOT NULL,
	"name" varchar(60) NOT NULL,
	"price_amount" bigint NOT NULL,
	"price_currency" char(3) DEFAULT 'USD' NOT NULL,
	"interval" "plan_interval" DEFAULT 'month' NOT NULL,
	"apple_product_id" varchar(80),
	"google_product_id" varchar(80),
	"features" text[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "sub_status" DEFAULT 'active' NOT NULL,
	"source" "sub_source" NOT NULL,
	"original_transaction_id" varchar(120),
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "triage_conditions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(40) NOT NULL,
	"label" varchar(80) NOT NULL,
	"emoji" varchar(8),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "triage_conditions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "triage_results" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"summary" text NOT NULL,
	"possible_causes" text NOT NULL,
	"recommended_treatment" text NOT NULL,
	"severity" "severity" DEFAULT 'routine' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "triage_results_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "triage_symptoms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(40) NOT NULL,
	"label" varchar(80) NOT NULL,
	"emoji" varchar(8),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "triage_symptoms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"user_id" uuid NOT NULL,
	"metric" "usage_metric" NOT NULL,
	"period_start" date NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_counters_user_id_metric_period_start_pk" PRIMARY KEY("user_id","metric","period_start")
);
--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_conditions" ADD CONSTRAINT "user_conditions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_conditions" ADD CONSTRAINT "user_conditions_condition_id_conditions_id_fk" FOREIGN KEY ("condition_id") REFERENCES "public"."conditions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft" ADD CONSTRAINT "aircraft_provider_id_transport_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."transport_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_facilities" ADD CONSTRAINT "aircraft_facilities_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_specialists" ADD CONSTRAINT "hospital_specialists_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_specialists" ADD CONSTRAINT "hospital_specialists_specialist_id_specialists_id_fk" FOREIGN KEY ("specialist_id") REFERENCES "public"."specialists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_logo_file_id_files_id_fk" FOREIGN KEY ("logo_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_packages" ADD CONSTRAINT "medical_packages_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_packages" ADD CONSTRAINT "medical_packages_transport_provider_id_transport_providers_id_fk" FOREIGN KEY ("transport_provider_id") REFERENCES "public"."transport_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_inclusions" ADD CONSTRAINT "package_inclusions_package_id_medical_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."medical_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_slides" ADD CONSTRAINT "promo_slides_package_id_medical_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."medical_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_requests" ADD CONSTRAINT "appointment_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_requests" ADD CONSTRAINT "appointment_requests_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_requests" ADD CONSTRAINT "appointment_requests_package_id_medical_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."medical_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_requests" ADD CONSTRAINT "appointment_requests_emergency_contact_id_emergency_contacts_id_fk" FOREIGN KEY ("emergency_contact_id") REFERENCES "public"."emergency_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_needs" ADD CONSTRAINT "transport_request_needs_request_id_transport_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."transport_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_needs" ADD CONSTRAINT "transport_request_needs_need_id_special_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."special_needs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_purposes" ADD CONSTRAINT "transport_request_purposes_request_id_transport_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."transport_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_request_purposes" ADD CONSTRAINT "transport_request_purposes_purpose_id_transport_purposes_id_fk" FOREIGN KEY ("purpose_id") REFERENCES "public"."transport_purposes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_provider_id_transport_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."transport_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_emergency_contact_id_emergency_contacts_id_fk" FOREIGN KEY ("emergency_contact_id") REFERENCES "public"."emergency_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_session_id_ai_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."ai_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_audio_file_id_files_id_fk" FOREIGN KEY ("audio_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_analyses" ADD CONSTRAINT "meal_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_analyses" ADD CONSTRAINT "meal_analyses_session_id_ai_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."ai_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_analyses" ADD CONSTRAINT "meal_analyses_image_file_id_files_id_fk" FOREIGN KEY ("image_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_details" ADD CONSTRAINT "meal_details_analysis_id_meal_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."meal_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_segments" ADD CONSTRAINT "meal_segments_analysis_id_meal_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."meal_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triage_results" ADD CONSTRAINT "triage_results_session_id_ai_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."ai_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_uq" ON "auth_identities" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_user_install_uq" ON "devices" USING btree ("user_id","install_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_hash_uq" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_live_ix" ON "refresh_tokens" USING btree ("user_id") WHERE revoked_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_active_uq" ON "users" USING btree ("email") WHERE deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "verification_tokens_hash_uq" ON "verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "audit_resource_ix" ON "audit_log" USING btree ("resource_type","resource_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "emergency_contacts_user_uq" ON "emergency_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_object_key_uq" ON "files" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "medical_records_user_ix" ON "medical_records" USING btree ("user_id") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "hospitals_status_ix" ON "hospitals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "packages_status_ix" ON "medical_packages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "providers_status_cat_ix" ON "transport_providers" USING btree ("status","category");--> statement-breakpoint
CREATE INDEX "activities_feed_ix" ON "activities" USING btree ("user_id","occurred_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_reference_uq" ON "appointment_requests" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "appointments_user_ix" ON "appointment_requests" USING btree ("user_id","status","requested_date");--> statement-breakpoint
CREATE UNIQUE INDEX "transport_reference_uq" ON "transport_requests" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "transport_user_ix" ON "transport_requests" USING btree ("user_id","status","pickup_date");--> statement-breakpoint
CREATE INDEX "transport_pending_ix" ON "transport_requests" USING btree ("status") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "ai_sessions_user_ix" ON "ai_sessions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "meal_user_ix" ON "meal_analyses" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_ix" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_uq" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_orig_txn_uq" ON "subscriptions" USING btree ("original_transaction_id");