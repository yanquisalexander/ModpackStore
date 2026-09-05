/** @jsxImportSource @hono/hono/jsx */

import { Worker } from "bullmq";
import { Hono } from "@hono/hono";
import { redisConnection } from "@/services/redis.ts";
import { getJobHandler } from "@/jobs/index.ts";
import { ProcessModpackFilesQueue } from "@/worker/queues.ts";
import { db } from "@/db/client.ts";
import { modpackVersionProcessingJobsTable, ProcessingJobStatus } from "@/db/schema.ts";
import { eq, and } from "drizzle-orm";
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

    try {
        server = Deno.serve(
            {
                port: desiredPort,
                onListen: (addr) => {
                    log(`Worker status server listening on port ${addr.port}`);
                },
            },
            app.fetch,
        );
    } catch {
        server = Deno.serve(
            {
                port: 0,
                onListen: (addr) => {
                    log(`Worker status server listening on port ${addr.port}`);
                },
            },
            app.fetch,
        );
    }
}

// --- Recovery: re-enqueue orphaned PENDING and stale PROCESSING jobs ---
async function recoverStuckJobs() {
    try {
        const stuckStatuses = await db.select()
            .from(modpackVersionProcessingJobsTable)
            .where(eq(modpackVersionProcessingJobsTable.status, ProcessingJobStatus.PENDING));

        // Also find PROCESSING jobs older than 5 minutes (stale from crashed worker)
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        const staleProcessing = await db.select()
            .from(modpackVersionProcessingJobsTable)
            .where(eq(modpackVersionProcessingJobsTable.status, ProcessingJobStatus.PROCESSING));

        const staleJobs = staleProcessing.filter(
            (r) => r.updatedAt && r.updatedAt < fiveMinAgo,
        );

        const allJobs = [...stuckStatuses, ...staleJobs];

        if (allJobs.length === 0) {
            log("No stuck jobs to recover.");
            return;
        }

        log(`Found ${allJobs.length} stuck job(s) (${stuckStatuses.length} PENDING, ${staleJobs.length} stale PROCESSING), re-enqueuing...`);

        for (const record of allJobs) {
            // Reset stale PROCESSING back to PENDING in DB
            if (record.status === ProcessingJobStatus.PROCESSING) {
                await db.update(modpackVersionProcessingJobsTable)
                    .set({ status: ProcessingJobStatus.PENDING, updatedAt: new Date() })
                    .where(eq(modpackVersionProcessingJobsTable.jobId, record.jobId));
            }

            const existingJob = await ProcessModpackFilesQueue.getJob(record.jobId);
            if (existingJob) {
                const state = await existingJob.getState();
                if (state === "completed") {
                    await db.update(modpackVersionProcessingJobsTable)
                        .set({ status: ProcessingJobStatus.COMPLETED, progress: "100", updatedAt: new Date() })
                        .where(eq(modpackVersionProcessingJobsTable.jobId, record.jobId));
                    log(`  Job ${record.jobId} already completed, synced DB.`);
                    continue;
                }
                if (state === "failed" || state === "stalled" || state === "active") {
                    await existingJob.remove();
                    await ProcessModpackFilesQueue.add(
                        "process-modpack-files",
                        { versionId: record.versionId, fileType: record.fileType },
                        { jobId: record.jobId },
                    );
                    log(`  Removed stale job ${record.jobId} (was ${state}), re-added fresh (${record.fileType})`);
                    continue;
                }
                log(`  Job ${record.jobId} already ${state}, skipping.`);
                continue;
            }

            await ProcessModpackFilesQueue.add(
                "process-modpack-files",
                { versionId: record.versionId, fileType: record.fileType },
                { jobId: record.jobId },
            );
            log(`  Re-enqueued job ${record.jobId} (${record.fileType})`);
        }

        log("Recovery complete.");

        // Clean up temp ZIPs older than 24 hours
        try {
            const cleaned = await cleanupOldTempZips(24 * 60 * 60 * 1000);
            if (cleaned > 0) {
                log(`Cleaned up ${cleaned} old temp ZIP(s) from R2.`);
            }
        } catch (err) {
            log(`[CLEANUP_WARN] Failed to clean old temp ZIPs: ${err}`);
        }
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
        concurrency: 1,
    },
);

worker.on("ready", async () => {
    log("Worker is ready and listening for jobs...");
    workerStatus = "ready";
    startedAt = Date.now();
    startServer();
    await recoverStuckJobs();
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
