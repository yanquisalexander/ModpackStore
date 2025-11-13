import cron from 'node-cron';
import { processExpiredSubscriptions } from '@/jobs/process-expired-subscriptions';

export class SubscriptionCronService {
    private static dailyJob: cron.ScheduledTask | null = null;

    /**
     * Start daily subscription expiry check job
     * Runs every day at 2:00 AM
     */
    static startDailyExpiryJob(): void {
        if (this.dailyJob) {
            console.log('[SUBSCRIPTION_CRON] Daily expiry job already running');
            return;
        }

        // Schedule: Run at 2:00 AM every day
        this.dailyJob = cron.schedule('0 2 * * *', async () => {
            console.log('[SUBSCRIPTION_CRON] Running daily subscription expiry check...');
            try {
                await processExpiredSubscriptions();
                console.log('[SUBSCRIPTION_CRON] Daily expiry check completed');
            } catch (error) {
                console.error('[SUBSCRIPTION_CRON] Error in daily expiry check:', error);
            }
        });

        console.log('[SUBSCRIPTION_CRON] Daily subscription expiry job started (runs at 2:00 AM daily)');
    }

    /**
     * Stop daily expiry job
     */
    static stopDailyExpiryJob(): void {
        if (this.dailyJob) {
            this.dailyJob.stop();
            this.dailyJob = null;
            console.log('[SUBSCRIPTION_CRON] Daily expiry job stopped');
        }
    }

    /**
     * Get job status
     */
    static getJobStatus(): { running: boolean } {
        return {
            running: this.dailyJob !== null
        };
    }
}
