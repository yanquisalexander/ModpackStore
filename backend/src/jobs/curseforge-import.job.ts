import type { Job } from "bullmq";
import { createHash } from "node:crypto";
import { Reader, Writer, ZipReader } from "@zip-js/zip-js";
import type { FileEntry } from "@zip-js/zip-js";
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
import { getFileAndDownloadUrl, downloadFileWithHash } from "@/lib/curseforge.ts";
import {
    getWorkerProfile,
    isMemoryPressured,
    isMemoryCritical,
    maybeGc,
    getDiskFreeBytes,
    getMemorySnapshot,
} from "@/lib/auto-tune.ts";
import type { CurseForgeManifest } from "@/types/curseforge.ts";

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

/** Chunked `inArray` select: evita queries gigantes y picos de memoria. */
async function fetchExistingHashes(allHashes: string[], chunkSize: number): Promise<Set<string>> {
    const existing = new Set<string>();
    for (let i = 0; i < allHashes.length; i += chunkSize) {
        const chunk = allHashes.slice(i, i + chunkSize);
        if (chunk.length === 0) continue;
        const rows = await db.select({ hash: modpackFilesTable.hash })
            .from(modpackFilesTable)
            .where(inArray(modpackFilesTable.hash, chunk));
        for (const r of rows) existing.add(r.hash);
    }
    return existing;
}

export async function curseforgeImportJob(job: Job) {
    const { versionId, modpackId, zipR2Key, manifest } = job.data as {
        versionId: string;
        modpackId: string;
        zipR2Key: string;
        manifest: CurseForgeManifest;
    };

    const jobId = job.id!;
    const start = Date.now();
    const profile = getWorkerProfile();

    // Registro centralizado de temporales: el `finally` los borra TODOS
    // también en error (antes solo se limpiaban en éxito y el disco se llenaba).
    const tempPaths = new Set<string>();
    const trackTemp = (p: string) => { tempPaths.add(p); return p; };
    const untrackTemp = async (p: string) => {
        tempPaths.delete(p);
        try { await Deno.remove(p); } catch { /* best effort */ }
    };

    let tempZipPath: string | null = null;
    let zipFileHandle: Deno.FsFile | null = null;
    let degradedCount = 0;

    try {
        await updateProcessingJob(jobId, { status: ProcessingJobStatus.PROCESSING, progress: 0 });
        log(`═══ curseforge-import [${jobId}] ═══`);
        log(`  Profile: ${profile.name} (dl=${profile.downloadConcurrency} up=${profile.uploadConcurrency} chunk=${profile.insertChunkSize})`);
        log(`  ModpackId: ${modpackId}`);
        log(`  VersionId: ${versionId}`);
        log(`  Mods: ${manifest.files.length}`);

        // ── Step 0: Pre-chequeo de disco (fallar rápido, no OOM a mitad) ──
        const tmpDir = Deno.env.get("TMPDIR") || "/tmp";
        const diskFree = getDiskFreeBytes(tmpDir);
        // Estimación conservadora: el ZIP + los mods descargados + overrides.
        // Sin los tamaños aún, exigimos al menos 512MB libres para packs con mods.
        if (manifest.files.length > 0 && diskFree !== null && diskFree < 512 * 1024 * 1024) {
            throw new Error(
                `LOW_DISK: only ${(diskFree / 1024 / 1024).toFixed(0)}MB free in ${tmpDir}, need ~512MB minimum. Aborting cleanly.`,
            );
        }

        // ── Step 1: Download ZIP from R2 to disk ──
        tempZipPath = trackTemp(await Deno.makeTempFile({ prefix: "cf-import_", suffix: ".zip" }));
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
            (e): e is FileEntry =>
                !e.directory && e.filename.startsWith(`${overrideFolder}/`) && !e.filename.startsWith("__MACOSX/"),
        );

        log(`  ZIP entries: ${entries.length}, overrides: ${overrideEntries.length}`);

        // Extract overrides to disk temp files
        const overrideMetas: FileMeta[] = [];
        const overrideTempFiles = new Map<string, string>(); // hash -> tempPath
        const overrideDeduped = new Map<string, string>(); // path -> hash (for dedup within overrides)

        for (const entry of overrideEntries) {
            if (isMemoryCritical(profile)) {
                throw new Error("LOW_MEMORY: critical pressure while extracting overrides. Aborting cleanly for retry.");
            }
            const relativePath = entry.filename.substring(overrideFolder.length + 1);
            const category = determineOverrideCategory(relativePath);
            const adjustedPath = category === "extras" ? relativePath : `${category}/${relativePath.substring(relativePath.indexOf("/") + 1)}`;

            const tempPath = trackTemp(await Deno.makeTempFile({ prefix: "ovr_", suffix: ".dat" }));
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
                await untrackTemp(tempPath);
                continue;
            }

            // Dedup within overrides
            if (overrideDeduped.has(adjustedPath)) {
                await untrackTemp(tempPath);
                continue;
            }
            overrideDeduped.set(adjustedPath, sha1);

            if (!overrideTempFiles.has(sha1)) {
                overrideTempFiles.set(sha1, tempPath);
            } else {
                await untrackTemp(tempPath);
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

        // Concurrencia auto-ajustada al perfil (1 en survival/free tier).
        const batchSize = Math.max(1, profile.downloadConcurrency);
        for (let i = 0; i < manifest.files.length; i += batchSize) {
            // Watermark de memoria: degradar o abortar limpio ANTES del OOM killer.
            const snap = getMemorySnapshot();
            if (isMemoryCritical(profile, snap)) {
                throw new Error(
                    `LOW_MEMORY: critical pressure at mod ${i}/${manifest.files.length} ` +
                    `(free=${(snap.sysFree / 1024 / 1024).toFixed(0)}MB). Aborting cleanly for retry with lower profile.`,
                );
            }
            if (isMemoryPressured(profile, snap)) {
                degradedCount++;
                maybeGc();
                log(`  [MEM] pressured (free=${(snap.sysFree / 1024 / 1024).toFixed(0)}MB) — throttling, batch of 1`);
                await new Promise((r) => setTimeout(r, 2000));
            }
            const effectiveBatch = isMemoryPressured(profile) ? 1 : batchSize;
            const batch = manifest.files.slice(i, i + effectiveBatch);

            const results = await Promise.allSettled(
                batch.map(async (modFile) => {
                    // UNA sola llamada API (getFile ya trae downloadUrl + fileLength).
                    const resolved = await getFileAndDownloadUrl(modFile.projectID, modFile.fileID);
                    if (!resolved) {
                        log(`  [SKIP] No file info for ${modFile.projectID}/${modFile.fileID}`);
                        return null;
                    }

                    const tempPath = trackTemp(await Deno.makeTempFile({ prefix: "mod_", suffix: ".dat" }));
                    // Descarga + hash incremental en un solo pase de I/O.
                    const dl = await downloadFileWithHash(resolved.downloadUrl, tempPath);
                    if (!dl.ok) {
                        await untrackTemp(tempPath);
                        return null;
                    }

                    const modPath = `mods/${resolved.fileInfo.fileName}`;
                    return {
                        hash: dl.sha1,
                        path: modPath,
                        fileType: "mods" as FileType,
                        side: "both" as FileSide,
                        size: resolved.fileInfo.fileLength || dl.size,
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
                        await untrackTemp(meta.tempPath);
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
            if (i % (batchSize * 5) === 0) {
                await updateProcessingJob(jobId, { progress: batchProgress });
                log(`  Mods progress: ${downloaded + failed}/${manifest.files.length} (${downloaded} ok, ${failed} failed)`);
            }
        }

        log(`  Mods complete: ${downloaded} downloaded, ${failed} failed`);
        await updateProcessingJob(jobId, { progress: 60 });

        // ── Step 4: Check DB for existing files (chunked) ──
        const allHashes = [
            ...new Set([...modMetas.map((m) => m.hash), ...overrideMetas.map((m) => m.hash)]),
        ];
        log(`  Checking ${allHashes.length} unique files against DB (chunks of ${profile.insertChunkSize})...`);

        const existingHashes = await fetchExistingHashes(allHashes, profile.insertChunkSize);

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

        // ── Step 6: Batch upload to R2 (streaming + concurrencia del perfil) ──
        const uploadResult = await batchUploadFromPaths(uploadList, profile.uploadConcurrency);
        log(`  Uploaded ${uploadResult.uploaded} files, ${uploadResult.skipped} failed`);

        if (uploadResult.skipped > 0) {
            throw new Error(`${uploadResult.skipped} of ${uploadList.length} files failed to upload to R2`);
        }

        // Clean up temp files immediately after upload — no longer needed
        for (const p of modTempFiles.values()) {
            await untrackTemp(p);
        }
        modTempFiles.clear();
        for (const p of overrideTempFiles.values()) {
            if (tempPaths.has(p)) await untrackTemp(p);
        }
        overrideTempFiles.clear();

        await updateProcessingJob(jobId, { progress: 80 });

        // ── Step 7: Insert DB records (chunks del perfil) ──
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

        const chunk = profile.insertChunkSize;
        for (let i = 0; i < fileRows.length; i += chunk) {
            await db.insert(modpackFilesTable).values(fileRows.slice(i, i + chunk)).onConflictDoNothing();
        }

        for (let i = 0; i < versionFileRows.length; i += chunk) {
            await db.insert(modpackVersionFilesTable).values(versionFileRows.slice(i, i + chunk)).onConflictDoNothing();
        }

        // ── Step 8: Cleanup temp ZIP ──
        try { await deleteObject(zipR2Key); } catch { /* best effort */ }

        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        log(`  ✅ CurseForge import completed in ${elapsed}s`);
        log(`     Mods: ${downloaded} downloaded, ${failed} failed`);
        log(`     Overrides: ${overrideMetas.length} files`);
        if (degradedCount > 0) log(`     Memory throttled ${degradedCount}x (profile=${profile.name})`);

        await updateProcessingJob(jobId, { status: ProcessingJobStatus.COMPLETED, progress: 100 });

    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : "";
        const lowMem = message.includes("LOW_MEMORY") || message.includes("LOW_DISK");
        log(`  [ERROR] Job failed${lowMem ? " (retryable resource guard)" : ""}: ${message}`);
        if (stack) log(`  [STACK] ${stack}`);
        await updateProcessingJob(jobId, { status: ProcessingJobStatus.FAILED, error: `${message}\n${stack}` });
        throw err;
    } finally {
        if (zipFileHandle) {
            try { zipFileHandle.close(); } catch { }
        }
        // Limpieza garantizada: ZIP + TODOS los .dat aunque haya fallado.
        if (tempZipPath) {
            tempPaths.delete(tempZipPath);
            try { await Deno.remove(tempZipPath); } catch { }
            tempZipPath = null;
        }
        for (const p of [...tempPaths]) {
            try { await Deno.remove(p); } catch { }
        }
        tempPaths.clear();
    }
}
