/**
 * Utility functions for fetching modloader versions from various APIs
 */

export const FORGE_VERSIONS_URL = "https://mc-versions-api.net/api/forge";
export const FABRIC_LOADER_URL = "https://meta.fabricmc.net/v2/versions/loader";
export const QUILT_LOADER_URL = "https://meta.quiltmc.org/v3/versions/loader";
export const NEOFORGE_URL = "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge";

export type ModLoaderType = 'vanilla' | 'forge' | 'fabric' | 'neoforge' | 'quilt';

/**
 * Fetch Forge versions for all Minecraft versions
 * Returns a map of MC version -> Forge versions
 */
export async function fetchForgeVersions(): Promise<Record<string, string[]>> {
    try {
        const response = await fetch(FORGE_VERSIONS_URL);
        const data = await response.json();

        const rawData = data.result?.[0] || {};
        const processedData: Record<string, string[]> = {};

        // Filter versions before 1.5.2
        for (const mcVersion in rawData) {
            if (Object.prototype.hasOwnProperty.call(rawData, mcVersion)) {
                processedData[mcVersion] = rawData[mcVersion].filter((version: string) => {
                    const versionParts = version.split('.');
                    return versionParts.length > 1 && 
                        (parseInt(versionParts[0]) > 1 || 
                         (parseInt(versionParts[0]) === 1 && parseInt(versionParts[1]) >= 5));
                });
            }
        }

        return processedData;
    } catch (error) {
        console.error("Error fetching Forge versions:", error);
        throw new Error("No se pudieron cargar las versiones de Forge");
    }
}

/**
 * Fetch Fabric loader versions for a specific Minecraft version
 */
export async function fetchFabricVersions(mcVersion: string): Promise<string[]> {
    try {
        const response = await fetch(`${FABRIC_LOADER_URL}/${mcVersion}`);
        const data = await response.json();
        
        return data.map((item: any) => item.loader.version);
    } catch (error) {
        console.error("Error fetching Fabric versions:", error);
        throw new Error("No se pudieron cargar las versiones de Fabric");
    }
}

/**
 * Fetch Quilt loader versions for a specific Minecraft version
 */
export async function fetchQuiltVersions(mcVersion: string): Promise<string[]> {
    try {
        const response = await fetch(`${QUILT_LOADER_URL}/${mcVersion}`);
        const data = await response.json();
        
        return data.map((item: any) => item.loader.version);
    } catch (error) {
        console.error("Error fetching Quilt versions:", error);
        throw new Error("No se pudieron cargar las versiones de Quilt");
    }
}

/**
 * Fetch NeoForge versions
 * Note: NeoForge versions are global and need to be filtered by MC version compatibility
 */
export async function fetchNeoForgeVersions(): Promise<string[]> {
    try {
        const response = await fetch(NEOFORGE_URL);
        const data = await response.json();
        
        return data.versions || [];
    } catch (error) {
        console.error("Error fetching NeoForge versions:", error);
        throw new Error("No se pudieron cargar las versiones de NeoForge");
    }
}

/**
 * Fetch loader versions for any loader type
 */
export async function fetchLoaderVersions(
    loaderType: ModLoaderType,
    mcVersion: string
): Promise<string[]> {
    switch (loaderType) {
        case 'vanilla':
            return [];
        case 'forge': {
            const forgeMap = await fetchForgeVersions();
            return forgeMap[mcVersion] || [];
        }
        case 'fabric':
            return await fetchFabricVersions(mcVersion);
        case 'quilt':
            return await fetchQuiltVersions(mcVersion);
        case 'neoforge':
            return await fetchNeoForgeVersions();
        default:
            return [];
    }
}

/**
 * Get display name for a mod loader type
 */
export function getModLoaderDisplayName(loaderType: ModLoaderType): string {
    const names: Record<ModLoaderType, string> = {
        vanilla: 'Vanilla',
        forge: 'Forge',
        fabric: 'Fabric',
        neoforge: 'NeoForge',
        quilt: 'Quilt'
    };
    return names[loaderType] || loaderType;
}

/**
 * Get icon component name for a mod loader type
 */
export function getModLoaderIcon(loaderType: ModLoaderType): string {
    const icons: Record<ModLoaderType, string> = {
        vanilla: 'Package',
        forge: 'Anvil',
        fabric: 'Feather',
        neoforge: 'Hammer',
        quilt: 'TestTubeDiagonal'
    };
    return icons[loaderType] || 'Package';
}
