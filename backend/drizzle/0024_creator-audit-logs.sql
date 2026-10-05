CREATE TABLE "creator_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_token_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"details" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creator_audit_logs" ADD CONSTRAINT "creator_audit_logs_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_audit_logs" ADD CONSTRAINT "creator_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_audit_logs" ADD CONSTRAINT "creator_audit_logs_actor_token_id_creator_api_tokens_id_fk" FOREIGN KEY ("actor_token_id") REFERENCES "public"."creator_api_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_creator_audit_creator_created" ON "creator_audit_logs" USING btree ("creator_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_creator_audit_action" ON "creator_audit_logs" USING btree ("creator_id","action");--> statement-breakpoint
CREATE INDEX "idx_creator_audit_actor" ON "creator_audit_logs" USING btree ("actor_user_id");
