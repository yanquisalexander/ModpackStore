import type { Job } from "bullmq";
import { BackupJobStatus } from "@/db/schema.ts";
import { db } from "@/db/client.ts";
import { log } from "@/lib/logger.ts";
import {
    TABLE_REGISTRY,
    RESTORE_ORDER,
    downloadBackupFromR2,
    updateBackupJob,
    getBackupJob,
} from "@/services/backup.service.ts";
import { sql } from "drizzle-orm";

const INSERT_CHUNK_SIZE = 500;

/**
 * Recursively convert ISO date strings back to Date objects.
 * JSON.parse turns Date columns into strings, but Drizzle expects Date objects.
 */
function reviveDates(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "string") {
        // Match ISO 8601 date strings (with or without timezone)
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(obj)) {
            const d = new Date(obj);
            if (!isNaN(d.getTime())) return d;
        }
        return obj;
    }
    if (Array.isArray(obj)) return obj.map(reviveDates);
    if (typeof obj === "object") {
        for (const key of Object.keys(obj)) {
            obj[key] = reviveDates(obj[key]);
        }
    }
    return obj;
}

export async function backupRestoreJob(job: Job) {
    const { backupJobId, sourceBackupId, tables } = job.data as {
        backupJobId: string;
        sourceBackupId: string;
        tables?: string[];
    };

    log(`[BACKUP_RESTORE] Starting restore job ${backupJobId} from backup ${sourceBackupId}`);

    try {
        // Mark as processing
        await updateBackupJob(backupJobId, {
            status: BackupJobStatus.PROCESSING,
        });

        // Get source backup metadata
        const sourceBackup = await getBackupJob(sourceBackupId);
        if (!sourceBackup?.r2Key) {
            throw new Error(`Source backup ${sourceBackupId} not found or has no R2 file`);
        }

        // Download backup JSON
        log(`[BACKUP_RESTORE] Downloading backup from ${sourceBackup.r2Key}`);
        const backupPayload = await downloadBackupFromR2(sourceBackup.r2Key);

        if (!backupPayload?.tables) {
            throw new Error("Invalid backup file: missing 'tables' key");
        }

        // Determine which tables to restore
        const restoreTables = tables && tables.length > 0
            ? RESTORE_ORDER.filter((t) => tables.includes(t) && backupPayload.tables[TABLE_REGISTRY[t]?.tableName])
            : RESTORE_ORDER.filter((t) => backupPayload.tables[TABLE_REGISTRY[t]?.tableName]);

        await updateBackupJob(backupJobId, {
            totalTables: restoreTables.length,
            processedTables: 0,
            progress: 0,
        });

        log(`[BACKUP_RESTORE] Restoring ${restoreTables.length} tables`);

        let totalRecords = 0;

        for (let i = 0; i < restoreTables.length; i++) {
            const tableKey = restoreTables[i];
            const entry = TABLE_REGISTRY[tableKey];
            if (!entry) continue;

            const rows = backupPayload.tables[entry.tableName];
            if (!rows || !Array.isArray(rows) || rows.length === 0) {
                log(`[BACKUP_RESTORE] Skipping table ${entry.tableName} (no data)`);
                continue;
            }

            log(`[BACKUP_RESTORE] Restoring table ${entry.tableName} (${rows.length} rows) [${i + 1}/${restoreTables.length}]`);

            // Truncate table (with cascade for FK constraints)
            await db.execute(sql.raw(`TRUNCATE TABLE "${entry.tableName}" CASCADE`));

            // Insert in chunks
            for (let j = 0; j < rows.length; j += INSERT_CHUNK_SIZE) {
                const chunk = rows.slice(j, j + INSERT_CHUNK_SIZE).map(reviveDates);
                if (chunk.length > 0) {
                    await db.insert(entry.table).values(chunk).onConflictDoNothing();
                }
            }

            totalRecords += rows.length;

            const progress = Math.round(((i + 1) / restoreTables.length) * 100);
            await updateBackupJob(backupJobId, {
                processedTables: i + 1,
                progress,
            });
            await job.updateProgress(progress);
        }

        // Finalize
        await updateBackupJob(backupJobId, {
            status: BackupJobStatus.COMPLETED,
            totalRecords,
            progress: 100,
            processedTables: restoreTables.length,
            completedAt: new Date(),
        });

        log(`[BACKUP_RESTORE] Job ${backupJobId} completed. Restored ${totalRecords} records across ${restoreTables.length} tables`);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log(`[BACKUP_RESTORE] Job ${backupJobId} failed: ${message}`);

        await updateBackupJob(backupJobId, {
            status: BackupJobStatus.FAILED,
            error: message,
        });

        throw err;
    }
}
