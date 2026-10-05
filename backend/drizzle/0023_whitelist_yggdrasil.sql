ALTER TABLE "modpacks" ADD COLUMN "whitelist_enforce_ingame" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "modpacks" ADD COLUMN "whitelist_kick_message" text DEFAULT 'No estás autorizado a acceder a esta instancia' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD COLUMN "modpack_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_modpack_id_modpacks_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpacks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_game_sessions_modpack" ON "game_sessions" USING btree ("modpack_id");
