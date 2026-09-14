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

export const CurseForgeImportQueue = new Queue('curseforge-import', {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: true,
        delay: 5_000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
    },
})

export const BackupOperationsQueue = new Queue('backup-operations', {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: { age: 3600 * 24, count: 50 },
        removeOnFail: { age: 3600 * 24 * 7, count: 20 },
        attempts: 1,
    },
})
