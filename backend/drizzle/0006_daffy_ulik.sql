DROP TABLE "creator_earnings" CASCADE;--> statement-breakpoint
DROP TABLE "purchases" CASCADE;--> statement-breakpoint
DROP TABLE "withdrawals" CASCADE;--> statement-breakpoint
ALTER TABLE "modpack_acquisitions" DROP COLUMN "gateway_order_id";--> statement-breakpoint
ALTER TABLE "modpacks" DROP COLUMN "is_paid";--> statement-breakpoint
ALTER TABLE "modpacks" DROP COLUMN "price";