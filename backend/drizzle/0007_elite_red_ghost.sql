ALTER TYPE "public"."modpack_visibility" ADD VALUE 'whitelist';--> statement-breakpoint
CREATE TABLE "modpack_whitelists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modpack_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"added_by_user_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "modpack_whitelists" ADD CONSTRAINT "modpack_whitelists_modpack_id_modpacks_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpacks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_whitelists" ADD CONSTRAINT "modpack_whitelists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_whitelists" ADD CONSTRAINT "modpack_whitelists_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_whitelist_user_modpack" ON "modpack_whitelists" USING btree ("modpack_id","user_id");