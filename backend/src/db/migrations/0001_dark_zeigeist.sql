CREATE TABLE "modpack_version_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"modpack_version_id" uuid NOT NULL,
	"type" text NOT NULL,
	"hash" text NOT NULL,
	"is_delta" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modpack_version_individual_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"modpack_version_file_id" integer NOT NULL,
	"path" text NOT NULL,
	"hash" text NOT NULL,
	"size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modpack_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modpack_id" uuid NOT NULL,
	"version" text NOT NULL,
	"mc_version" text NOT NULL,
	"forge_version" text,
	"changelog" text NOT NULL,
	"release_date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modpacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"slug" text NOT NULL,
	"icon_url" text NOT NULL,
	"banner_url" text NOT NULL,
	"password" text,
	"visibility" text NOT NULL,
	"publisher_id" uuid NOT NULL,
	CONSTRAINT "modpacks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "publishers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"publisher_name" varchar(32) NOT NULL,
	"tos_url" text NOT NULL,
	"privacy_url" text NOT NULL,
	"banner_url" text NOT NULL,
	"logo_url" text NOT NULL,
	"description" text NOT NULL,
	"website_url" text NOT NULL,
	"discord_url" text NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"partnered" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "modpack_version_files" ADD CONSTRAINT "modpack_version_files_modpack_version_id_modpack_versions_id_fk" FOREIGN KEY ("modpack_version_id") REFERENCES "public"."modpack_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_version_individual_files" ADD CONSTRAINT "modpack_version_individual_files_modpack_version_file_id_modpack_version_files_id_fk" FOREIGN KEY ("modpack_version_file_id") REFERENCES "public"."modpack_version_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_versions" ADD CONSTRAINT "modpack_versions_modpack_id_modpacks_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpacks" ADD CONSTRAINT "modpacks_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishers" ADD CONSTRAINT "publishers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;