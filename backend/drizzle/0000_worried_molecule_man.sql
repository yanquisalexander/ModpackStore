CREATE TYPE "public"."creator_role" AS ENUM('owner', 'admin', 'contributor');--> statement-breakpoint
CREATE TYPE "public"."mod_loader_type" AS ENUM('vanilla', 'forge', 'fabric', 'neoforge', 'quilt');--> statement-breakpoint
CREATE TYPE "public"."modpack_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."modpack_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin', 'super_admin');--> statement-breakpoint
CREATE TABLE "creator_users" (
	"creator_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "creator_role" DEFAULT 'contributor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creator_users_creator_id_user_id_pk" PRIMARY KEY("creator_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "creators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" varchar(64) NOT NULL,
	"banner_url" text,
	"logo_url" text,
	"description" text,
	"discord_url" text,
	"verified" boolean DEFAULT false NOT NULL,
	"partner" boolean DEFAULT false NOT NULL,
	"hosting_partner" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modpack_files" (
	"hash" text PRIMARY KEY NOT NULL,
	"size" numeric NOT NULL,
	"mime_type" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modpack_version_files" (
	"file_hash" text NOT NULL,
	"modpack_version_id" uuid NOT NULL,
	"path" text NOT NULL,
	"file_type" text NOT NULL,
	"side" text DEFAULT 'both' NOT NULL,
	CONSTRAINT "modpack_version_files_file_hash_modpack_version_id_path_pk" PRIMARY KEY("file_hash","modpack_version_id","path")
);
--> statement-breakpoint
CREATE TABLE "modpack_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modpack_id" uuid NOT NULL,
	"version" varchar(32) NOT NULL,
	"mc_version" varchar(32) NOT NULL,
	"loader_type" "mod_loader_type" DEFAULT 'vanilla' NOT NULL,
	"loader_version" varchar(32),
	"changelog" text,
	"status" "modpack_status" DEFAULT 'draft' NOT NULL,
	"release_date" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modpacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"short_description" varchar(255) NOT NULL,
	"description" text,
	"slug" text NOT NULL,
	"icon_url" text NOT NULL,
	"banner_url" text NOT NULL,
	"trailer_url" text,
	"password" text,
	"visibility" "modpack_visibility" DEFAULT 'private' NOT NULL,
	"creator_id" uuid NOT NULL,
	"show_user_as_publisher" boolean DEFAULT false,
	"creator_user_id" uuid,
	"status" "modpack_status" DEFAULT 'draft' NOT NULL,
	"is_paid" boolean DEFAULT false,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modpacks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"creator_id" uuid,
	"modpack_id" uuid,
	"can_create_modpacks" boolean DEFAULT false,
	"can_edit_modpacks" boolean DEFAULT false,
	"can_delete_modpacks" boolean DEFAULT false,
	"can_publish_versions" boolean DEFAULT false,
	"can_manage_members" boolean DEFAULT false,
	"can_manage_settings" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"device_info" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(32) NOT NULL,
	"email" varchar(255) NOT NULL,
	"avatar_url" text,
	"discord_id" text,
	"discord_access_token" text,
	"discord_refresh_token" text,
	"patreon_id" text,
	"patreon_access_token" text,
	"patreon_refresh_token" text,
	"role" "role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "creator_users" ADD CONSTRAINT "creator_users_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_users" ADD CONSTRAINT "creator_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_version_files" ADD CONSTRAINT "modpack_version_files_file_hash_modpack_files_hash_fk" FOREIGN KEY ("file_hash") REFERENCES "public"."modpack_files"("hash") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_version_files" ADD CONSTRAINT "modpack_version_files_modpack_version_id_modpack_versions_id_fk" FOREIGN KEY ("modpack_version_id") REFERENCES "public"."modpack_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_versions" ADD CONSTRAINT "modpack_versions_modpack_id_modpacks_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpacks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_versions" ADD CONSTRAINT "modpack_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpacks" ADD CONSTRAINT "modpacks_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpacks" ADD CONSTRAINT "modpacks_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_modpack_id_modpacks_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpacks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_scope" ON "permissions" USING btree ("user_id","creator_id","modpack_id");