CREATE TYPE "public"."ad_placement" AS ENUM('hero_carousel', 'explore_banner', 'modpack_sidebar', 'server_sponsor');--> statement-breakpoint
CREATE TYPE "public"."ad_status" AS ENUM('draft', 'pending_approval', 'active', 'paused', 'completed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."ad_type" AS ENUM('house', 'creator_modpack', 'creator_profile', 'external_sponsor');--> statement-breakpoint
CREATE TABLE "ad_analytics_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"date" text NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"type" "ad_type" DEFAULT 'house' NOT NULL,
	"placement" "ad_placement" DEFAULT 'explore_banner' NOT NULL,
	"status" "ad_status" DEFAULT 'active' NOT NULL,
	"creator_id" uuid,
	"target_modpack_id" uuid,
	"target_url" text,
	"title" varchar(128) NOT NULL,
	"subtitle" text,
	"badge_text" varchar(32) DEFAULT 'Patrocinado' NOT NULL,
	"cta_text" varchar(48) DEFAULT 'Ver más' NOT NULL,
	"media_url" text NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"start_at" timestamp with time zone DEFAULT now() NOT NULL,
	"end_at" timestamp with time zone,
	"max_impressions" integer,
	"max_clicks" integer,
	"payment_method" text,
	"payment_notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_plus" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ad_free" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ad_analytics_daily" ADD CONSTRAINT "ad_analytics_daily_campaign_id_ad_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_target_modpack_id_modpacks_id_fk" FOREIGN KEY ("target_modpack_id") REFERENCES "public"."modpacks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_campaign_date" ON "ad_analytics_daily" USING btree ("campaign_id","date");