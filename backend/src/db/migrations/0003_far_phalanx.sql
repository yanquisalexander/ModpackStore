ALTER TABLE "modpacks" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "publishers" ALTER COLUMN "website_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "publishers" ALTER COLUMN "discord_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "modpacks" ADD COLUMN "short_description" text;