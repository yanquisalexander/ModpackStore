-- Add Twitch OAuth fields to users table
ALTER TABLE "users" 
ADD COLUMN "twitch_id" text,
ADD COLUMN "twitch_access_token" text,
ADD COLUMN "twitch_refresh_token" text;

-- Add unique constraint for twitch_id
CREATE UNIQUE INDEX "users_twitch_id_unique" ON "users"("twitch_id") WHERE "twitch_id" IS NOT NULL;

-- Add Twitch subscription requirement fields to modpacks table
ALTER TABLE "modpacks" 
ADD COLUMN "requires_twitch_subscription" boolean DEFAULT false NOT NULL,
ADD COLUMN "twitch_creator_ids" text[] DEFAULT '{}';

-- Add index for Twitch subscription queries
CREATE INDEX "modpacks_twitch_subscription_idx" ON "modpacks"("requires_twitch_subscription") WHERE "requires_twitch_subscription" = true;