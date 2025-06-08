CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modpack_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"modpack_id" uuid NOT NULL,
	"category_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "modpack_categories" ADD CONSTRAINT "modpack_categories_modpack_id_modpacks_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpacks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_categories" ADD CONSTRAINT "modpack_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;