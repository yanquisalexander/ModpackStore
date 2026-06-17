import { Queue } from 'bullmq'

const redisUrl = Deno.env.get("REDIS_URL") || "redis://localhost:6379";

export const ProcessModpackFilesQueue = new Queue('process-modpack-files', {
    connection: { url: redisUrl },
    defaultJobOptions: {
        removeOnComplete: true,
        delay: 5_000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
    },
})
