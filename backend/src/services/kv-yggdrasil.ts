import { getKv } from "@/db/kv.ts";

const PREFIX = "yggdrasil";

export async function getCachedSession(accessToken: string): Promise<boolean | null> {
    const kv = await getKv();
    const res = await kv.get<boolean>([PREFIX, "session", accessToken]);
    return res.value ?? null;
}

export async function setCachedSession(accessToken: string, valid: boolean): Promise<void> {
    const kv = await getKv();
    await kv.set([PREFIX, "session", accessToken], valid, { expireIn: 45_000 }); // 45 seconds
}

export async function getCachedHasJoined(userId: string, serverId: string): Promise<boolean | null> {
    const kv = await getKv();
    const res = await kv.get<boolean>([PREFIX, "hasJoined", userId, serverId]);
    return res.value ?? null;
}

export async function setCachedHasJoined(userId: string, serverId: string, valid: boolean): Promise<void> {
    const kv = await getKv();
    await kv.set([PREFIX, "hasJoined", userId, serverId], valid, { expireIn: 45_000 });
}

export async function invalidateAllSessionsForUser(userId: string): Promise<void> {
    // No es posible invalidar directamente de KV; TTL y población de DB garantizarán limpieza.
}
