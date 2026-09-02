CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"short_description" varchar(200),
	"description" text,
	"icon_url" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_admin_only" boolean DEFAULT false NOT NULL,
	"is_selectable" boolean DEFAULT true NOT NULL,
	"is_automatic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "modpack_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"modpack_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "modpack_categories" ADD CONSTRAINT "modpack_categories_modpack_id_modpacks_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."modpacks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modpack_categories" ADD CONSTRAINT "modpack_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_modpack_category" ON "modpack_categories" USING btree ("modpack_id","category_id");