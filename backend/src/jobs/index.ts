import { processModpackFiles, QUEUE_NAME as ProcessModpackFilesQueueName } from './process-modpack-file.job.ts'
import type { Job } from 'bullmq'

type JobHandler = (job: Job) => Promise<void>

const jobHandlers: Record<string, JobHandler> = {
    [ProcessModpackFilesQueueName]: processModpackFiles,
}

export function getJobHandler(queueName: string): JobHandler | undefined {
    return jobHandlers[queueName]
}
