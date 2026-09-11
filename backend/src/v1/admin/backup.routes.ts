import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { requireAuth, requireAdmin } from "@/auth/middleware.ts";
import { BackupJobType, BackupJobStatus } from "@/db/schema.ts";
import { BackupOperationsQueue } from "@/worker/queues.ts";
import {
    getAvailableTables,
    getTableCounts,
    createBackupJob,
    getBackupJob,
    listBackupJobs,
    deleteBackupJob,
    deleteBackupFromR2,
    getBackupDownloadUrl,
    TABLE_REGISTRY,
} from "@/services/backup.service.ts";

const app = new Hono();

/**
 * GET /tables
 * List available tables with metadata and record counts.
 */
app.get("/tables", requireAuth, requireAdmin, async (c: Context) => {
    const tables = getAvailableTables();
    const counts = await getTableCounts(tables.map((t) => t.key));

    const result = tables.map((t) => ({
        ...t,
        recordCount: counts[t.key] ?? 0,
    }));

    return c.json({ success: true, data: result });
});

/**
 * POST /export
 * Create a backup export job.
 * Body: { tables: string[] }
 */
app.post("/export", requireAuth, requireAdmin, async (c: Context) => {
    const body = await c.req.json();
    const tables: string[] = body.tables;

    if (!tables || !Array.isArray(tables) || tables.length === 0) {
        return c.json({ success: false, error: "tables must be a non-empty array" }, 400);
    }

    // Validate all tables exist
    const invalid = tables.filter((t) => !TABLE_REGISTRY[t]);
    if (invalid.length > 0) {
        return c.json({ success: false, error: `Invalid tables: ${invalid.join(", ")}` }, 400);
    }

    const userId = (c as any).get("userId") as string;
    const job = await createBackupJob(BackupJobType.EXPORT, userId, { includedTables: tables });

    await BackupOperationsQueue.add("backup-export", {
        backupJobId: job.id,
        tables,
    }, { jobId: job.id! });

    return c.json({ success: true, data: { jobId: job.id } }, 201);
});

/**
 * GET /
 * List backup jobs (exported backups).
 * Query: type=export|restore, limit=50
 */
app.get("/", requireAuth, requireAdmin, async (c: Context) => {
    const type = c.req.query("type") as BackupJobType | undefined;
    const limit = parseInt(c.req.query("limit") ?? "50");

    const jobs = await listBackupJobs(type, limit);

    return c.json({ success: true, data: jobs, meta: { total: jobs.length } });
});

/**
 * GET /:jobId
 * Get details of a specific backup job.
 */
app.get("/:jobId", requireAuth, requireAdmin, async (c: Context) => {
    const job = await getBackupJob(c.req.param("jobId")!);
    if (!job) {
        return c.json({ success: false, error: "Backup job not found" }, 404);
    }
    return c.json({ success: true, data: job });
});

/**
 * GET /:jobId/download
 * Get a presigned download URL for a backup file.
 */
app.get("/:jobId/download", requireAuth, requireAdmin, async (c: Context) => {
    const job = await getBackupJob(c.req.param("jobId")!);
    if (!job) {
        return c.json({ success: false, error: "Backup job not found" }, 404);
    }
    if (job.status !== BackupJobStatus.COMPLETED || !job.r2Key) {
        return c.json({ success: false, error: "Backup is not completed or has no file" }, 400);
    }

    const url = await getBackupDownloadUrl(job.r2Key);
    return c.json({ success: true, data: { url, fileName: job.fileName } });
});

/**
 * POST /:jobId/restore
 * Restore from a backup.
 * Body: { tables?: string[], truncate?: boolean }
 */
app.post("/:jobId/restore", requireAuth, requireAdmin, async (c: Context) => {
    const sourceBackupId = c.req.param("jobId")!;
    const body = await c.req.json();
    const tables: string[] | undefined = body.tables;

    const sourceBackup = await getBackupJob(sourceBackupId);
    if (!sourceBackup) {
        return c.json({ success: false, error: "Source backup not found" }, 404);
    }
    if (sourceBackup.status !== BackupJobStatus.COMPLETED || !sourceBackup.r2Key) {
        return c.json({ success: false, error: "Source backup is not completed" }, 400);
    }

    // Validate restore tables if provided
    if (tables && tables.length > 0) {
        const invalid = tables.filter((t) => !TABLE_REGISTRY[t]);
        if (invalid.length > 0) {
            return c.json({ success: false, error: `Invalid tables: ${invalid.join(", ")}` }, 400);
        }
    }

    const userId = (c as any).get("userId") as string;
    const job = await createBackupJob(BackupJobType.RESTORE, userId, {
        sourceBackupId,
        restoreTables: tables,
    });

    await BackupOperationsQueue.add("backup-restore", {
        backupJobId: job.id,
        sourceBackupId,
        tables,
    }, { jobId: job.id! });

    return c.json({ success: true, data: { jobId: job.id } }, 201);
});

/**
 * DELETE /:jobId
 * Delete a backup job and its R2 file.
 */
app.delete("/:jobId", requireAuth, requireAdmin, async (c: Context) => {
    const job = await getBackupJob(c.req.param("jobId")!);
    if (!job) {
        return c.json({ success: false, error: "Backup job not found" }, 404);
    }

    // Delete from R2 if exists
    if (job.r2Key) {
        try {
            await deleteBackupFromR2(job.r2Key);
        } catch (err) {
            console.error("[BACKUP] Failed to delete R2 file:", err);
        }
    }

    await deleteBackupJob(job.id!);
    return c.json({ success: true, message: "Backup deleted" });
});

export default app;
