CREATE TABLE "modpack_version_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modpack_version_id" uuid NOT NULL,
	"file_hash" varchar(64) NOT NULL,
	"path" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "modpack_version_files" ADD CONSTRAINT "modpack_version_files_modpack_version_id_modpack_versions_id_fk" FOREIGN KEY ("modpack_version_id") REFERENCES "public"."modpack_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_version_files" ADD CONSTRAINT "modpack_version_files_file_hash_modpack_files_hash_fk" FOREIGN KEY ("file_hash") REFERENCES "public"."modpack_files"("hash") ON DELETE no action ON UPDATE no action;