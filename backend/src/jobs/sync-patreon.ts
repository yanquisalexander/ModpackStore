import { PatreonSyncService } from "@/services/patreon-sync.service";
import { AppDataSource } from "@/db/data-source";

/**
 * Cron job to sync Patreon tiers and members daily
 * 
 * This should be scheduled to run daily (e.g., via cron or a job scheduler)
 * Example cron expression: 0 2 * * * (runs at 2 AM daily)
 */

async function runPatreonSync() {
    console.log('[PATREON_CRON] Starting scheduled Patreon synchronization...');
    
    try {
        // Initialize database connection if not already connected
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            console.log('[PATREON_CRON] Database connection initialized');
        }

        // Run full sync
        const result = await PatreonSyncService.fullSync();

        if (result.success) {
            console.log('[PATREON_CRON] Synchronization completed successfully:', {
                tiers: result.tiers,
                members: result.members
            });
        } else {
            console.error('[PATREON_CRON] Synchronization failed:', result.error);
            process.exit(1);
        }
    } catch (error) {
        console.error('[PATREON_CRON] Fatal error during synchronization:', error);
        process.exit(1);
    } finally {
        // Close database connection
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            console.log('[PATREON_CRON] Database connection closed');
        }
    }

    process.exit(0);
}

// Run the sync job
runPatreonSync().catch(error => {
    console.error('[PATREON_CRON] Unhandled error:', error);
    process.exit(1);
});
