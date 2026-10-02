/**
 * auto-tune.ts — Detección automática de recursos y perfiles de trabajo.
 *
 * Objetivo: que el mismo código sobreviva en Render free tier (512MB) y rinda
 * más en planes mayores SIN configuración manual. Todo se autodetecta en
 * arranque (cgroup, RAM, CPU, disco) y se degrada en caliente si la memoria
 * sube durante un job.
 *
 * Los env vars existen solo como override manual opcional:
 *   WORKER_PROFILE=survival|small|standard
 *   CF_DL_CONCURRENCY, CF_UPLOAD_CONCURRENCY, CF_API_CONCURRENCY,
 *   CF_INSERT_CHUNK, V8_MAX_MEMORY
 */

export type WorkerProfileName = "survival" | "small" | "standard";

export interface WorkerProfile {
    name: WorkerProfileName;
    /** RAM total detectada del contenedor en bytes */
    containerTotalBytes: number;
    /** Heap V8 recomendado en MB (ya con margen para memoria nativa) */
    heapMB: number;
    /** Descargas concurrentes de mods */
    downloadConcurrency: number;
    /** Uploads concurrentes a R2 */
    uploadConcurrency: number;
    /** Llamadas concurrentes a la API de CurseForge */
    apiConcurrency: number;
    /** Tamaño de chunk para inserts/selects en DB */
    insertChunkSize: number;
    /** Jobs pesados simultáneos permitidos en este proceso */
    maxHeavyJobsParallel: number;
    /** lockDuration BullMQ recomendado (ms) */
    lockDurationMs: number;
    /** Si true, los uploads usan streaming sí o sí */
    forceStreamingUpload: boolean;
    /** Archivos <= este tamaño pueden subirse bufferizados (solo si !forceStreamingUpload) */
    bufferedUploadMaxBytes: number;
    /** Umbral de RAM libre para entrar en modo degradado */
    degradedFreeBytes: number;
    /** Umbral de RAM libre para abortar limpio antes del OOM */
    abortFreeBytes: number;
    /** Si el perfil vino de override manual */
    manual: boolean;
}

export interface MemorySnapshot {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    sysTotal: number;
    sysFree: number;
}

const MB = 1024 * 1024;
const DEFAULT_TOTAL_BYTES = 512 * MB;

let cached: WorkerProfile | null = null;

function envInt(name: string): number | null {
    try {
        const raw = Deno.env.get(name);
        if (!raw) return null;
        const n = parseInt(raw, 10);
        return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
        return null;
    }
}

function readTextFileSafe(path: string): string | null {
    try {
        return Deno.readTextFileSync(path).trim();
    } catch {
        return null;
    }
}

/** Lee el límite de RAM del contenedor vía cgroups (v2 y v1). Null si no hay límite. */
export function detectContainerMemoryBytes(): number | null {
    // cgroups v2 (Render / Docker moderno)
    const v2 = readTextFileSafe("/sys/fs/cgroup/memory.max");
    if (v2 && v2 !== "max") {
        const n = parseInt(v2, 10);
        if (Number.isFinite(n) && n > 0 && n < Number.MAX_SAFE_INTEGER) return n;
    }
    // cgroups v1
    const v1 = readTextFileSafe("/sys/fs/cgroup/memory/memory.limit_in_bytes");
    if (v1) {
        const n = parseInt(v1, 10);
        // Un valor absurdamente alto significa "sin límite"
        if (Number.isFinite(n) && n > 0 && n < 9223372036854771707) return n;
    }
    return null;
}

function systemTotalBytes(): number {
    try {
        const info = Deno.systemMemoryInfo();
        if (info.total > 0) return info.total;
    } catch {
        // sin permiso --allow-sys o no disponible
    }
    return DEFAULT_TOTAL_BYTES;
}

function cpuCount(): number {
    try {
        return Math.max(1, navigator.hardwareConcurrency ?? 1);
    } catch {
        return 1;
    }
}

function profileForTotal(totalBytes: number): WorkerProfileName {
    if (totalBytes < 700 * MB) return "survival";
    if (totalBytes < 1300 * MB) return "small";
    return "standard";
}

function heapFor(totalBytes: number, name: WorkerProfileName): number {
    const manual = envInt("V8_MAX_MEMORY");
    if (manual) return manual;
    const totalMB = Math.floor(totalBytes / MB);
    // Margen para memoria nativa (Deno, AWS SDK, zip, buffers fuera de V8).
    // En free tier el margen relativo tiene que ser mayor porque el SO ya
    // consume una parte fija.
    switch (name) {
        case "survival":
            return Math.max(192, totalMB - 192);
        case "small":
            return Math.max(256, totalMB - 256);
        case "standard":
            return Math.max(512, totalMB - 512);
    }
}

function buildProfile(name: WorkerProfileName, totalBytes: number, manual: boolean): WorkerProfile {
    const cpus = cpuCount();
    const base = (() => {
        switch (name) {
            case "survival":
                return {
                    downloadConcurrency: 1,
                    uploadConcurrency: 1,
                    apiConcurrency: 1,
                    insertChunkSize: 100,
                    maxHeavyJobsParallel: 1,
                    lockDurationMs: 120_000,
                    forceStreamingUpload: true,
                    degradedFreeBytes: 80 * MB,
                    abortFreeBytes: 40 * MB,
                };
            case "small":
                return {
                    downloadConcurrency: Math.min(2, cpus),
                    uploadConcurrency: 2,
                    apiConcurrency: 2,
                    insertChunkSize: 200,
                    maxHeavyJobsParallel: 1,
                    lockDurationMs: 90_000,
                    forceStreamingUpload: true,
                    degradedFreeBytes: 120 * MB,
                    abortFreeBytes: 60 * MB,
                };
            case "standard":
                return {
                    downloadConcurrency: Math.min(5, Math.max(2, cpus)),
                    uploadConcurrency: 3,
                    apiConcurrency: 3,
                    insertChunkSize: 500,
                    maxHeavyJobsParallel: 2,
                    lockDurationMs: 60_000,
                    forceStreamingUpload: false,
                    degradedFreeBytes: 200 * MB,
                    abortFreeBytes: 100 * MB,
                };
        }
    })();

    return {
        name,
        containerTotalBytes: totalBytes,
        heapMB: heapFor(totalBytes, name),
        downloadConcurrency: envInt("CF_DL_CONCURRENCY") ?? base.downloadConcurrency,
        uploadConcurrency: envInt("CF_UPLOAD_CONCURRENCY") ?? base.uploadConcurrency,
        apiConcurrency: envInt("CF_API_CONCURRENCY") ?? base.apiConcurrency,
        insertChunkSize: envInt("CF_INSERT_CHUNK") ?? base.insertChunkSize,
        maxHeavyJobsParallel: envInt("CF_MAX_HEAVY_JOBS") ?? base.maxHeavyJobsParallel,
        lockDurationMs: base.lockDurationMs,
        forceStreamingUpload: base.forceStreamingUpload,
        bufferedUploadMaxBytes: 8 * MB,
        degradedFreeBytes: base.degradedFreeBytes,
        abortFreeBytes: base.abortFreeBytes,
        manual,
    };
}

/**
 * Resuelve (y cachea) el perfil de trabajo. Llamar una vez en arranque y
 * reutilizar el objeto. `resetAutoTune()` permite recalcular (tests o
 * degradado por OOM previos).
 */
export function getWorkerProfile(): WorkerProfile {
    if (cached) return cached;
    const manualName = (() => {
        try {
            const raw = Deno.env.get("WORKER_PROFILE")?.toLowerCase();
            if (raw === "survival" || raw === "small" || raw === "standard") return raw;
        } catch {
            // ignore
        }
        return null;
    })();
    const total = detectContainerMemoryBytes() ?? systemTotalBytes();
    const name = manualName ?? profileForTotal(total);
    cached = buildProfile(name, total, manualName !== null);
    return cached;
}

/** Baja un nivel el perfil (backoff tras OOM/aborto). Puro y testeable. */
export function downgradeProfile(p: WorkerProfile): WorkerProfile {
    const next: WorkerProfileName = p.name === "standard" ? "small" : "survival";
    if (next === p.name) return p;
    return { ...buildProfile(next, p.containerTotalBytes, p.manual), manual: false };
}

/** Invalida la caché (tests, o tras registrar un OOM en Redis). */
export function resetAutoTune(): void {
    cached = null;
}

/** Fija el perfil activo (p.ej. tras backoff por LOW_MEMORY previos). */
export function forceWorkerProfile(p: WorkerProfile): void {
    cached = p;
}

/** Snapshot de memoria actual. Nunca lanza. */
export function getMemorySnapshot(): MemorySnapshot {
    let heapUsed = 0, heapTotal = 0, rss = 0;
    try {
        const m = Deno.memoryUsage();
        heapUsed = m.heapUsed;
        heapTotal = m.heapTotal;
        rss = m.rss;
    } catch {
        // ignore
    }
    let sysTotal = 0, sysFree = 0;
    try {
        const s = Deno.systemMemoryInfo();
        sysTotal = s.total;
        sysFree = s.free;
    } catch {
        // sin --allow-sys
    }
    return { heapUsed, heapTotal, rss, sysTotal, sysFree };
}

/** True si hay que degradar (bajar concurrencia, GC, pausar descargas). */
export function isMemoryPressured(profile: WorkerProfile, snap?: MemorySnapshot): boolean {
    const s = snap ?? getMemorySnapshot();
    if (s.sysFree > 0 && s.sysFree < profile.degradedFreeBytes) return true;
    if (s.heapTotal > 0 && s.heapUsed > s.heapTotal * 0.85) return true;
    return false;
}

/** True si hay que abortar limpio antes de que el OOM killer actúe. */
export function isMemoryCritical(profile: WorkerProfile, snap?: MemorySnapshot): boolean {
    const s = snap ?? getMemorySnapshot();
    if (s.sysFree > 0 && s.sysFree < profile.abortFreeBytes) return true;
    if (s.heapTotal > 0 && s.heapUsed > s.heapTotal * 0.95) return true;
    return false;
}

/** Intento best-effort de GC (solo funciona con --v8-flags=--expose-gc). */
export function maybeGc(): void {
    try {
        (globalThis as { gc?: () => void }).gc?.();
    } catch {
        // GC no expuesto; no pasa nada
    }
}

/**
 * Espacio libre en disco para un directorio (bytes). Null si no se puede leer.
 * Deno no expone statfs, así que en Linux (Render) se usa `df` vía
 * Deno.Command (requiere --allow-run=df). En cualquier otro caso devuelve
 * null y los pre-chequeos de disco se omiten (best effort, nunca bloquean).
 */
export function getDiskFreeBytes(dir: string): number | null {
    try {
        const out = new Deno.Command("df", {
            args: ["-k", "--output=avail", dir],
            stdout: "piped",
            stderr: "null",
        }).outputSync();
        if (!out.success) return null;
        const lines = new TextDecoder().decode(out.stdout).trim().split("\n");
        const last = lines[lines.length - 1]?.trim();
        const kb = last ? parseInt(last, 10) : NaN;
        if (Number.isFinite(kb) && kb > 0) return kb * 1024;
        return null;
    } catch {
        return null;
    }
}

/** Limpia archivos temporales huérfanos de jobs muertos (prefijos conocidos). */
export async function cleanupOrphanTempFiles(tmpDir?: string): Promise<number> {
    const dir = tmpDir ?? (Deno.env.get("TMPDIR") || "/tmp");
    const prefixes = ["mod_", "ovr_", "entry_", "cf-import_", "modpack_"];
    // Solo borra archivos antiguos (>30min) para no pisar jobs activos.
    const cutoff = Date.now() - 30 * 60 * 1000;
    let removed = 0;
    try {
        for await (const entry of Deno.readDir(dir)) {
            if (!entry.isFile) continue;
            if (!prefixes.some((p) => entry.name.startsWith(p))) continue;
            try {
                const st = await Deno.stat(`${dir}/${entry.name}`);
                if (st.mtime && st.mtime.getTime() < cutoff) {
                    await Deno.remove(`${dir}/${entry.name}`);
                    removed++;
                }
            } catch {
                // best effort por archivo
            }
        }
    } catch {
        // dir no legible; best effort
    }
    return removed;
}

export function formatProfileLine(p: WorkerProfile): string {
    const totalMB = Math.round(p.containerTotalBytes / MB);
    return `detected=${totalMB}MB profile=${p.name}${p.manual ? " (manual)" : ""} ` +
        `dl=${p.downloadConcurrency} up=${p.uploadConcurrency} api=${p.apiConcurrency} ` +
        `chunk=${p.insertChunkSize} heavyJobs=${p.maxHeavyJobsParallel} heap=${p.heapMB}MB`;
}
