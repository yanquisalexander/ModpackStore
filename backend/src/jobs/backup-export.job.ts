import type { Job } from "bullmq";
import { BackupJobStatus } from "@/db/schema.ts";
import { log } from "@/lib/logger.ts";
import {
    TABLE_REGISTRY,
    exportTables,
    buildBackupPayload,
    getBackupR2Key,
    uploadBackupToR2,
    updateBackupJob,
    getBackupJob,
} from "@/services/backup.service.ts";

export const QUEUE_NAME = "backup-operations";

export async function backupExportJob(job: Job) {
    const { backupJobId, tables } = job.data as {
        backupJobId: string;
        tables: string[];
    };

    log(`[BACKUP_EXPORT] Starting export job ${backupJobId} with tables: ${tables.join(", ")}`);

    try {
        // Mark as processing
        await updateBackupJob(backupJobId, {
            status: BackupJobStatus.PROCESSING,
            totalTables: tables.length,
            processedTables: 0,
            progress: 0,
        });

        // Validate tables exist
        const validTables = tables.filter((t) => TABLE_REGISTRY[t]);
        if (validTables.length === 0) {
            throw new Error("No valid tables provided for export");
        }

        // Export with progress tracking
        const { data, counts, totalRecords } = await exportTables(
            validTables,
            async (tableName, index, total) => {
                const progress = Math.round((index / total) * 100);
                await updateBackupJob(backupJobId, {
                    processedTables: index,
                    progress,
                });
                await job.updateProgress(progress);
                log(`[BACKUP_EXPORT] Exporting table ${index + 1}/${total}: ${tableName}`);
            }
        );

        // Build and upload payload
        const payload = buildBackupPayload(data, counts, totalRecords, validTables);
        const r2Key = getBackupR2Key();
        await uploadBackupToR2(payload, r2Key);

        // Finalize
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        await updateBackupJob(backupJobId, {
            status: BackupJobStatus.COMPLETED,
            r2Key,
            fileName: `backup_${timestamp}.json`,
            tableCounts: counts,
            totalRecords,
            progress: 100,
            processedTables: validTables.length,
            completedAt: new Date(),
        });

        log(`[BACKUP_EXPORT] Job ${backupJobId} completed. File: ${r2Key} (${totalRecords} records)`);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log(`[BACKUP_EXPORT] Job ${backupJobId} failed: ${message}`);

        await updateBackupJob(backupJobId, {
            status: BackupJobStatus.FAILED,
            error: message,
        });

        throw err;
    }
}
