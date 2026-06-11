CREATE TYPE "public"."creator_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "creator_users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "creator_users" ALTER COLUMN "role" SET DEFAULT 'member'::text;--> statement-breakpoint
DROP TYPE "public"."creator_role";--> statement-breakpoint
CREATE TYPE "public"."creator_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
ALTER TABLE "creator_users" ALTER COLUMN "role" SET DEFAULT 'member'::"public"."creator_role";--> statement-breakpoint
ALTER TABLE "creator_users" ALTER COLUMN "role" SET DATA TYPE "public"."creator_role" USING "role"::"public"."creator_role";--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "slug" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "status" "creator_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "creators" ADD CONSTRAINT "creators_slug_unique" UNIQUE("slug");