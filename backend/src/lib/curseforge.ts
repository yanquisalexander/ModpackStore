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

export async function getDownloadUrl(projectId: number, fileId: number): Promise<string | null> {
    const result = await apiFetch<string>(`/mods/${projectId}/files/${fileId}/download-url`);
    if (result) return result;

    // Fallback: get URL from file info
    const fileInfo = await getFile(projectId, fileId);
    return fileInfo?.downloadUrl ?? null;
}

export async function downloadFileToPath(url: string, destPath: string): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

    try {
        const response = await fetch(url, {
            headers: { "User-Agent": "ModpackStore/2.0" },
            signal: controller.signal,
        });

        if (!response.ok) {
            log(`  [CURSEFORGE_DL] ${response.status} for ${url}`);
            return false;
        }

        const file = await Deno.open(destPath, { write: true, create: true, truncate: true });
        try {
            if (response.body) {
                await response.body.pipeTo(file.writable);
            }
        } finally {
            try { file.close(); } catch { /* already closed by pipeTo */ }
        }

        return true;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`  [CURSEFORGE_DL] Failed: ${msg}`);
        return false;
    } finally {
        clearTimeout(timer);
    }
}
