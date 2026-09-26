CREATE TABLE "booking_reminders" (
	"request_type" varchar(24) NOT NULL,
	"request_id" uuid NOT NULL,
	"for_date" date NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_reminders_request_type_request_id_for_date_pk" PRIMARY KEY("request_type","request_id","for_date")
);
