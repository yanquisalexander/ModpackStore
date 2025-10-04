export const API_ENDPOINT =
    import.meta.env.DEV || import.meta.env.MODE === "development"
        ? "http://localhost:3000/v1"
        : import.meta.env.VITE_API_ENDPOINT ||
        "https://api-modpackstore.saltouruguayserver.com/v1";

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