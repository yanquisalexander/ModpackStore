CREATE TABLE "creator_earnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"modpack_id" uuid,
	"purchase_id" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"commission" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modpack_acquisitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"modpack_id" uuid NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"gateway_order_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"modpack_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"gateway" text NOT NULL,
	"gateway_order_id" text,
	"gateway_transaction_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchases_gateway_order_id_unique" UNIQUE("gateway_order_id")
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_method" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "modpacks" ADD COLUMN "acquisition_method" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "modpacks" ADD COLUMN "requires_twitch_subscription" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "modpacks" ADD COLUMN "twitch_creator_ids" jsonb;--> statement-breakpoint
ALTER TABLE "modpacks" ADD COLUMN "twitch_channels" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "twitch_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "twitch_access_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "twitch_refresh_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "twitch_display_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "twitch_avatar_url" text;--> statement-breakpoint
ALTER TABLE "creator_earnings" ADD CONSTRAINT "creator_earnings_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_earnings" ADD CONSTRAINT "creator_earnings_modpack_id_modpacks_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpacks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_earnings" ADD CONSTRAINT "creator_earnings_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_acquisitions" ADD CONSTRAINT "modpack_acquisitions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_acquisitions" ADD CONSTRAINT "modpack_acquisitions_modpack_id_modpacks_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpacks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_modpack_id_modpacks_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpacks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_acq_user_modpack" ON "modpack_acquisitions" USING btree ("user_id","modpack_id");