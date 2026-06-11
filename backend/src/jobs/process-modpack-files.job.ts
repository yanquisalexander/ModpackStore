import type { Job } from 'bullmq'
import { log } from '@/lib/logger.ts'

export const QUEUE_NAME = 'process-modpack-files'

export async function processModpackFiles(job: Job) {
    log('Starting to process modpack files for job:', job.id)
    log('Job data:', JSON.stringify(job.data))
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 5000))
    log('Finished processing modpack files for job:', job.id)
}
