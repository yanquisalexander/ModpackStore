import { getKv } from "@/db/kv.ts";

const PREFIX = "explore";
// Deno KV: valor máximo 65536 bytes. Dejamos margen porque el tamaño
// serializado supera al JSON (overhead de tipos). Si excede, no cacheamos.
const MAX_VALUE_BYTES = 50_000;

function estimateSize(value: unknown): number {
    try {
        return JSON.stringify(value)?.length ?? MAX_VALUE_BYTES + 1;
    } catch {
        return MAX_VALUE_BYTES + 1;
    }
}

async function safeSet(key: Deno.KvKey, value: unknown, expireIn: number): Promise<void> {
    try {
        if (estimateSize(value) > MAX_VALUE_BYTES) return; // demasiado grande: skip silencioso
        const kv = await getKv();
        await kv.set(key, value, { expireIn });
    } catch {
        // Cache best-effort: nunca debe romper el request.
    }
}

async function safeGet<T>(key: Deno.KvKey): Promise<T | null> {
    try {
        const kv = await getKv();
        const res = await kv.get<T>(key);
        return res.value ?? null;
    } catch {
        return null;
    }
}

export function getCachedHomepage(): Promise<any | null> {
    return safeGet([PREFIX, "homepage"]);
}

export function setCachedHomepage(data: any): Promise<void> {
    return safeSet([PREFIX, "homepage"], data, 60_000); // 60s
}

export function getCachedSearch(query: string): Promise<any | null> {
    return safeGet([PREFIX, "search", query.toLowerCase()]);
}

export function setCachedSearch(query: string, data: any): Promise<void> {
    return safeSet([PREFIX, "search", query.toLowerCase()], data, 30_000); // 30s
}

export function getCachedModpack(modpackId: string): Promise<any | null> {
    return safeGet([PREFIX, "modpack", modpackId]);
}

export function setCachedModpack(modpackId: string, data: any): Promise<void> {
    return safeSet([PREFIX, "modpack", modpackId], data, 300_000); // 5min
}

export function getCachedVersions(modpackId: string): Promise<any | null> {
    return safeGet([PREFIX, "versions", modpackId]);
}

export function setCachedVersions(modpackId: string, data: any): Promise<void> {
    return safeSet([PREFIX, "versions", modpackId], data, 300_000); // 5min
}

export function getCachedVersionFiles(versionId: string, target: string): Promise<any | null> {
    return safeGet([PREFIX, "files", versionId, target]);
}

export function setCachedVersionFiles(versionId: string, target: string, data: any): Promise<void> {
    return safeSet([PREFIX, "files", versionId, target], data, 300_000); // 5min
}

export function getCachedTos(): Promise<any | null> {
    return safeGet([PREFIX, "tos"]);
}

export function setCachedTos(data: any): Promise<void> {
    return safeSet([PREFIX, "tos"], data, 300_000); // 5min
}

export async function invalidateModpackCache(modpackId: string): Promise<void> {
    try {
        const kv = await getKv();
        await kv.delete([PREFIX, "modpack", modpackId]);
        await kv.delete([PREFIX, "versions", modpackId]);
    } catch {
        // best-effort
    }
}

export async function invalidateHomepageCache(): Promise<void> {
    try {
        const kv = await getKv();
        await kv.delete([PREFIX, "homepage"]);
    } catch {
        // best-effort
    }
}

export async function invalidateAllExploreCache(): Promise<void> {
    try {
        const kv = await getKv();
        // Deno KV no soporta list con prefijos por batches, así que borramos uno a uno conocido.
        // Para una implementación completa se usaría KV atomic operations.
        await kv.delete([PREFIX, "homepage"]);
        // Las keys search/modpack/versions/files se borran por TTL.
    } catch {
        // best-effort
    }
}
