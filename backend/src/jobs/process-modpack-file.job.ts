import type { Job } from "bullmq";
import JSZip from "jszip";
import { db } from "@/db/client.ts";
import {
    modpackVersionsTable,
    modpackFilesTable,
    modpackVersionFilesTable,
    modpackVersionProcessingJobsTable,
    ProcessingJobStatus,
} from "@/db/schema.ts";
import { eq } from "drizzle-orm";
import { log } from "@/lib/logger.ts";
import { downloadObject, uploadObject, deleteObject, getTempZipKey, getFileKey } from "@/lib/r2.ts";

async function updateProcessingJob(jobId: string, updates: Partial<{
    status: ProcessingJobStatus;
    progress: number;
    error: string | null;
}>) {
    try {
        const dbUpdates: Record<string, unknown> = { updatedAt: new Date() };
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.progress !== undefined) dbUpdates.progress = String(updates.progress);
        if (updates.error !== undefined) dbUpdates.error = updates.error;
        await db.update(modpackVersionProcessingJobsTable)
            .set(dbUpdates as any)
            .where(eq(modpackVersionProcessingJobsTable.jobId, jobId));
    } catch (err) {
        log(`  [WARN] Failed to update processing job status: ${err}`);
    }
}

export const QUEUE_NAME = "process-modpack-files";

type FileType = "mods" | "resourcepacks" | "config" | "shaderpacks" | "datapacks" | "extras";
type FileSide = "client" | "server" | "both";

interface FileMeta {
    hash: string;
    path: string;
    fileType: FileType;
    side: FileSide;
    size: number;
}

async function sha1(data: Uint8Array): Promise<string> {
    // Ensure we pass a plain ArrayBuffer to subtle.digest to avoid
    // incompatible ArrayBufferLike (e.g. SharedArrayBuffer) types.
    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const hashBuffer = await crypto.subtle.digest("SHA-1", arrayBuffer);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function determineSideByPath(filePath: string): FileSide {
    const firstDir = filePath.split("/")[0]?.toLowerCase();
    switch (firstDir) {
        case "mods":
        case "clientmods":
        case "config":
            return "both";
        case "resourcepacks":
        case "shaderpacks":
            return "client";
        case "datapacks":
        case "serverdatapacks":
            return "server";
        default:
            return "both";
    }
}

function manifestSideToSide(env: { client?: string; server?: string } | undefined): FileSide | null {
    if (!env) return null;
    const clientOk = env.client && env.client !== "unsupported";
    const serverOk = env.server && env.server !== "unsupported";
    if (clientOk && serverOk) return "both";
    if (clientOk) return "client";
    if (serverOk) return "server";
    return null;
}

export async function processModpackFiles(job: Job) {
    const { versionId, fileType } = job.data as { versionId: string; fileType: string };
    const start = Date.now();
    const jobId = job.id!;

    try {
        await updateProcessingJob(jobId, { status: ProcessingJobStatus.PROCESSING, progress: 0 });

        log(`═══ process-modpack-files [${jobId}] ═══`);
        log(`  FileType: ${fileType}`);
        log(`  VersionId: ${versionId}`);

        const [version] = await db.select()
            .from(modpackVersionsTable)
            .where(eq(modpackVersionsTable.id, versionId))
            .limit(1);

        if (!version) {
            log(`  [ERROR] Version ${versionId} not found, aborting`);
            await updateProcessingJob(jobId, { status: ProcessingJobStatus.FAILED, error: "Version not found" });
            return;
        }

        const modpackId = version.modpackId;
        const zipKey = getTempZipKey(modpackId, versionId, fileType);
        log(`  ZIP key: ${zipKey}`);
        log(`  Downloading ZIP from R2...`);

        let zipBuffer: Uint8Array | null;
        try {
            zipBuffer = await downloadObject(zipKey);
        } catch (err) {
            log(`  [ERROR] Failed to download ZIP: ${err}`);
            await updateProcessingJob(jobId, { status: ProcessingJobStatus.FAILED, error: `Failed to download ZIP: ${err}` });
            throw err;
        }

        await updateProcessingJob(jobId, { progress: 20 });

        log(`  Downloaded ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB (${zipBuffer.length} bytes)`);
        log(`  Extracting ZIP contents...`);

        const zip = await JSZip.loadAsync(zipBuffer);
        zipBuffer = null; // Allow GC

        const fileMetas: FileMeta[] = [];
        const uniqueMetas = new Map<string, FileMeta>();
        const extCounts = new Map<string, number>();
        let skipped = 0;
        let uploaded = 0;
        let dedupSavingsLocal = 0;

        // Detect if the ZIP has a single root folder matching the fileType
        const rootDirs = new Set<string>();
        for (const [relativePath, entry] of Object.entries(zip.files)) {
            if (!entry.dir) continue;
            const dir = relativePath.split("/")[0];
            if (dir) rootDirs.add(dir);
        }
        const stripPrefix = rootDirs.size === 1 && rootDirs.has(fileType) ? `${fileType}/` : "";

        const BATCH_SIZE = 10;
        const uploadBatch: Array<{ hash: string; content: Uint8Array }> = [];

        const flushUploadBatch = async () => {
            if (uploadBatch.length === 0) return;
            await Promise.all(uploadBatch.map(({ hash, content }) =>
                uploadObject(getFileKey(hash), content, "application/octet-stream"),
            ));
            uploaded += uploadBatch.length;
            uploadBatch.length = 0;
        }

        for (const [relativePath, entry] of Object.entries(zip.files)) {
            if (entry.dir) continue;
            if (relativePath.startsWith("__MACOSX/")) { skipped++; continue; }
            if (relativePath.startsWith(".")) { skipped++; continue; }

            const content = await entry.async("uint8array");
            if (content.length === 0) { skipped++; continue; }

            const hash = await sha1(content);
            const filePath = stripPrefix ? relativePath.slice(stripPrefix.length) : relativePath;
            const side = determineSideByPath(filePath);

            fileMetas.push({ hash, path: filePath, fileType: fileType as FileType, side, size: content.length });

            if (!uniqueMetas.has(hash)) {
                uniqueMetas.set(hash, { hash, path: filePath, fileType: fileType as FileType, side, size: content.length });
                uploadBatch.push({ hash, content });
                if (uploadBatch.length >= BATCH_SIZE) {
                    await flushUploadBatch();
                }
            } else {
                dedupSavingsLocal += content.length;
            }

            const ext = filePath.includes(".") ? filePath.split(".").pop()!.toLowerCase() : "(none)";
            extCounts.set(ext, (extCounts.get(ext) ?? 0) + 1);

            if (fileMetas.length % 500 === 0) {
                log(`  Progress: ${fileMetas.length} files scanned, ${uploaded} unique uploaded...`);
            }
        }

        // Flush remaining uploads
        await flushUploadBatch();

        if (stripPrefix) {
            log(`  Detected root folder "${fileType}/" — stripped prefix from all paths`);
        }

        await updateProcessingJob(jobId, { progress: 40 });

        log(`  Parsed ${fileMetas.length} files (${skipped} skipped)`);
        log(`  Extensions: ${Array.from(extCounts.entries()).sort((a, b) => b[1] - a[1]).map(([ext, count]) => `${ext}: ${count}`).join(", ")}`);

        // Side summary
        const sideCounts = { both: 0, client: 0, server: 0 };
        for (const pf of fileMetas) {
            if (pf.side === "both") sideCounts.both++;
            else if (pf.side === "client") sideCounts.client++;
            else if (pf.side === "server") sideCounts.server++;
        }
        log(`  Sides: both=${sideCounts.both}, client=${sideCounts.client}, server=${sideCounts.server}`);

        // Total size
        const totalSize = fileMetas.reduce((sum, pf) => sum + pf.size, 0);
        log(`  Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

        log(`  Unique files: ${uniqueMetas.size} (dedup saved ${(dedupSavingsLocal / 1024 / 1024).toFixed(2)} MB)`);
        log(`  Uploaded ${uploaded} unique files to R2 (batched, max ${BATCH_SIZE} concurrent)`);

        const uploadEnd = Date.now();
        log(`  All uploads done in ${((uploadEnd - start) / 1000).toFixed(1)}s`);
        log(`  Inserting DB records...`);

        const insertStart = Date.now();

        // Batch insert modpack_files (deduplicated by hash)
        const fileRows = Array.from(uniqueMetas.values()).map((pf) => ({
            hash: pf.hash,
            size: String(pf.size),
            mimeType: "application/octet-stream" as string | null,
        }));

        if (fileRows.length > 0) {
            await db.insert(modpackFilesTable)
                .values(fileRows)
                .onConflictDoNothing();
        }

        // Batch insert modpack_version_files
        const versionFileRows = fileMetas.map((pf) => ({
            fileHash: pf.hash,
            modpackVersionId: versionId,
            path: pf.path,
            fileType: pf.fileType,
            side: pf.side,
        }));

        if (versionFileRows.length > 0) {
            await db.insert(modpackVersionFilesTable)
                .values(versionFileRows)
                .onConflictDoNothing();
        }

        await updateProcessingJob(jobId, { progress: 80 });

        log(`  DB inserts done in ${((Date.now() - insertStart) / 1000).toFixed(2)}s (${fileRows.length} file records, ${versionFileRows.length} version-file records)`);

        // Delete the temp ZIP from R2
        try {
            await deleteObject(zipKey);
            log(`  Deleted temp ZIP: ${zipKey}`);
        } catch (err) {
            log(`  [WARN] Failed to delete temp ZIP: ${err}`);
        }

        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        log(`  ✅ Completed in ${elapsed}s — ${fileMetas.length} files processed, ${uniqueMetas.size} unique`);
        log(`═══ end [${jobId}] ═══`);

        await updateProcessingJob(jobId, { status: ProcessingJobStatus.COMPLETED, progress: 100 });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log(`  [ERROR] Job failed: ${message}`);
        await updateProcessingJob(jobId, { status: ProcessingJobStatus.FAILED, error: message });
        throw err;
    }
}
