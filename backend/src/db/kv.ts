/**
 * Deno KV instance - global key-value store with built-in replication.
 * Used for session caching, rate limiting, and other low-latency data.
 * Lazy singleton: only opened on first use to reduce cold start time.
 */
let kvInstance: Deno.Kv | null = null;

export async function getKv(): Promise<Deno.Kv> {
    if (!kvInstance) {
        kvInstance = await Deno.openKv();
    }
    return kvInstance;
}
