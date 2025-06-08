CREATE TABLE "modpack_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"publisher_member_id" integer NOT NULL,
	"modpack_id" uuid NOT NULL,
	"can_edit" boolean DEFAULT false NOT NULL,
	"can_delete" boolean DEFAULT false NOT NULL,
	"can_publish" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publisher_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publisher_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invited_by" uuid NOT NULL,
	CONSTRAINT "publisher_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "publisher_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"publisher_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "publishers" DROP CONSTRAINT "publishers_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "modpack_versions" ADD COLUMN "created_by" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "modpack_versions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "modpack_versions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "modpacks" ADD COLUMN "show_user_as_publisher" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "modpacks" ADD COLUMN "creator_user_id" uuid;--> statement-breakpoint
ALTER TABLE "modpacks" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "modpacks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "publishers" ADD COLUMN "is_hosting_partner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "modpack_permissions" ADD CONSTRAINT "modpack_permissions_publisher_member_id_publisher_members_id_fk" FOREIGN KEY ("publisher_member_id") REFERENCES "public"."publisher_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_permissions" ADD CONSTRAINT "modpack_permissions_modpack_id_modpacks_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publisher_invites" ADD CONSTRAINT "publisher_invites_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publisher_invites" ADD CONSTRAINT "publisher_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publisher_members" ADD CONSTRAINT "publisher_members_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publisher_members" ADD CONSTRAINT "publisher_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_versions" ADD CONSTRAINT "modpack_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpacks" ADD CONSTRAINT "modpacks_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishers" DROP COLUMN "user_id";