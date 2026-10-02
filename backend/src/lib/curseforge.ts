import { createHash } from "node:crypto";
import type { CurseForgeProjectInfo, CurseForgeFileInfo } from "@/types/curseforge.ts";
import { log } from "@/lib/logger.ts";

const BASE_URL = "https://api.curseforge.com/v1";
const API_TIMEOUT = 30_000;
const DOWNLOAD_TIMEOUT = 120_000;

function getApiKey(): string {
    const key = Deno.env.get("CURSEFORGE_API_KEY");
    if (!key) throw new Error("CURSEFORGE_API_KEY environment variable is not set");
    return key;
}

async function apiFetch<T>(path: string, timeout = API_TIMEOUT): Promise<T | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(`${BASE_URL}${path}`, {
            headers: {
                Accept: "application/json",
                "x-api-key": getApiKey(),
            },
            signal: controller.signal,
        });

        if (!response.ok) {
            log(`  [CURSEFORGE_API] ${response.status} for ${path}`);
            return null;
        }

        const json = await response.json();
        return json.data as T;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("abort")) {
            log(`  [CURSEFORGE_API] Timeout for ${path}`);
        } else {
            log(`  [CURSEFORGE_API] Error for ${path}: ${msg}`);
        }
        return null;
    } finally {
        clearTimeout(timer);
    }
}

export async function getProject(projectId: number): Promise<CurseForgeProjectInfo | null> {
    return apiFetch<CurseForgeProjectInfo>(`/mods/${projectId}`);
}

export async function getFile(projectId: number, fileId: number): Promise<CurseForgeFileInfo | null> {
    return apiFetch<CurseForgeFileInfo>(`/mods/${projectId}/files/${fileId}`);
}

export interface ResolvedModDownload {
    fileInfo: CurseForgeFileInfo;
    downloadUrl: string;
}

/**
 * Resuelve info + URL de descarga con UNA sola llamada API en el caso común.
 * `getFile` ya incluye `downloadUrl`; solo se llama al endpoint
 * `/download-url` como fallback si viene vacío. (Antes se hacían 2-3
 * llamadas por mod: getFile + getDownloadUrl + posible getFile interno.)
 */
export async function getFileAndDownloadUrl(
    projectId: number,
    fileId: number,
): Promise<ResolvedModDownload | null> {
    const fileInfo = await getFile(projectId, fileId);
    if (!fileInfo) return null;
    if (fileInfo.downloadUrl) return { fileInfo, downloadUrl: fileInfo.downloadUrl };

    const url = await apiFetch<string>(`/mods/${projectId}/files/${fileId}/download-url`);
    if (!url) {
        log(`  [SKIP] No download URL for ${fileInfo.fileName}`);
        return null;
    }
    return { fileInfo, downloadUrl: url };
}

export async function getDownloadUrl(projectId: number, fileId: number): Promise<string | null> {
    // Orden invertido respecto a la versión anterior: primero getFile
    // (1 llamada que ya trae downloadUrl), fallback al endpoint dedicado.
    const fileInfo = await getFile(projectId, fileId);
    if (fileInfo?.downloadUrl) return fileInfo.downloadUrl;
    if (!fileInfo) return null;

    return apiFetch<string>(`/mods/${projectId}/files/${fileId}/download-url`);
}

export type DownloadResult = { ok: true; sha1: string; size: number } | { ok: false };

/**
 * Descarga un archivo a disco haciendo hash SHA1 incremental MIENTRAS se
 * escribe (un solo pase de I/O). Evita el patrón anterior de descargar y
 * después re-leer el archivo entero solo para hashearlo.
 */
export async function downloadFileWithHash(url: string, destPath: string): Promise<DownloadResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

    try {
        const response = await fetch(url, {
            headers: { "User-Agent": "ModpackStore/2.0" },
            signal: controller.signal,
        });

        if (!response.ok || !response.body) {
            log(`  [CURSEFORGE_DL] ${response.status} for ${url}`);
            return { ok: false };
        }

        const hash = createHash("sha1");
        const file = await Deno.open(destPath, { write: true, create: true, truncate: true });
        let size = 0;
        try {
            const reader = response.body.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    hash.update(value);
                    size += value.byteLength;
                    let offset = 0;
                    while (offset < value.byteLength) {
                        const n = await file.write(value.subarray(offset));
                        offset += n;
                    }
                }
            } finally {
                reader.releaseLock();
            }
        } finally {
            try { file.close(); } catch { /* ignore */ }
        }

        return { ok: true, sha1: hash.digest("hex"), size };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`  [CURSEFORGE_DL] Failed: ${msg}`);
        return { ok: false };
    } finally {
        clearTimeout(timer);
    }
}

export async function downloadFileToPath(url: string, destPath: string): Promise<boolean> {
    const res = await downloadFileWithHash(url, destPath);
    return res.ok;
}
