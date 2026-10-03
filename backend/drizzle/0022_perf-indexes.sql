CREATE INDEX "idx_game_sessions_server" ON "game_sessions" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX "idx_game_sessions_expires" ON "game_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_version_files_version" ON "modpack_version_files" USING btree ("modpack_version_id");--> statement-breakpoint
CREATE INDEX "idx_versions_modpack_status" ON "modpack_versions" USING btree ("modpack_id","status");--> statement-breakpoint
CREATE INDEX "idx_modpacks_visibility_status" ON "modpacks" USING btree ("visibility","status","updated_at");