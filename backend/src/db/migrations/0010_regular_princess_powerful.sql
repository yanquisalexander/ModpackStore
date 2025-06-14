ALTER TABLE "modpack_versions" ALTER COLUMN "release_date" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "modpack_versions" ALTER COLUMN "release_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "modpack_versions" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "modpacks" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;