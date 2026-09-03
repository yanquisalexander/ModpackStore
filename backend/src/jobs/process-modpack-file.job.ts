import type { Job } from "bullmq";
import { BlobReader, ZipReader } from "@zip.js/zip.js";
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

const INSERT_CHUNK_SIZE = 500;

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
    // Ensure plain ArrayBuffer for crypto.subtle.digest (avoids SharedArrayBuffer type issues)
    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const hashBuffer = await crypto.subtle.digest("SHA-1", arrayBuffer);
    const hashArray = new Uint8Array(hashBuffer);
    let hex = "";
    for (let i = 0; i < hashArray.length; i++) {
        hex += hashArray[i].toString(16).padStart(2, "0");
    }
    return hex;
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

export async function processModpackFiles(job: Job) {
    const { versionId, fileType } = job.data as { versionId: string; fileType: string };
    const start = Date.now();
    const jobId = job.id!;
    let zipKey = "";

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
        zipKey = getTempZipKey(modpackId, versionId, fileType);
        log(`  ZIP key: ${zipKey}`);

        // Download ZIP
        log(`  Downloading ZIP from R2...`);
        let zipBuffer: Uint8Array;
        try {
            zipBuffer = await downloadObject(zipKey);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log(`  [ERROR] Failed to download ZIP: ${msg}`);
            await updateProcessingJob(jobId, { status: ProcessingJobStatus.FAILED, error: `Failed to download ZIP: ${msg}` });
            // If the ZIP doesn't exist, don't retry — it's unrecoverable
            if (msg.includes("NoSuchKey") || msg.includes("does not exist")) {
                log(`  [SKIP] ZIP not found in R2, marking as permanently failed (no retry).`);
                return;
            }
            throw err;
        }

        await updateProcessingJob(jobId, { progress: 20 });
        log(`  Downloaded ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);

        // Read ZIP entries using @zip.js/zip.js (streaming-friendly)
        log(`  Reading ZIP entries...`);
        const zipReader = new ZipReader(new BlobReader(new Blob([zipBuffer as BlobPart])));
        const entries = await zipReader.getEntries();

        // Release the download buffer — we no longer need it
        zipBuffer = null as any;

        // Detect if the ZIP has a single root folder matching the fileType
        const rootDirs = new Set<string>();
        for (const entry of entries) {
            if (entry.directory) {
                const dir = entry.filename.split("/")[0];
                if (dir) rootDirs.add(dir);
            }
        }
        const stripPrefix = rootDirs.size === 1 && rootDirs.has(fileType) ? `${fileType}/` : "";

        log(`  ${entries.length} entries found, processing...`);

        const fileMetas: FileMeta[] = [];
        const uniqueMetas = new Map<string, FileMeta>();
        const extCounts = new Map<string, number>();
        let skipped = 0;
        let uploaded = 0;
        let dedupSavingsLocal = 0;

        const BATCH_SIZE = 10;
        const uploadBatch: Array<{ hash: string; content: Uint8Array }> = [];

        const flushUploadBatch = async () => {
            if (uploadBatch.length === 0) return;
            await Promise.all(uploadBatch.map(({ hash, content }) =>
                uploadObject(getFileKey(hash), content, "application/octet-stream"),
            ));
            uploaded += uploadBatch.length;
            uploadBatch.length = 0;
        };

        // Process entries one at a time — each entry's content is released after processing
        for (const entry of entries) {
            if (entry.directory) continue;
            if (entry.filename.startsWith("__MACOSX/")) { skipped++; continue; }
            if (entry.filename.startsWith(".")) { skipped++; continue; }

            // Get decompressed content for THIS entry only
            const chunks: Uint8Array[] = [];
            let totalLen = 0;
            await entry.getData(
                new WritableStream({
                    write(chunk) {
                        chunks.push(chunk);
                        totalLen += chunk.length;
                    },
                }),
            );
            if (totalLen === 0) { skipped++; continue; }
            const content = new Uint8Array(totalLen);
            let offset = 0;
            for (const chunk of chunks) {
                content.set(chunk, offset);
                offset += chunk.length;
            }
            chunks.length = 0; // Release references

            const hash = await sha1(content);
            const filePath = stripPrefix ? entry.filename.slice(stripPrefix.length) : entry.filename;
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
                // content is eligible for GC after this iteration
            }

            const ext = filePath.includes(".") ? filePath.split(".").pop()!.toLowerCase() : "(none)";
            extCounts.set(ext, (extCounts.get(ext) ?? 0) + 1);

            if (fileMetas.length % 500 === 0) {
                log(`  Progress: ${fileMetas.length} files scanned, ${uploaded} unique uploaded...`);
            }
        }

        // Flush remaining uploads
        await flushUploadBatch();

        // Close the reader
        await zipReader.close();

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

        const totalSize = fileMetas.reduce((sum, pf) => sum + pf.size, 0);
        log(`  Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
        log(`  Unique files: ${uniqueMetas.size} (dedup saved ${(dedupSavingsLocal / 1024 / 1024).toFixed(2)} MB)`);
        log(`  Uploaded ${uploaded} unique files to R2 (batched, max ${BATCH_SIZE} concurrent)`);

        const uploadEnd = Date.now();
        log(`  All uploads done in ${((uploadEnd - start) / 1000).toFixed(1)}s`);
        log(`  Inserting DB records...`);

        const insertStart = Date.now();

        // Batch insert with chunking (no transaction — neon-http doesn't support it)
        const fileRows = Array.from(uniqueMetas.values()).map((pf) => ({
            hash: pf.hash,
            size: String(pf.size),
            mimeType: "application/octet-stream" as string | null,
        }));

        const versionFileRows = fileMetas.map((pf) => ({
            fileHash: pf.hash,
            modpackVersionId: versionId,
            path: pf.path,
            fileType: pf.fileType,
            side: pf.side,
        }));

        // Chunked insert modpack_files
        for (let i = 0; i < fileRows.length; i += INSERT_CHUNK_SIZE) {
            const chunk = fileRows.slice(i, i + INSERT_CHUNK_SIZE);
            await db.insert(modpackFilesTable).values(chunk).onConflictDoNothing();
        }

        // Chunked insert modpack_version_files
        for (let i = 0; i < versionFileRows.length; i += INSERT_CHUNK_SIZE) {
            const chunk = versionFileRows.slice(i, i + INSERT_CHUNK_SIZE);
            await db.insert(modpackVersionFilesTable).values(chunk).onConflictDoNothing();
        }

        await updateProcessingJob(jobId, { progress: 80 });

        log(`  DB inserts done in ${((Date.now() - insertStart) / 1000).toFixed(2)}s (${fileRows.length} file records, ${versionFileRows.length} version-file records)`);

        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        log(`  ✅ Completed in ${elapsed}s — ${fileMetas.length} files processed, ${uniqueMetas.size} unique`);
        log(`═══ end [${jobId}] ═══`);

        await updateProcessingJob(jobId, { status: ProcessingJobStatus.COMPLETED, progress: 100 });

        // Clean up temp ZIP only on success
        if (zipKey) {
            try {
                await deleteObject(zipKey);
                log(`  Cleaned up temp ZIP: ${zipKey}`);
            } catch {
                // Best effort
            }
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log(`  [ERROR] Job failed: ${message}`);
        await updateProcessingJob(jobId, { status: ProcessingJobStatus.FAILED, error: message });
        throw err;
    }
}

