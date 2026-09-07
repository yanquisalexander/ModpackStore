import type { Job } from "bullmq";
import { createHash } from "node:crypto";
import { Reader, Writer, ZipReader } from "@zip-js/zip-js";
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
import { downloadObjectToFile, uploadObject, deleteObject, getTempZipKey, getFileKey, fileExists } from "@/lib/r2.ts";

const INSERT_CHUNK_SIZE = 500;

// --- Helper para que zip.js lea desde el disco en lugar de la RAM ---
class DenoFileReader extends Reader<Deno.FsFile> {
    file: Deno.FsFile;
    constructor(file: Deno.FsFile, size: number) {
        super(file);
        this.file = file;
        this.size = size; // Propiedad requerida por zip.js
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

// --- Writer para que zip.js escriba directamente al archivo temporal ---
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

    // Almacenará la ruta de nuestro ZIP temporal en disco
    let tempZipPath: string | null = null;
    let zipFile: Deno.FsFile | null = null;

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

        // 1. Crear archivo temporal en disco para descargar el ZIP
        tempZipPath = await Deno.makeTempFile({ prefix: "modpack_", suffix: ".zip" });
        log(`  ZIP key: ${zipKey}`);
        log(`  Downloading ZIP directly to disk (${tempZipPath})...`);

        try {
            // DEBES cambiar tu función en r2.ts para que guarde directo al disco
            await downloadObjectToFile(zipKey, tempZipPath);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log(`  [ERROR] Failed to download ZIP: ${msg}`);
            await updateProcessingJob(jobId, { status: ProcessingJobStatus.FAILED, error: `Failed to download ZIP: ${msg}` });
            if (msg.includes("NoSuchKey") || msg.includes("does not exist")) return;
            throw err;
        }

        await updateProcessingJob(jobId, { progress: 20 });

        // 2. Abrir el ZIP desde el disco sin cargarlo a RAM
        zipFile = await Deno.open(tempZipPath, { read: true });
        const zipStat = await zipFile.stat();
        log(`  Downloaded ${(zipStat.size / 1024 / 1024).toFixed(2)} MB to disk`);

        log(`  Reading ZIP entries...`);
        const zipReader = new ZipReader(new DenoFileReader(zipFile, zipStat.size));
        const entries = await zipReader.getEntries();

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
        let crossJobSkipped = 0;

        // 3. Procesar archivo por archivo
        for (const entry of entries) {
            if (entry.directory) continue;
            if (entry.filename.startsWith("__MACOSX/")) { skipped++; continue; }
            if (entry.filename.startsWith(".")) { skipped++; continue; }

            // Creamos un archivo temporal para extraer este mod específico
            const tempEntryPath = await Deno.makeTempFile({ prefix: "entry_", suffix: ".dat" });
            let entryFile = await Deno.open(tempEntryPath, { write: true, read: true, create: true });
            const entryWriter = new DenoFileWriter(entryFile);

            let sha1Hex = "";

            try {
                // Función de Hashing en streaming (0 memoria extra)
                const hash = createHash("sha1");
                const originalWrite = entryWriter.writeUint8Array.bind(entryWriter);
                entryWriter.writeUint8Array = async (array: Uint8Array) => {
                    hash.update(array); // Hash on the fly
                    await originalWrite(array); // Guardar en disco on the fly
                };

                // Extraemos el archivo escribiéndolo directo al archivo temporal
                await entry.getData(entryWriter);
                sha1Hex = hash.digest("hex");

                // Verificamos el tamaño real del archivo extraído
                const entryStat = await entryFile.stat();
                const contentSize = entryStat.size;

                if (contentSize === 0) {
                    skipped++;
                    continue;
                }

                const filePath = stripPrefix ? entry.filename.slice(stripPrefix.length) : entry.filename;
                const side = determineSideByPath(filePath);

                fileMetas.push({ hash: sha1Hex, path: filePath, fileType: fileType as FileType, side, size: contentSize });

                // LÓGICA DE DE-DUPLICACIÓN MÁGICA
                if (!uniqueMetas.has(sha1Hex)) {
                    uniqueMetas.set(sha1Hex, { hash: sha1Hex, path: filePath, fileType: fileType as FileType, side, size: contentSize });

                    const exists = await fileExists(getFileKey(sha1Hex));
                    if (exists) {
                        crossJobSkipped++;
                    } else {
                        await entryFile.seek(0, Deno.SeekMode.Start);
                        const fileBytes = new Uint8Array(contentSize);
                        await entryFile.read(fileBytes);
                        await uploadObject(getFileKey(sha1Hex), fileBytes, "application/octet-stream");
                        uploaded++;
                    }
                } else {
                    dedupSavingsLocal += contentSize;
                }

                const ext = filePath.includes(".") ? filePath.split(".").pop()!.toLowerCase() : "(none)";
                extCounts.set(ext, (extCounts.get(ext) ?? 0) + 1);

                if (fileMetas.length % 50 === 0) {
                    log(`  Progress: ${fileMetas.length} files scanned, ${uploaded} uploaded...`);
                }

            } finally {
                // Siempre cerrar y borrar el archivo temporal del mod (RAM y Disco limpios)
                try {
                    entryFile.close();
                    await Deno.remove(tempEntryPath);
                } catch { /* Ignorar si ya fue cerrado */ }
            }
        }

        await zipReader.close();

        log(`  Uploaded ${uploaded} new files to R2 (skipped ${crossJobSkipped} already in R2, ${dedupSavingsLocal > 0 ? `${(dedupSavingsLocal / 1024 / 1024).toFixed(2)} MB deduped within ZIP` : "no intra-ZIP dupes"})`);

        await updateProcessingJob(jobId, { progress: 40 });

        const uploadEnd = Date.now();
        log(`  All uploads done in ${((uploadEnd - start) / 1000).toFixed(1)}s`);
        log(`  Inserting DB records...`);

        const insertStart = Date.now();
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

        for (let i = 0; i < fileRows.length; i += INSERT_CHUNK_SIZE) {
            const chunk = fileRows.slice(i, i + INSERT_CHUNK_SIZE);
            await db.insert(modpackFilesTable).values(chunk).onConflictDoNothing();
        }

        for (let i = 0; i < versionFileRows.length; i += INSERT_CHUNK_SIZE) {
            const chunk = versionFileRows.slice(i, i + INSERT_CHUNK_SIZE);
            await db.insert(modpackVersionFilesTable).values(chunk).onConflictDoNothing();
        }

        await updateProcessingJob(jobId, { progress: 80 });
        log(`  ✅ Completed in ${((Date.now() - start) / 1000).toFixed(1)}s`);
        await updateProcessingJob(jobId, { status: ProcessingJobStatus.COMPLETED, progress: 100 });

        if (zipKey) {
            try {
                await deleteObject(zipKey);
                log(`  Cleaned up temp ZIP in R2: ${zipKey}`);
            } catch { /* Best effort */ }
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : "";
        log(`  [ERROR] Job failed: ${message}`);
        if (stack) log(`  [STACK] ${stack}`);
        await updateProcessingJob(jobId, { status: ProcessingJobStatus.FAILED, error: `${message}\n${stack}` });
        throw err;
    } finally {
        // Limpiar recursos físicos del Worker
        if (zipFile) {
            try { zipFile.close(); } catch { }
        }
        if (tempZipPath) {
            try { await Deno.remove(tempZipPath); } catch { }
        }
    }
}