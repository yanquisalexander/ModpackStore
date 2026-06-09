import cron from 'node-cron';
import { PatreonSyncService } from './patreon-sync.service';

/**
 * Patreon Cron Scheduler Service
 * Handles automatic daily synchronization of Patreon tiers and members
 */
export class PatreonCronService {
    private static syncJob: cron.ScheduledTask | null = null;

    /**
     * Start the daily Patreon sync cron job
     * Runs every day at 2:00 AM
     */
    static startDailySyncJob(): void {
        if (this.syncJob) {
            console.log('[PATREON_CRON] Cron job already running');
            return;
        }

        // Schedule: Run at 2:00 AM every day
        // Cron format: minute hour day month dayOfWeek
        this.syncJob = cron.schedule('0 2 * * *', async () => {
            console.log('[PATREON_CRON] Starting scheduled daily sync...');
            
            try {
                const result = await PatreonSyncService.fullSync();
                
                if (result.success) {
                    console.log('[PATREON_CRON] Daily sync completed successfully:', {
                        tiers: result.tiers,
                        members: result.members
                    });
                } else {
                    console.error('[PATREON_CRON] Daily sync failed:', result.error);
                }
            } catch (error) {
                console.error('[PATREON_CRON] Error during daily sync:', error);
            }
        }, {
            scheduled: true,
            timezone: "UTC"
        });

        console.log('[PATREON_CRON] Daily sync job scheduled at 2:00 AM UTC');
    }

    /**
     * Stop the daily sync cron job
     */
    static stopDailySyncJob(): void {
        if (this.syncJob) {
            this.syncJob.stop();
            this.syncJob = null;
            console.log('[PATREON_CRON] Daily sync job stopped');
        }
    }

    /**
     * Check if the cron job is running
     */
    static isJobRunning(): boolean {
        return this.syncJob !== null;
    }
}
