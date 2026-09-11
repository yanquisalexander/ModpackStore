CREATE TYPE "public"."backup_job_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."backup_job_type" AS ENUM('export', 'restore');--> statement-breakpoint
CREATE TABLE "backup_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "backup_job_type" NOT NULL,
	"status" "backup_job_status" DEFAULT 'pending' NOT NULL,
	"included_tables" jsonb,
	"r2_key" text,
	"file_name" text,
	"source_backup_id" uuid,
	"restore_tables" jsonb,
	"progress" numeric DEFAULT '0' NOT NULL,
	"total_tables" integer,
	"processed_tables" integer DEFAULT 0 NOT NULL,
	"table_counts" jsonb,
	"total_records" integer,
	"error" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;