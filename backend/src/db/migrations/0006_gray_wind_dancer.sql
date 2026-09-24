CREATE TYPE "public"."provider_member_role" AS ENUM('manager', 'staff');--> statement-breakpoint
CREATE TYPE "public"."provider_member_status" AS ENUM('invited', 'active', 'removed');--> statement-breakpoint
CREATE TABLE "provider_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider_id" uuid NOT NULL,
	"user_id" uuid,
	"email" "citext" NOT NULL,
	"role" "provider_member_role" DEFAULT 'staff' NOT NULL,
	"status" "provider_member_status" DEFAULT 'invited' NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"invite_token_hash" char(64),
	"invite_expires_at" timestamp with time zone,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"joined_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_members" ADD CONSTRAINT "provider_members_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_members" ADD CONSTRAINT "provider_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_members" ADD CONSTRAINT "provider_members_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_members_provider_email_uq" ON "provider_members" USING btree ("provider_id","email") WHERE status <> 'removed';--> statement-breakpoint
CREATE UNIQUE INDEX "provider_members_token_uq" ON "provider_members" USING btree ("invite_token_hash");--> statement-breakpoint
CREATE INDEX "provider_members_user_ix" ON "provider_members" USING btree ("user_id") WHERE status = 'active';