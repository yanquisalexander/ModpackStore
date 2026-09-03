import { Queue } from 'bullmq'
import { redisConnection } from '@/services/redis.ts'

export const ProcessModpackFilesQueue = new Queue('process-modpack-files', {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: true,
        delay: 5_000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
    },
})
