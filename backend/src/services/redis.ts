import { Redis } from "ioredis"
const redisUrl = Deno.env.get("REDIS_URL") || "redis://localhost:6379";
export const redisConnection = new Redis(redisUrl, { maxRetriesPerRequest: null, });