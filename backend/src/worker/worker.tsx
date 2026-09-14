/** @jsxImportSource @hono/hono/jsx */

import { Worker } from "bullmq";
import { Hono } from "@hono/hono";
import { redisConnection } from "@/services/redis.ts";
import { getJobHandler } from "@/jobs/index.ts";
import { ProcessModpackFilesQueue, CurseForgeImportQueue } from "@/worker/queues.ts";
import { db } from "@/db/client.ts";
import { modpackVersionProcessingJobsTable, ProcessingJobStatus } from "@/db/schema.ts";
import { eq, and, lt, or } from "drizzle-orm";
import { StatusPage } from "./status-page.tsx";
import type { StatusPageData } from "./status-page.tsx";
import { log, getLogBuffer, subscribeLogs } from "@/lib/logger.ts";
import { cleanupOldTempZips } from "@/lib/r2.ts";

log("Initializing worker...");

redisConnection.on("error", (err) => {
    log("[REDIS_CONNECTION_ERROR]", err);
    Deno.exit(1);
});

// --- State ---
let server: Deno.HttpServer | null = null;
let startedAt = Date.now();
let workerStatus = "initializing";
let completedCount = 0;
let failedCount = 0;
let activeJobId: string | null = null;

// --- Status HTTP server ---
const app = new Hono();

// Endpoint ultra-ligero para el Healthcheck de Render
app.get("/health", (c) => c.text("OK", 200));

app.get("/", (c) => c.body(null, 204));

app.get("/status", async (c) => {
    const [jobCounts, memory, systemMemory] = await Promise.all([
        ProcessModpackFilesQueue.getJobCounts().catch(() => null),
        Promise.resolve(Deno.memoryUsage()),
        Promise.resolve(Deno.systemMemoryInfo()).catch(() => null),
    ]);

    const data: StatusPageData = {
        status: workerStatus,
        startedAt,
        completed: completedCount,
        failed: failedCount,
        activeJobId,
        queueName: "process-modpack-files",
        jobCounts: (jobCounts ?? { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }) as StatusPageData["jobCounts"],
        memory: {
            rss: memory.rss,
            heapTotal: memory.heapTotal,
            heapUsed: memory.heapUsed,
        },
        systemMemory: systemMemory
            ? { total: systemMemory.total, free: systemMemory.free }
            : { total: 0, free: 0 },
        cpuCores: navigator.hardwareConcurrency ?? 0,
    };

    return c.html(<StatusPage stats={data} />);
});

app.get("/status/stream", (c) => {
    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Nota: Asegúrate que getLogBuffer() no crezca infinitamente en logger.ts
    for (const line of getLogBuffer()) {
        writer.write(encoder.encode(`data: ${line}\n\n`));
    }

    const unsub = subscribeLogs((line) => {
        writer.write(encoder.encode(`data: ${line}\n\n`));
    });

    c.req.raw.signal.addEventListener("abort", () => {
        unsub();
        writer.close();
    });

    return new Response(readable, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
});

function startServer() {
    if (server) return;

    const desiredPort = (() => {
        try {
            return Number(Deno.env.get("WORKER_PORT") ?? 0);
        } catch {
            return 0;
        }
    })();

    const serveOptions = {
        port: desiredPort > 0 ? desiredPort : 0,
        onListen: (addr: Deno.NetAddr) => {
            log(`Worker status server listening on port ${addr.port}`);
        },
    };

    server = Deno.serve(serveOptions, app.fetch);
}

// --- Recovery: Recuperación en lotes para no saturar memoria ---
async function recoverStuckJobs() {
    try {
        log("Checking for orphaned jobs...");
        const limit = 50; // Procesar en lotes pequeños
        let offset = 0;
        let hasMore = true;

        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

        while (hasMore) {
            // Buscamos PENDING o PROCESSING obsoletos
            const stuckJobs = await db.select()
                .from(modpackVersionProcessingJobsTable)
                .where(
                    or(
                        eq(modpackVersionProcessingJobsTable.status, ProcessingJobStatus.PENDING),
                        and(
                            eq(modpackVersionProcessingJobsTable.status, ProcessingJobStatus.PROCESSING),
                            lt(modpackVersionProcessingJobsTable.updatedAt, fiveMinAgo)
                        )
                    )
                )
                .limit(limit)
                .offset(offset);

            if (stuckJobs.length === 0) {
                hasMore = false;
                break;
            }

            log(`Processing batch of ${stuckJobs.length} stuck/stale jobs (offset ${offset})...`);

            for (const record of stuckJobs) {
                // Resetear estado en DB si estaba estancado en PROCESSING
                if (record.status === ProcessingJobStatus.PROCESSING) {
                    await db.update(modpackVersionProcessingJobsTable)
                        .set({ status: ProcessingJobStatus.PENDING, updatedAt: new Date() })
                        .where(eq(modpackVersionProcessingJobsTable.jobId, record.jobId));
                }

                await ProcessModpackFilesQueue.add(
                    "process-modpack-files",
                    { versionId: record.versionId, fileType: record.fileType },
                    {
                        jobId: record.jobId,
                        override: true,
                        delay: 0,
                        removeOnComplete: { age: 3600, count: 100 },
                        removeOnFail: { age: 24 * 3600, count: 100 }
                    }
                );
                log(`  Re-enqueued job ${record.jobId} (${record.fileType})`);
            }

            offset += limit;
        }

        log("Recovery process finished.");
    } catch (err) {
        log(`[RECOVERY_ERROR] Failed to recover stuck jobs: ${err}`);
    }
}

// --- Worker ---
const worker = new Worker(
    "process-modpack-files",
    async (job) => {
        const handler = getJobHandler(job.name);

        if (!handler) {
            log(`No handler registered for job type: ${job.name}`);
            return;
        }

        log(`Processing job ${job.id} of type ${job.name} with data:`, job.data);
        await handler(job);
    },
    {
        connection: redisConnection,
        concurrency: 1, // Mantiene bajo el consumo de CPU/RAM
        maxStalledCount: 1, // Configurado para delegar stalled jobs
        lockDuration: 30000,
    },
);

worker.on("ready", async () => {
    log("Worker is ready and listening for jobs...");
    workerStatus = "ready";
    startedAt = Date.now();

    startServer();
    await recoverStuckJobs();

    // Limpieza de R2 al iniciar
    try {
        const cleaned = await cleanupOldTempZips(24 * 60 * 60 * 1000);
        if (cleaned > 0) log(`Cleaned up ${cleaned} old temp ZIP(s) from R2.`);
    } catch (err) {
        log(`[CLEANUP_WARN] Failed to clean old temp ZIPs: ${err}`);
    }

    // Tarea cron en memoria para limpiar recursos cada 6 horas
    setInterval(async () => {
        try {
            const cleaned = await cleanupOldTempZips(24 * 60 * 60 * 1000);
            if (cleaned > 0) log(`[CRON] Cleaned up ${cleaned} old temp ZIP(s) from R2.`);
        } catch (err) {
            log(`[CRON_ERROR] Failed to clean old temp ZIPs: ${err}`);
        }
    }, 6 * 60 * 60 * 1000);
});

worker.on("active", (job) => {
    log(`Job ${job.id} of type ${job.name} is now active.`);
    workerStatus = "active";
    activeJobId = job.id ?? null;
});

worker.on("completed", (job) => {
    log(`Job ${job.id} of type ${job.name} has completed.`);
    completedCount++;
    activeJobId = null;
});

worker.on("failed", (job, err) => {
    log(`Job ${job?.id ?? "unknown"} has failed:`, err.message);
    failedCount++;
    activeJobId = null;
});

worker.on("paused", () => {
    workerStatus = "paused";
});

worker.on("closed", () => {
    workerStatus = "closed";
});

worker.on("drained", () => {
    workerStatus = "ready";
});

worker.on("error", (err) => {
    log("[WORKER_ERROR]", err);
    workerStatus = "error";
});

// --- Backup Worker ---
const backupWorker = new Worker(
    "backup-operations",
    async (job) => {
        const handler = getJobHandler(job.name);

        if (!handler) {
            log(`No handler registered for job type: ${job.name}`);
            return;
        }

        log(`Processing backup job ${job.id} of type ${job.name} with data:`, job.data);
        await handler(job);
    },
    {
        connection: redisConnection,
        concurrency: 1,
        maxStalledCount: 1,
        lockDuration: 300000, // 5 minutes for large backups
    },
);

backupWorker.on("ready", () => {
    log("Backup worker is ready and listening for jobs...");
});

backupWorker.on("active", (job) => {
    log(`Backup job ${job.id} of type ${job.name} is now active.`);
});

backupWorker.on("completed", (job) => {
    log(`Backup job ${job.id} of type ${job.name} has completed.`);
});

backupWorker.on("failed", (job, err) => {
    log(`Backup job ${job?.id ?? "unknown"} has failed:`, err.message);
});

backupWorker.on("error", (err) => {
    log("[BACKUP_WORKER_ERROR]", err);
});

// --- CurseForge Import Worker ---
const curseforgeWorker = new Worker(
    "curseforge-import",
    async (job) => {
        const handler = getJobHandler(job.name);

        if (!handler) {
            log(`No handler registered for job type: ${job.name}`);
            return;
        }

        log(`Processing CurseForge import job ${job.id} with data:`, job.data);
        await handler(job);
    },
    {
        connection: redisConnection,
        concurrency: 1,
        maxStalledCount: 1,
        lockDuration: 60000, // 60s per mod download batch
    },
);

curseforgeWorker.on("ready", () => {
    log("CurseForge import worker is ready...");
});

curseforgeWorker.on("active", (job) => {
    log(`CurseForge job ${job.id} is now active.`);
});

curseforgeWorker.on("completed", (job) => {
    log(`CurseForge job ${job.id} has completed.`);
});

curseforgeWorker.on("failed", (job, err) => {
    log(`CurseForge job ${job?.id ?? "unknown"} has failed:`, err.message);
});

curseforgeWorker.on("error", (err) => {
    log("[CURSEFORGE_WORKER_ERROR]", err);
});

// --- Graceful Shutdown ---
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log(`\n[SHUTDOWN] Received ${signal}. Gracefully shutting down worker...`);
    workerStatus = "shutting_down";

    try {
        // 1. Detener el servidor HTTP para dejar de recibir peticiones de status/health
        if (server) {
            log("[SHUTDOWN] Stopping HTTP Server...");
            await server.shutdown();
        }

        // 2. Esperar a que el Worker termine su trabajo activo actual (si lo hay)
        log("[SHUTDOWN] Closing BullMQ Workers (waiting for active jobs to finish)...");
        await worker.close();
        await backupWorker.close();
        await curseforgeWorker.close();

        // 3. Cerrar la conexión de Redis limpiamente
        log("[SHUTDOWN] Quitting Redis connection...");
        redisConnection.quit();

        log("[SHUTDOWN] Cleanup complete. Exiting process.");
        Deno.exit(0);
    } catch (error) {
        log(`[SHUTDOWN_ERROR] Error during shutdown: ${error}`);
        Deno.exit(1);
    }
}

// Interceptar señales de término enviadas por Render
Deno.addSignalListener("SIGINT", () => gracefulShutdown("SIGINT"));
Deno.addSignalListener("SIGTERM", () => gracefulShutdown("SIGTERM"));