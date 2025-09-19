CREATE TYPE "public"."audit_action" AS ENUM('user_login', 'user_logout', 'user_created', 'user_updated', 'user_deleted', 'user_role_changed', 'modpack_created', 'modpack_updated', 'modpack_deleted', 'admin_access', 'audit_log_viewed');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('purchase', 'commission', 'deposit', 'withdrawal');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin', 'superadmin');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" "audit_action" NOT NULL,
	"user_id" uuid,
	"target_user_id" uuid,
	"target_resource_id" uuid,
	"details" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"short_description" text,
	"description" text,
	"icon_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modpack_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"modpack_id" uuid NOT NULL,
	"category_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modpack_files" (
	"hash" varchar(64) PRIMARY KEY NOT NULL,
	"size" integer NOT NULL,
	"mime_type" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modpack_version_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modpack_version_id" uuid NOT NULL,
	"file_hash" varchar(64) NOT NULL,
	"path" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modpack_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modpack_id" uuid NOT NULL,
	"version" text NOT NULL,
	"mc_version" text NOT NULL,
	"forge_version" text,
	"changelog" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"release_date" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modpacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"short_description" text,
	"description" text,
	"slug" text NOT NULL,
	"icon_url" text NOT NULL,
	"banner_url" text NOT NULL,
	"trailer_url" text,
	"password" text,
	"visibility" text NOT NULL,
	"publisher_id" uuid NOT NULL,
	"show_user_as_publisher" boolean DEFAULT false,
	"creator_user_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_paid" boolean DEFAULT false,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modpacks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "publisher_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"publisher_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publishers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publisher_name" varchar(32) NOT NULL,
	"tos_url" text NOT NULL,
	"privacy_url" text NOT NULL,
	"banner_url" text NOT NULL,
	"logo_url" text NOT NULL,
	"description" text NOT NULL,
	"website_url" text,
	"discord_url" text,
	"banned" boolean DEFAULT false NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"partnered" boolean DEFAULT false NOT NULL,
	"is_hosting_partner" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"modpack_view" boolean DEFAULT false,
	"modpack_modify" boolean DEFAULT false,
	"modpack_manage_versions" boolean DEFAULT false,
	"modpack_publish" boolean DEFAULT false,
	"modpack_delete" boolean DEFAULT false,
	"modpack_manage_access" boolean DEFAULT false,
	"publisher_manage_categories_tags" boolean DEFAULT false,
	"publisher_view_stats" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"device_info" jsonb DEFAULT '{}'::jsonb,
	"location_info" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"modpack_id" uuid NOT NULL,
	"price_paid" numeric(10, 2) NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(32) NOT NULL,
	"email" text NOT NULL,
	"avatar_url" text,
	"discord_id" text,
	"discord_access_token" text,
	"discord_refresh_token" text,
	"patreon_id" text,
	"patreon_access_token" text,
	"patreon_refresh_token" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"related_user_id" uuid,
	"related_modpack_id" uuid,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publisher_id" uuid NOT NULL,
	"balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_categories" ADD CONSTRAINT "modpack_categories_modpack_id_modpacks_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_categories" ADD CONSTRAINT "modpack_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_version_files" ADD CONSTRAINT "modpack_version_files_modpack_version_id_modpack_versions_id_fk" FOREIGN KEY ("modpack_version_id") REFERENCES "public"."modpack_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_version_files" ADD CONSTRAINT "modpack_version_files_file_hash_modpack_files_hash_fk" FOREIGN KEY ("file_hash") REFERENCES "public"."modpack_files"("hash") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_versions" ADD CONSTRAINT "modpack_versions_modpack_id_modpacks_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_versions" ADD CONSTRAINT "modpack_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpacks" ADD CONSTRAINT "modpacks_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpacks" ADD CONSTRAINT "modpacks_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publisher_members" ADD CONSTRAINT "publisher_members_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publisher_members" ADD CONSTRAINT "publisher_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_publisher_member_id_publisher_members_id_fk" FOREIGN KEY ("publisher_member_id") REFERENCES "public"."publisher_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_modpack_id_modpacks_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_purchases" ADD CONSTRAINT "user_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_purchases" ADD CONSTRAINT "user_purchases_modpack_id_modpacks_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_related_user_id_users_id_fk" FOREIGN KEY ("related_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_related_modpack_id_modpacks_id_fk" FOREIGN KEY ("related_modpack_id") REFERENCES "public"."modpacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE no action ON UPDATE no action;