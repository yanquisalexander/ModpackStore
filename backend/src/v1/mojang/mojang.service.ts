import { getKv } from "@/db/kv.ts";
import { log } from "@/lib/logger.ts";

const MOJANG_API_BASE = Deno.env.get("MOJANG_API_BASE_URL") ?? "https://api.mojang.com";
const MOJANG_SESSION_BASE = Deno.env.get("MOJANG_SESSION_SERVER_BASE_URL") ?? "https://sessionserver.mojang.com";
const API_TIMEOUT = parseInt(Deno.env.get("MOJANG_TIMEOUT_MS") ?? "10000");
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const UUID_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (UUIDs rarely change)

// ── Types ───────────────────────────────────────────

export interface MojangProfile {
    id: string;
    name: string;
    properties?: Array<{
        name: string;
        value: string;
        signature?: string;
    }>;
    legacy?: boolean;
    profileActions?: string[];
}

export interface MojangUuidResponse {
    id: string;
    name: string;
    legacy?: boolean;
    demo?: boolean;
}

interface CachedProfile {
    data: MojangProfile;
    fetchedAt: number;
}

interface CachedUuid {
    data: MojangUuidResponse;
    fetchedAt: number;
}

// ── HTTP Client ─────────────────────────────────────

async function mojangFetch<T>(url: string, timeout = API_TIMEOUT): Promise<T | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            headers: {
                Accept: "application/json",
                "User-Agent": "ModpackStore/2.0",
            },
            signal: controller.signal,
        });

        if (!response.ok) {
            log(`[MOJANG_API] ${response.status} for ${url}`);
            return null;
        }

        return await response.json() as T;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("abort")) {
            log(`[MOJANG_API] Timeout for ${url}`);
        } else {
            log(`[MOJANG_API] Error for ${url}: ${msg}`);
        }
        return null;
    } finally {
        clearTimeout(timer);
    }
}

// ── Cache Helpers ───────────────────────────────────

async function getCachedProfile(uuid: string): Promise<MojangProfile | null> {
    const kv = await getKv();
    const cached = await kv.get<CachedProfile>(["mojang", "profile", uuid]);
    return cached.value?.data ?? null;
}

async function setCachedProfile(uuid: string, data: MojangProfile): Promise<void> {
    const kv = await getKv();
    await kv.set(
        ["mojang", "profile", uuid],
        { data, fetchedAt: Date.now() },
        { expireIn: CACHE_TTL_MS },
    );
}

async function getCachedUuid(name: string): Promise<MojangUuidResponse | null> {
    const kv = await getKv();
    const cached = await kv.get<CachedUuid>(["mojang", "uuid", name.toLowerCase()]);
    return cached.value?.data ?? null;
}

async function setCachedUuid(name: string, data: MojangUuidResponse): Promise<void> {
    const kv = await getKv();
    await kv.set(
        ["mojang", "uuid", name.toLowerCase()],
        { data, fetchedAt: Date.now() },
        { expireIn: UUID_CACHE_TTL_MS },
    );
}

// ── UUID Lookup ─────────────────────────────────────

export async function getUuidByName(name: string): Promise<MojangUuidResponse | null> {
    const cached = await getCachedUuid(name);
    if (cached) {
        log(`[MOJANG_API] UUID cache hit for ${name}`);
        return cached;
    }

    log(`[MOJANG_API] Fetching UUID for ${name}`);
    const data = await mojangFetch<MojangUuidResponse>(
        `${MOJANG_API_BASE}/users/profiles/minecraft/${encodeURIComponent(name)}`,
    );

    if (data) {
        await setCachedUuid(name, data);
    }

    return data;
}

// ── Profile Fetch ───────────────────────────────────

export async function getProfileByUuid(
    uuid: string,
    unsigned: boolean = false,
): Promise<MojangProfile | null> {
    const cleanUuid = uuid.replace(/-/g, "");

    const cached = await getCachedProfile(cleanUuid);
    if (cached) {
        log(`[MOJANG_API] Profile cache hit for ${cleanUuid}`);
        return cached;
    }

    const unsignedParam = unsigned ? "?unsigned=true" : "?unsigned=false";
    log(`[MOJANG_API] Fetching profile for ${cleanUuid}`);

    const data = await mojangFetch<MojangProfile>(
        `${MOJANG_SESSION_BASE}/session/minecraft/profile/${cleanUuid}${unsignedParam}`,
    );

    if (data) {
        await setCachedProfile(cleanUuid, data);
    }

    return data;
}

// ── Export for Yggdrasil fallback ───────────────────

export async function getProfileFromMojang(
    uuid: string,
    unsigned: boolean = false,
): Promise<MojangProfile | null> {
    return getProfileByUuid(uuid, unsigned);
}

export async function getUuidFromMojang(
    name: string,
): Promise<MojangUuidResponse | null> {
    return getUuidByName(name);
}
