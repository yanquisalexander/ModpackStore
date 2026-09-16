import type { Job } from "bullmq";
import { createHash } from "node:crypto";
import { Reader, Writer, ZipReader } from "@zip-js/zip-js";
import { db } from "@/db/client.ts";
import {
    modpackFilesTable,
    modpackVersionFilesTable,
    modpackVersionProcessingJobsTable,
    ProcessingJobStatus,
} from "@/db/schema.ts";
import { inArray, eq } from "drizzle-orm";
import { log } from "@/lib/logger.ts";
import { downloadObjectToFile, deleteObject, getFileKey, batchUploadFromPaths } from "@/lib/r2.ts";
import { getProject, getFile, getDownloadUrl, downloadFileToPath } from "@/lib/curseforge.ts";
import type { CurseForgeManifest } from "@/types/curseforge.ts";

const INSERT_CHUNK_SIZE = 500;
const MAX_CONCURRENT_DOWNLOADS = 5;
const MAX_CONCURRENT_UPLOADS = 5;

// --- Helpers (same as process-modpack-file.job.ts) ---
class DenoFileReader extends Reader<Deno.FsFile> {
    file: Deno.FsFile;
    constructor(file: Deno.FsFile, size: number) {
        super(file);
        this.file = file;
        this.size = size;
    }
    override async readUint8Array(offset: number, length: number): Promise<Uint8Array> {
        await this.file.seek(offset, Deno.SeekMode.Start);
        const buffer = new Uint8Array(length);
        let bytesRead = 0;
        while (bytesRead < length) {
            const n = await this.file.read(buffer.subarray(bytesRead));
            if (n === null) break;
            bytesRead += n;
        }
        return buffer.subarray(0, bytesRead);
    }
}

class DenoFileWriter extends Writer<void> {
    constructor(private readonly file: Deno.FsFile) {
        super();
    }
    override async writeUint8Array(array: Uint8Array): Promise<void> {
        await this.file.write(array);
    }
    override async getData(): Promise<void> {
        return;
    }
}

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
        log(`  [WARN] Failed to update processing job: ${err}`);
    }
}

type FileType = "mods" | "resourcepacks" | "config" | "shaderpacks" | "datapacks" | "extras";
type FileSide = "client" | "server" | "both";

function determineSide(filePath: string): FileSide {
    const first = filePath.split("/")[0]?.toLowerCase();
    switch (first) {
        case "mods": case "clientmods": case "config": return "both";
        case "resourcepacks": case "shaderpacks": return "client";
        case "datapacks": case "serverdatapacks": return "server";
        default: return "both";
    }
}

function determineOverrideCategory(relativePath: string): FileType {
    const lower = relativePath.toLowerCase();
    if (lower.startsWith("config/")) return "config";
    if (lower.startsWith("resourcepacks/")) return "resourcepacks";
    if (lower.startsWith("shaderpacks/")) return "shaderpacks";
    if (lower.startsWith("datapacks/")) return "datapacks";
    return "extras";
}

interface FileMeta {
    hash: string;
    path: string;
    fileType: FileType;
    side: FileSide;
    size: number;
}

export const QUEUE_NAME = "curseforge-import";

export async function curseforgeImportJob(job: Job) {
    const { versionId, modpackId, zipR2Key, manifest } = job.data as {
        versionId: string;
        modpackId: string;
        zipR2Key: string;
        manifest: CurseForgeManifest;
    };

    const jobId = job.id!;
    const start = Date.now();
    let tempZipPath: string | null = null;
    let zipFileHandle: Deno.FsFile | null = null;

    try {
        await updateProcessingJob(jobId, { status: ProcessingJobStatus.PROCESSING, progress: 0 });
        log(`═══ curseforge-import [${jobId}] ═══`);
        log(`  ModpackId: ${modpackId}`);
        log(`  VersionId: ${versionId}`);
        log(`  Mods: ${manifest.files.length}`);

        // ── Step 1: Download ZIP from R2 to disk ──
        tempZipPath = await Deno.makeTempFile({ prefix: "cf-import_", suffix: ".zip" });
        log(`  Downloading ZIP from R2 to ${tempZipPath}...`);

        await downloadObjectToFile(zipR2Key, tempZipPath);
        const zipStat = await Deno.stat(tempZipPath);
        log(`  Downloaded ${(zipStat.size / 1024 / 1024).toFixed(2)} MB`);

        await updateProcessingJob(jobId, { progress: 10 });

        // ── Step 2: Open ZIP and extract override files ──
        zipFileHandle = await Deno.open(tempZipPath, { read: true });
        const zipReader = new ZipReader(new DenoFileReader(zipFileHandle, zipStat.size));
        const entries = await zipReader.getEntries();

        const overrideFolder = manifest.overrides || "overrides";
        const overrideEntries = entries.filter(
            (e) => !e.directory && e.filename.startsWith(`${overrideFolder}/`) && !e.filename.startsWith("__MACOSX/"),
        );

        log(`  ZIP entries: ${entries.length}, overrides: ${overrideEntries.length}`);

        // Extract overrides to disk temp files
        const overrideMetas: FileMeta[] = [];
        const overrideTempFiles = new Map<string, string>(); // hash -> tempPath
        const overrideDeduped = new Map<string, string>(); // path -> hash (for dedup within overrides)

        for (const entry of overrideEntries) {
            const relativePath = entry.filename.substring(overrideFolder.length + 1);
            const category = determineOverrideCategory(relativePath);
            const adjustedPath = category === "extras" ? relativePath : `${category}/${relativePath.substring(relativePath.indexOf("/") + 1)}`;

            const tempPath = await Deno.makeTempFile({ prefix: "ovr_", suffix: ".dat" });
            const entryFile = await Deno.open(tempPath, { write: true, create: true, read: true });
            const writer = new DenoFileWriter(entryFile);

            const hash = createHash("sha1");
            const origWrite = writer.writeUint8Array.bind(writer);
            writer.writeUint8Array = async (arr: Uint8Array) => {
                hash.update(arr);
                await origWrite(arr);
            };

            await entry.getData(writer);
            try { entryFile.close(); } catch { /* pipeTo closed it */ }

            const sha1 = hash.digest("hex");
            const stat = await Deno.stat(tempPath);
            if (stat.size === 0) {
                try { await Deno.remove(tempPath); } catch { }
                continue;
            }

            // Dedup within overrides
            if (overrideDeduped.has(adjustedPath)) {
                try { await Deno.remove(tempPath); } catch { }
                continue;
            }
            overrideDeduped.set(adjustedPath, sha1);

            if (!overrideTempFiles.has(sha1)) {
                overrideTempFiles.set(sha1, tempPath);
            } else {
                try { await Deno.remove(tempPath); } catch { }
            }

            overrideMetas.push({
                hash: sha1,
                path: adjustedPath,
                fileType: category,
                side: determineSide(adjustedPath),
                size: stat.size,
            });
        }

        await zipReader.close();
        try { zipFileHandle.close(); zipFileHandle = null; } catch { }

        await updateProcessingJob(jobId, { progress: 20 });

        // ── Step 3: Download mods from CurseForge API ──
        log(`  Downloading ${manifest.files.length} mods from CurseForge...`);
        const modMetas: FileMeta[] = [];
        const modTempFiles = new Map<string, string>(); // hash -> tempPath
        let downloaded = 0;
        let failed = 0;

        // Process mods in batches with concurrency control
        for (let i = 0; i < manifest.files.length; i += MAX_CONCURRENT_DOWNLOADS) {
            const batch = manifest.files.slice(i, i + MAX_CONCURRENT_DOWNLOADS);

            const results = await Promise.allSettled(
                batch.map(async (modFile) => {
                    const fileInfo = await getFile(modFile.projectID, modFile.fileID);
                    if (!fileInfo) {
                        log(`  [SKIP] No file info for ${modFile.projectID}/${modFile.fileID}`);
                        return null;
                    }

                    const dlUrl = await getDownloadUrl(modFile.projectID, modFile.fileID);
                    if (!dlUrl) {
                        log(`  [SKIP] No download URL for ${fileInfo.fileName}`);
                        return null;
                    }

                    const tempPath = await Deno.makeTempFile({ prefix: "mod_", suffix: ".dat" });
                    const ok = await downloadFileToPath(dlUrl, tempPath);
                    if (!ok) {
                        try { await Deno.remove(tempPath); } catch { }
                        return null;
                    }

                    // Stream-hash the file instead of reading it all into memory
                    const hash = createHash("sha1");
                    const f = await Deno.open(tempPath, { read: true });
                    try {
                        const buf = new Uint8Array(64 * 1024);
                        while (true) {
                            const n = await f.read(buf);
                            if (n === null) break;
                            hash.update(buf.subarray(0, n));
                        }
                    } finally {
                        f.close();
                    }
                    const sha1 = hash.digest("hex");

                    const modPath = `mods/${fileInfo.fileName}`;
                    return {
                        hash: sha1,
                        path: modPath,
                        fileType: "mods" as FileType,
                        side: "both" as FileSide,
                        size: fileInfo.fileLength,
                        tempPath,
                    };
                }),
            );

            for (const r of results) {
                if (r.status === "fulfilled" && r.value) {
                    const meta = r.value;
                    if (!modTempFiles.has(meta.hash)) {
                        modTempFiles.set(meta.hash, meta.tempPath);
                        modMetas.push({
                            hash: meta.hash,
                            path: meta.path,
                            fileType: meta.fileType,
                            side: meta.side,
                            size: meta.size,
                        });
                        downloaded++;
                    } else {
                        // Duplicate mod (same hash), discard temp file
                        try { await Deno.remove(meta.tempPath); } catch { }
                        // Still add the version file association
                        modMetas.push({
                            hash: meta.hash,
                            path: meta.path,
                            fileType: meta.fileType,
                            side: meta.side,
                            size: meta.size,
                        });
                        downloaded++;
                    }
                } else {
                    failed++;
                }
            }

            // Update progress between batches
            const batchProgress = Math.min(20 + Math.round((i + batch.length) / manifest.files.length * 40), 60);
            if (i % (MAX_CONCURRENT_DOWNLOADS * 5) === 0) {
                await updateProcessingJob(jobId, { progress: batchProgress });
                log(`  Mods progress: ${downloaded + failed}/${manifest.files.length} (${downloaded} ok, ${failed} failed)`);
            }
        }

        log(`  Mods complete: ${downloaded} downloaded, ${failed} failed`);
        await updateProcessingJob(jobId, { progress: 60 });

        // ── Step 4: Check DB for existing files ──
        const allHashes = [
            ...new Set([...modMetas.map((m) => m.hash), ...overrideMetas.map((m) => m.hash)]),
        ];
        log(`  Checking ${allHashes.length} unique files against DB...`);

        const existingFiles = await db.select({ hash: modpackFilesTable.hash })
            .from(modpackFilesTable)
            .where(inArray(modpackFilesTable.hash, allHashes));
        const existingHashes = new Set(existingFiles.map((f) => f.hash));

        // ── Step 5: Build upload list (deduplicated by hash) ──
        // modMetas/overrideMetas contain duplicate hash entries (kept for version associations).
        // Build from the temp-file maps instead to avoid redundant uploads that OOM.
        const allTempFiles = new Map<string, string>(); // hash -> tempPath
        for (const [hash, path] of modTempFiles) {
            allTempFiles.set(hash, path);
        }
        for (const [hash, path] of overrideTempFiles) {
            if (!allTempFiles.has(hash)) {
                allTempFiles.set(hash, path);
            }
        }

        const uploadList: Array<{ key: string; filePath: string; contentType?: string }> = [];
        for (const [hash, filePath] of allTempFiles) {
            if (!existingHashes.has(hash)) {
                uploadList.push({ key: getFileKey(hash), filePath, contentType: "application/octet-stream" });
            }
        }

        log(`  ${uploadList.length} files to upload, ${allHashes.length - uploadList.length} already in DB`);

        // ── Step 6: Batch upload to R2 ──
        const uploadResult = await batchUploadFromPaths(uploadList, MAX_CONCURRENT_UPLOADS);
        log(`  Uploaded ${uploadResult.uploaded} files, ${uploadResult.skipped} failed`);

        if (uploadResult.skipped > 0) {
            throw new Error(`${uploadResult.skipped} of ${uploadList.length} files failed to upload to R2`);
        }

        // Clean up temp files immediately after upload — no longer needed
        for (const p of modTempFiles.values()) {
            try { await Deno.remove(p); } catch { }
        }
        modTempFiles.clear();
        for (const p of overrideTempFiles.values()) {
            try { await Deno.remove(p); } catch { }
        }
        overrideTempFiles.clear();

        await updateProcessingJob(jobId, { progress: 80 });

        // ── Step 7: Insert DB records ──
        log(`  Inserting DB records...`);

        // Collect unique file hashes for modpack_files
        const uniqueFilesMap = new Map<string, { hash: string; size: number }>();
        for (const meta of [...modMetas, ...overrideMetas]) {
            if (!uniqueFilesMap.has(meta.hash)) {
                uniqueFilesMap.set(meta.hash, { hash: meta.hash, size: meta.size });
            }
        }

        const fileRows = Array.from(uniqueFilesMap.values()).map((f) => ({
            hash: f.hash,
            size: String(f.size),
            mimeType: "application/octet-stream" as string | null,
        }));

        const versionFileRows = [...modMetas, ...overrideMetas].map((m) => ({
            fileHash: m.hash,
            modpackVersionId: versionId,
            path: m.path,
            fileType: m.fileType,
            side: m.side,
        }));

        for (let i = 0; i < fileRows.length; i += INSERT_CHUNK_SIZE) {
            const chunk = fileRows.slice(i, i + INSERT_CHUNK_SIZE);
            await db.insert(modpackFilesTable).values(chunk).onConflictDoNothing();
        }

        for (let i = 0; i < versionFileRows.length; i += INSERT_CHUNK_SIZE) {
            const chunk = versionFileRows.slice(i, i + INSERT_CHUNK_SIZE);
            await db.insert(modpackVersionFilesTable).values(chunk).onConflictDoNothing();
        }

        // ── Step 8: Cleanup temp ZIP ──
        try { await deleteObject(zipR2Key); } catch { /* best effort */ }

        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        log(`  ✅ CurseForge import completed in ${elapsed}s`);
        log(`     Mods: ${downloaded} downloaded, ${failed} failed`);
        log(`     Overrides: ${overrideMetas.length} files`);

        await updateProcessingJob(jobId, { status: ProcessingJobStatus.COMPLETED, progress: 100 });

    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : "";
        log(`  [ERROR] Job failed: ${message}`);
        if (stack) log(`  [STACK] ${stack}`);
        await updateProcessingJob(jobId, { status: ProcessingJobStatus.FAILED, error: `${message}\n${stack}` });
        throw err;
    } finally {
        if (zipFileHandle) {
            try { zipFileHandle.close(); } catch { }
        }
        if (tempZipPath) {
            try { await Deno.remove(tempZipPath); } catch { }
        }
    }
}
