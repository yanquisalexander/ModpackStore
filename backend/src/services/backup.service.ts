import { db } from "@/db/client.ts";
import {
    backupJobsTable,
    BackupJobStatus,
    BackupJobType,
    users,
    userDevices,
    modpacksTable,
    modpackVersionsTable,
    modpackFilesTable,
    modpackVersionFilesTable,
    categoriesTable,
    modpackCategoriesTable,
    creatorsTable,
    creatorUsersTable,
    permissionsTable,
    creatorAssetsTable,
    creatorStorageConfigTable,
    modpackAcquisitionsTable,
    modpackWhitelistsTable,
    bansTable,
    adCampaignsTable,
    adAnalyticsDailyTable,
} from "@/db/schema.ts";
import { eq, sql } from "drizzle-orm";
import { uploadObject, downloadObject, deleteObject, getS3Client } from "@/lib/r2.ts";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { log } from "@/lib/logger.ts";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ── Table Registry ─────────────────────────────────

export interface TableEntry {
    tableName: string;
    label: string;
    table: any;
    /** Columns to exclude when exporting (e.g. OAuth tokens) */
    excludeColumns?: string[];
    /** Group for UI organization */
    group: "core" | "modpacks" | "creators" | "system" | "ads";
}

export const TABLE_REGISTRY: Record<string, TableEntry> = {
    users: {
        tableName: "users",
        label: "Users",
        table: users,
        excludeColumns: [
            "discordAccessToken", "discordRefreshToken",
            "patreonAccessToken", "patreonRefreshToken",
            "twitchAccessToken", "twitchRefreshToken",
        ],
        group: "core",
    },
    userDevices: {
        tableName: "user_devices",
        label: "User Devices",
        table: userDevices,
        group: "core",
    },
    modpacks: {
        tableName: "modpacks",
        label: "Modpacks",
        table: modpacksTable,
        group: "modpacks",
    },
    modpackVersions: {
        tableName: "modpack_versions",
        label: "Modpack Versions",
        table: modpackVersionsTable,
        group: "modpacks",
    },
    modpackFiles: {
        tableName: "modpack_files",
        label: "Modpack Files",
        table: modpackFilesTable,
        group: "modpacks",
    },
    modpackVersionFiles: {
        tableName: "modpack_version_files",
        label: "Modpack Version Files",
        table: modpackVersionFilesTable,
        group: "modpacks",
    },
    categories: {
        tableName: "categories",
        label: "Categories",
        table: categoriesTable,
        group: "system",
    },
    modpackCategories: {
        tableName: "modpack_categories",
        label: "Modpack Categories",
        table: modpackCategoriesTable,
        group: "system",
    },
    creators: {
        tableName: "creators",
        label: "Creators",
        table: creatorsTable,
        group: "creators",
    },
    creatorUsers: {
        tableName: "creator_users",
        label: "Creator Users",
        table: creatorUsersTable,
        group: "creators",
    },
    permissions: {
        tableName: "permissions",
        label: "Permissions",
        table: permissionsTable,
        group: "creators",
    },
    creatorAssets: {
        tableName: "creator_assets",
        label: "Creator Assets",
        table: creatorAssetsTable,
        group: "creators",
    },
    creatorStorageConfig: {
        tableName: "creator_storage_config",
        label: "Creator Storage Config",
        table: creatorStorageConfigTable,
        group: "creators",
    },
    modpackAcquisitions: {
        tableName: "modpack_acquisitions",
        label: "Modpack Acquisitions",
        table: modpackAcquisitionsTable,
        group: "system",
    },
    modpackWhitelists: {
        tableName: "modpack_whitelists",
        label: "Modpack Whitelists",
        table: modpackWhitelistsTable,
        group: "system",
    },
    bans: {
        tableName: "bans",
        label: "Bans",
        table: bansTable,
        group: "system",
    },
    adCampaigns: {
        tableName: "ad_campaigns",
        label: "Ad Campaigns",
        table: adCampaignsTable,
        group: "ads",
    },
    adAnalyticsDaily: {
        tableName: "ad_analytics_daily",
        label: "Ad Analytics Daily",
        table: adAnalyticsDailyTable,
        group: "ads",
    },
};

/** Tables excluded from backup (transient/session data) */
export const EXCLUDED_TABLES = ["sessions", "gameSessions", "modpackVersionProcessingJobs"];

/** Restore order: parent tables first, then children */
export const RESTORE_ORDER = [
    "users",
    "creators",
    "creatorStorageConfig",
    "modpacks",
    "modpackFiles",
    "modpackVersions",
    "categories",
    "creatorUsers",
    "permissions",
    "creatorAssets",
    "modpackVersionFiles",
    "modpackCategories",
    "modpackAcquisitions",
    "modpackWhitelists",
    "bans",
    "adCampaigns",
    "adAnalyticsDaily",
    "userDevices",
];

// ── Helpers ────────────────────────────────────────

export function getAvailableTables() {
    return Object.entries(TABLE_REGISTRY).map(([key, entry]) => ({
        key,
        tableName: entry.tableName,
        label: entry.label,
        group: entry.group,
    }));
}

export async function getTableCounts(tableKeys: string[]) {
    const counts: Record<string, number> = {};
    for (const key of tableKeys) {
        const entry = TABLE_REGISTRY[key];
        if (!entry) continue;
        const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(entry.table);
        counts[key] = count;
    }
    return counts;
}

/**
 * Select all columns except sensitive ones for a table.
 */
function selectColumns(entry: TableEntry) {
    const columns = Object.keys(entry.table);
    if (!entry.excludeColumns || entry.excludeColumns.length === 0) {
        return undefined; // select all
    }
    const filtered = columns.filter((c) => !entry.excludeColumns!.includes(c));
    const selected: Record<string, any> = {};
    for (const col of filtered) {
        selected[col] = (entry.table as any)[col];
    }
    return selected;
}

/**
 * Export selected tables to a JSON-serializable object.
 */
export async function exportTables(tableKeys: string[], onProgress?: (table: string, index: number, total: number) => void) {
    const data: Record<string, any[]> = {};
    const counts: Record<string, number> = {};
    let totalRecords = 0;

    for (let i = 0; i < tableKeys.length; i++) {
        const key = tableKeys[i];
        const entry = TABLE_REGISTRY[key];
        if (!entry) continue;

        onProgress?.(key, i, tableKeys.length);

        const cols = selectColumns(entry);
        const rows = cols
            ? await db.select(cols).from(entry.table)
            : await db.select().from(entry.table);

        data[entry.tableName] = rows;
        counts[key] = rows.length;
        totalRecords += rows.length;
    }

    return { data, counts, totalRecords };
}

/**
 * Build the backup JSON payload.
 */
export function buildBackupPayload(data: Record<string, any[]>, counts: Record<string, number>, totalRecords: number, includedTables: string[]) {
    return {
        version: "1.0",
        createdAt: new Date().toISOString(),
        tables: data,
        metadata: {
            includedTables,
            tableCounts: counts,
            totalRecords,
        },
    };
}

/**
 * Generate R2 key for a backup file.
 */
export function getBackupR2Key(timestamp?: string): string {
    const ts = timestamp || new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return `backups/${ts}.json`;
}

/**
 * Upload backup JSON to R2.
 */
export async function uploadBackupToR2(payload: object, r2Key: string): Promise<void> {
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    await uploadObject(r2Key, bytes, "application/json");
    log(`[BACKUP] Uploaded ${r2Key} (${bytes.length} bytes)`);
}

/**
 * Download and parse a backup JSON from R2.
 */
export async function downloadBackupFromR2(r2Key: string): Promise<any> {
    const command = new GetObjectCommand({
        Bucket: Deno.env.get("R2_BUCKET")!,
        Key: r2Key,
    });
    const response = await getS3Client().send(command);
    const body = await response.Body!.transformToString();
    return JSON.parse(body);
}

/**
 * Get a presigned download URL for a backup.
 */
export async function getBackupDownloadUrl(r2Key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: Deno.env.get("R2_BUCKET")!,
        Key: r2Key,
    });
    return getSignedUrl(getS3Client(), command, { expiresIn });
}

/**
 * Delete a backup from R2.
 */
export async function deleteBackupFromR2(r2Key: string): Promise<void> {
    await deleteObject(r2Key);
}

// ── DB Job Helpers ─────────────────────────────────

export async function createBackupJob(
    type: BackupJobType,
    createdBy: string,
    options: {
        includedTables?: string[];
        sourceBackupId?: string;
        restoreTables?: string[];
    } = {}
) {
    const [job] = await db.insert(backupJobsTable).values({
        type,
        status: BackupJobStatus.PENDING,
        createdBy,
        includedTables: options.includedTables ?? null,
        sourceBackupId: options.sourceBackupId ?? null,
        restoreTables: options.restoreTables ?? null,
    }).returning();
    return job;
}

export async function updateBackupJob(jobId: string, updates: Partial<{
    status: BackupJobStatus;
    r2Key: string;
    fileName: string;
    progress: number;
    totalTables: number;
    processedTables: number;
    tableCounts: Record<string, number>;
    totalRecords: number;
    error: string;
    completedAt: Date;
}>) {
    const payload: Record<string, any> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) continue;
        if (key === "progress") {
            payload[key] = String(value); // numeric column stores strings
        } else {
            payload[key] = value;
        }
    }
    const [job] = await db.update(backupJobsTable)
        .set(payload)
        .where(eq(backupJobsTable.id, jobId))
        .returning();
    return job;
}

export async function getBackupJob(jobId: string) {
    const [job] = await db.select().from(backupJobsTable)
        .where(eq(backupJobsTable.id, jobId))
        .limit(1);
    return job ?? null;
}

export async function listBackupJobs(type?: BackupJobType, limit = 50) {
    const query = db.select().from(backupJobsTable);
    if (type) {
        return query.where(eq(backupJobsTable.type, type)).orderBy(sql`${backupJobsTable.createdAt} DESC`).limit(limit);
    }
    return query.orderBy(sql`${backupJobsTable.createdAt} DESC`).limit(limit);
}

export async function deleteBackupJob(jobId: string) {
    await db.delete(backupJobsTable).where(eq(backupJobsTable.id, jobId));
}
