import { getKv } from "@/db/kv.ts";

/**
 * KV anti-fraud dedup para impresiones/clicks de ads.
 * Reemplaza Map+setInterval: es correcto entre isolates y expira automáticamente,
 * sin tareas de limpieza. Redis Free Tier está reservado solo para BullMQ.
 */
const PREFIX = "ad_dedup";

/**
 * Devuelve true si ya se registró una acción en la ventana de TTL.
 * Solo si NO existe se escribe el marcador (1 sola escritura a KV).
 */
export async function isDuplicate(key: string, ttlMs: number): Promise<boolean> {
    const kv = await getKv();
    const cached = await kv.get<number>([PREFIX, key]);
    if (cached.value !== null) {
        return true; // ya registrado en ventana
    }
    await kv.set([PREFIX, key], Date.now(), { expireIn: ttlMs });
    return false; // nuevo, cuenta la acción
}
