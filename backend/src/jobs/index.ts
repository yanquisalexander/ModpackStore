import { processModpackFiles, QUEUE_NAME as ProcessModpackFilesQueueName } from './process-modpack-file.job.ts'
import { curseforgeImportJob, QUEUE_NAME as CurseForgeImportQueueName } from './curseforge-import.job.ts'
import { backupExportJob } from './backup-export.job.ts'
import { backupRestoreJob } from './backup-restore.job.ts'
import type { Job } from 'bullmq'

type JobHandler = (job: Job) => Promise<void>

const jobHandlers: Record<string, JobHandler> = {
    [ProcessModpackFilesQueueName]: processModpackFiles,
    [CurseForgeImportQueueName]: curseforgeImportJob,
    'backup-export': backupExportJob,
    'backup-restore': backupRestoreJob,
}

export function getJobHandler(jobName: string): JobHandler | undefined {
    return jobHandlers[jobName]
}
