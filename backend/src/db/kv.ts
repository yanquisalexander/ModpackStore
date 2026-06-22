/**
 * Deno KV instance - global key-value store with built-in replication.
 * Used for session caching, rate limiting, and other low-latency data.
 */
export const kv = await Deno.openKv();
