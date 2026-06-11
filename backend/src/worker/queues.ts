import { Queue } from 'bullmq'
import { redisConnection } from '@/services/redis.ts'

export const ProcessModpackFilesQueue = new Queue('process-modpack-files', {
    connection: {
        host: redisConnection.options.host || "localhost",
        port: redisConnection.options.port || 6379,
    },
    defaultJobOptions: {
        removeOnComplete: true,
        delay: 5_000, // Optional: Add a small delay between job addition and processing to simulate real-world conditions
    },
})
