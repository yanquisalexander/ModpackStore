CREATE TABLE "scopes" (
	"id" serial PRIMARY KEY NOT NULL,
	"publisher_member_id" integer NOT NULL,
	"publisher_id" uuid,
	"modpack_id" uuid,
	"can_create_modpacks" boolean DEFAULT false,
	"can_edit_modpacks" boolean DEFAULT false,
	"can_delete_modpacks" boolean DEFAULT false,
	"can_publish_versions" boolean DEFAULT false,
	"can_manage_members" boolean DEFAULT false,
	"can_manage_settings" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "modpack_permissions" CASCADE;--> statement-breakpoint
DROP TABLE "publisher_invites" CASCADE;--> statement-breakpoint
ALTER TABLE "modpack_version_files" ADD COLUMN "size" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_publisher_member_id_publisher_members_id_fk" FOREIGN KEY ("publisher_member_id") REFERENCES "public"."publisher_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_modpack_id_modpacks_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_version_files" DROP COLUMN "is_delta";--> statement-breakpoint
ALTER TABLE "publisher_members" DROP COLUMN "permissions";