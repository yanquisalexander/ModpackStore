import { Queue } from 'bullmq'
import { getRedisConnection } from '@/services/redis.ts'

let _processQueue: Queue | null = null;
let _curseQueue: Queue | null = null;
let _backupQueue: Queue | null = null;

export function getProcessModpackFilesQueue(): Queue {
    if (!_processQueue) {
        _processQueue = new Queue('process-modpack-files', {
            connection: getRedisConnection(),
            defaultJobOptions: {
                removeOnComplete: true,
                delay: 5_000,
                attempts: 3,
                backoff: { type: 'exponential', delay: 5_000 },
            },
        });
    }
    return _processQueue;
}

export function getCurseForgeImportQueue(): Queue {
    if (!_curseQueue) {
        _curseQueue = new Queue('curseforge-import', {
            connection: getRedisConnection(),
            defaultJobOptions: {
                removeOnComplete: true,
                delay: 5_000,
                attempts: 3,
                backoff: { type: 'exponential', delay: 5_000 },
            },
        });
    }
    return _curseQueue;
}

export function getBackupOperationsQueue(): Queue {
    if (!_backupQueue) {
        _backupQueue = new Queue('backup-operations', {
            connection: getRedisConnection(),
            defaultJobOptions: {
                removeOnComplete: { age: 3600 * 24, count: 50 },
                removeOnFail: { age: 3600 * 24 * 7, count: 20 },
                attempts: 1,
            },
        });
    }
    return _backupQueue;
}

// Compat lazy: importar este módulo ya NO abre Redis ni crea Queues.
// La creación real ocurre en el primer `add/getJob/...`.
function lazyQueue(getter: () => Queue): Queue {
    return new Proxy({} as Queue, {
        get(_t, prop) {
            const q = getter() as unknown as Record<string | symbol, unknown>;
            const v = q[prop as string];
            return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(q) : v;
        },
    });
}

export const ProcessModpackFilesQueue: Queue = lazyQueue(getProcessModpackFilesQueue);
export const CurseForgeImportQueue: Queue = lazyQueue(getCurseForgeImportQueue);
export const BackupOperationsQueue: Queue = lazyQueue(getBackupOperationsQueue);
