export let API_ENDPOINT =
    import.meta.env.DEV || import.meta.env.MODE === "development"
        ? "http://localhost:3000/v1"
        : import.meta.env.VITE_API_ENDPOINT ||
        "https://modpackstore-api.alexitoo.deno.net/v1";

export async function initApiEndpoint(): Promise<void> {
    try {
        const { invoke } = await import("@tauri-apps/api/core");
        const endpoint = await invoke<string | null>("get_api_endpoint");
        if (endpoint) {
            API_ENDPOINT = endpoint;
        }
    } catch (e) {
        console.warn("[api-endpoint] Failed to load system override:", e);
    }
}

/**
 * Alternative Minecraft launcher meta servers
 * These servers mirror the official Mojang launcher meta API
 * The list is tried in order until one succeeds
 */
export const MINECRAFT_MANIFEST_SERVERS = [
    "https://launchermeta.mojang.com/mc/game/version_manifest.json",      // Official Mojang
    "https://bmclapi2.bangbang93.com/mc/game/version_manifest.json",      // BMCLAPI (China mirror)
    "https://download.mcbbs.net/mc/game/version_manifest.json",            // MCBBS (China mirror)
] as const;

export const MICROSOFT_CLIENT_ID = "b999888a-cd19-4e13-8ca4-f276a9ba2a68";
