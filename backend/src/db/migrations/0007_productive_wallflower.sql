CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" varchar(24) NOT NULL,
	"target_id" uuid NOT NULL,
	"request_type" varchar(24) NOT NULL,
	"request_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"comment" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_request_uq" ON "reviews" USING btree ("request_type","request_id");--> statement-breakpoint
CREATE INDEX "reviews_target_ix" ON "reviews" USING btree ("target_type","target_id","created_at");