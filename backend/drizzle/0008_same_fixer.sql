CREATE TYPE "public"."processing_job_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "modpack_version_processing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"file_type" text NOT NULL,
	"job_id" text NOT NULL,
	"status" "processing_job_status" DEFAULT 'pending' NOT NULL,
	"progress" numeric DEFAULT '0' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modpack_version_processing_jobs_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
ALTER TABLE "modpack_version_processing_jobs" ADD CONSTRAINT "modpack_version_processing_jobs_version_id_modpack_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."modpack_versions"("id") ON DELETE cascade ON UPDATE no action;