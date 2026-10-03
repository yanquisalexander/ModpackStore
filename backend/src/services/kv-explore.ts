import { getKv } from "@/db/kv.ts";

const PREFIX = "explore";

export async function getCachedHomepage(): Promise<any | null> {
    const kv = await getKv();
    const res = await kv.get<any>([PREFIX, "homepage"]);
    return res.value ?? null;
}

export async function setCachedHomepage(data: any): Promise<void> {
    const kv = await getKv();
    await kv.set([PREFIX, "homepage"], data, { expireIn: 60_000 }); // 60s
}

export async function getCachedSearch(query: string): Promise<any | null> {
    const kv = await getKv();
    const res = await kv.get<any>([PREFIX, "search", query.toLowerCase()]);
    return res.value ?? null;
}

export async function setCachedSearch(query: string, data: any): Promise<void> {
    const kv = await getKv();
    await kv.set([PREFIX, "search", query.toLowerCase()], data, { expireIn: 30_000 }); // 30s
}

export async function getCachedModpack(modpackId: string): Promise<any | null> {
    const kv = await getKv();
    const res = await kv.get<any>([PREFIX, "modpack", modpackId]);
    return res.value ?? null;
}

export async function setCachedModpack(modpackId: string, data: any): Promise<void> {
    const kv = await getKv();
    await kv.set([PREFIX, "modpack", modpackId], data, { expireIn: 300_000 }); // 5min
}

export async function getCachedVersions(modpackId: string): Promise<any | null> {
    const kv = await getKv();
    const res = await kv.get<any>([PREFIX, "versions", modpackId]);
    return res.value ?? null;
}

export async function setCachedVersions(modpackId: string, data: any): Promise<void> {
    const kv = await getKv();
    await kv.set([PREFIX, "versions", modpackId], data, { expireIn: 300_000 }); // 5min
}

export async function getCachedVersionFiles(versionId: string, target: string): Promise<any | null> {
    const kv = await getKv();
    const res = await kv.get<any>([PREFIX, "files", versionId, target]);
    return res.value ?? null;
}

export async function setCachedVersionFiles(versionId: string, target: string, data: any): Promise<void> {
    const kv = await getKv();
    await kv.set([PREFIX, "files", versionId, target], data, { expireIn: 300_000 }); // 5min
}

export async function getCachedTos(): Promise<any | null> {
    const kv = await getKv();
    const res = await kv.get<any>([PREFIX, "tos"]);
    return res.value ?? null;
}

export async function setCachedTos(data: any): Promise<void> {
    const kv = await getKv();
    await kv.set([PREFIX, "tos"], data, { expireIn: 300_000 }); // 5min
}

export async function invalidateModpackCache(modpackId: string): Promise<void> {
    const kv = await getKv();
    await kv.delete([PREFIX, "modpack", modpackId]);
    await kv.delete([PREFIX, "versions", modpackId]);
}

export async function invalidateHomepageCache(): Promise<void> {
    const kv = await getKv();
    await kv.delete([PREFIX, "homepage"]);
}

export async function invalidateAllExploreCache(): Promise<void> {
    const kv = await getKv();
    // Deno KV no soporta list con prefijos por batches, así que borramos uno a uno conocido.
    // Para una implementación completa se usaría KV atomic operations.
    await kv.delete([PREFIX, "homepage"]);
    // Las keys search/modpack/versions/files se borran por TTL.
}