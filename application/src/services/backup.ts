import { fetchWithAuth, fetchJson } from "@/lib/fetchWithAuth";
import { API_ENDPOINT } from "@/consts";

// ── Types ──────────────────────────────────────────

export type BackupJobType = "export" | "restore";
export type BackupJobStatus = "pending" | "processing" | "completed" | "failed";

export interface BackupTableInfo {
    key: string;
    tableName: string;
    label: string;
    group: "core" | "modpacks" | "creators" | "system" | "ads";
    recordCount: number;
}

export interface BackupJob {
    id: string;
    type: BackupJobType;
    status: BackupJobStatus;
    includedTables: string[] | null;
    r2Key: string | null;
    fileName: string | null;
    sourceBackupId: string | null;
    restoreTables: string[] | null;
    progress: string;
    totalTables: number | null;
    processedTables: number;
    tableCounts: Record<string, number> | null;
    totalRecords: number | null;
    error: string | null;
    createdBy: string;
    createdAt: string;
    completedAt: string | null;
    updatedAt: string;
}

interface ApiResponse<T> {
    success: boolean;
    data: T;
    meta?: { total: number };
    message?: string;
    error?: string;
}

// ── Service ────────────────────────────────────────

export class AdminBackupService {
    private static baseUrl = `${API_ENDPOINT}/admin/backup`;

    /**
     * List available tables with record counts.
     */
    static async getTables(): Promise<BackupTableInfo[]> {
        const res = await fetchJson<ApiResponse<BackupTableInfo[]>>(`${this.baseUrl}/tables`);
        return res.data;
    }

    /**
     * Create an export job. Returns the job ID for polling.
     */
    static async createExport(tables: string[]): Promise<string> {
        const res = await fetchJson<ApiResponse<{ jobId: string }>>(`${this.baseUrl}/export`, {
            method: "POST",
            body: JSON.stringify({ tables }),
        });
        return res.data.jobId;
    }

    /**
     * List backup/export jobs.
     */
    static async listJobs(type?: BackupJobType, limit = 50): Promise<BackupJob[]> {
        const params = new URLSearchParams();
        if (type) params.set("type", type);
        params.set("limit", String(limit));
        const res = await fetchJson<ApiResponse<BackupJob[]>>(`${this.baseUrl}?${params}`);
        return res.data;
    }

    /**
     * Get a specific backup job by ID.
     */
    static async getJob(jobId: string): Promise<BackupJob> {
        const res = await fetchJson<ApiResponse<BackupJob>>(`${this.baseUrl}/${jobId}`);
        return res.data;
    }

    /**
     * Get a presigned download URL for a backup file.
     */
    static async getDownloadUrl(jobId: string): Promise<{ url: string; fileName: string }> {
        const res = await fetchJson<ApiResponse<{ url: string; fileName: string }>>(
            `${this.baseUrl}/${jobId}/download`
        );
        return res.data;
    }

    /**
     * Create a restore job from a source backup.
     */
    static async createRestore(sourceBackupId: string, tables?: string[]): Promise<string> {
        const res = await fetchJson<ApiResponse<{ jobId: string }>>(`${this.baseUrl}/${sourceBackupId}/restore`, {
            method: "POST",
            body: JSON.stringify({ tables }),
        });
        return res.data.jobId;
    }

    /**
     * Delete a backup job and its R2 file.
     */
    static async deleteJob(jobId: string): Promise<void> {
        await fetchJson<ApiResponse<unknown>>(`${this.baseUrl}/${jobId}`, {
            method: "DELETE",
        });
    }

    /**
     * Import a local backup JSON file.
     * If restore=true, immediately queues a restore job.
     */
    static async importBackup(
        file: File,
        restore = false
    ): Promise<{ backupJobId: string; restoreJobId: string | null; fileName: string; tables: number; totalRecords: number }> {
        const formData = new FormData();
        formData.append("file", file);

        const url = `${this.baseUrl}/import${restore ? "?restore=true" : ""}`;
        const response = await fetchWithAuth(url, {
            method: "POST",
            body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        return data.data;
    }
}
