import { AppDataSource } from "@/db/data-source";
import { PublisherSubscriptionService } from "@/services/publisher-subscription.service";

/**
 * Job to process expired publisher subscriptions
 * This should be run daily via cron
 */
async function processExpiredSubscriptions() {
    console.log('[SUBSCRIPTION_JOB] Starting expired subscriptions processing...');

    try {
        // Initialize database if not already initialized
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            console.log('[SUBSCRIPTION_JOB] Database connection initialized');
        }

        const count = await PublisherSubscriptionService.processExpiredSubscriptions();

        console.log(`[SUBSCRIPTION_JOB] Successfully processed ${count} expired subscriptions`);
    } catch (error) {
        console.error('[SUBSCRIPTION_JOB] Error processing expired subscriptions:', error);
        throw error;
    }
}


export { processExpiredSubscriptions };
