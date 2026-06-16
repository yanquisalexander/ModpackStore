/**
 * Utility functions for fetching modloader versions from various APIs
 */

import { withCache, clearVersionCache } from './versionCache';

export const FORGE_VERSIONS_URL =
  "https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml";
export const FABRIC_LOADER_URL = "https://meta.fabricmc.net/v2/versions/loader";
export const QUILT_LOADER_URL = "https://meta.quiltmc.org/v3/versions/loader";
export const NEOFORGE_URL = "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge";

export type ModLoaderType = 'vanilla' | 'forge' | 'fabric' | 'neoforge' | 'quilt';

const FORGE_TTL = 30 * 60 * 1000;

const MIN_FORGE_MC_VERSION = '1.12.2';

export { clearVersionCache };

function mcVersionToNumber(v: string): number {
  const parts = v.split('.').map(Number);
  return parts[0] * 10000 + (parts[1] ?? 0) * 100 + (parts[2] ?? 0);
}

const MIN_FORGE_MC_NUM = mcVersionToNumber(MIN_FORGE_MC_VERSION);

function parseForgeVersionsFromXml(xmlText: string): Record<string, string[]> {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  const versionElements = doc.querySelectorAll('version');
  const map = new Map<string, string[]>();

  versionElements.forEach((el) => {
    const fullVersion = el.textContent;
    if (!fullVersion) return;
    const dashIndex = fullVersion.indexOf('-');
    if (dashIndex === -1) return;
    const mcVersion = fullVersion.substring(0, dashIndex);
    const forgeBuild = fullVersion.substring(dashIndex + 1);

    if (mcVersionToNumber(mcVersion) < MIN_FORGE_MC_NUM) return;

    if (!map.has(mcVersion)) {
      map.set(mcVersion, []);
    }
    map.get(mcVersion)!.push(forgeBuild);
  });

  const compareNumericDesc = (a: string, b: string) => {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const va = aParts[i] ?? 0;
      const vb = bParts[i] ?? 0;
      if (va !== vb) return vb - va;
    }
    return 0;
  };

  const sortedMcVersions = Array.from(map.keys()).sort((a, b) => compareNumericDesc(a, b));
  const result: Record<string, string[]> = {};
  for (const mcVersion of sortedMcVersions) {
    result[mcVersion] = map.get(mcVersion)!.sort(compareNumericDesc);
  }
  return result;
}

export async function fetchForgeVersions(): Promise<Record<string, string[]>> {
  return withCache('forge', async () => {
    const response = await fetch(FORGE_VERSIONS_URL);
    const xmlText = await response.text();
    return parseForgeVersionsFromXml(xmlText);
  }, FORGE_TTL);
}

export async function fetchFabricVersions(mcVersion: string): Promise<string[]> {
  return withCache(`fabric:${mcVersion}`, async () => {
    const response = await fetch(`${FABRIC_LOADER_URL}/${mcVersion}`);
    const data = await response.json();
    return data.map((item: any) => item.loader.version);
  }, FORGE_TTL);
}

export async function fetchQuiltVersions(mcVersion: string): Promise<string[]> {
  return withCache(`quilt:${mcVersion}`, async () => {
    const response = await fetch(`${QUILT_LOADER_URL}/${mcVersion}`);
    const data = await response.json();
    return data.map((item: any) => item.loader.version);
  }, FORGE_TTL);
}

export async function fetchNeoForgeVersions(): Promise<string[]> {
  return withCache('neoforge', async () => {
    const response = await fetch(NEOFORGE_URL);
    const data = await response.json();
    return data.versions || [];
  }, FORGE_TTL);
}

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
