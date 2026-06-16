/**
 * Utility for fetching Minecraft manifest with automatic failover to alternative servers
 */

import { MINECRAFT_MANIFEST_SERVERS } from "../consts";
import { withCache } from "./versionCache";

const MANIFEST_CACHE_TTL = 5 * 60 * 1000;

export interface FetchWithFailoverOptions {
    /**
     * Timeout for each server request in milliseconds
     * @default 10000 (10 seconds)
     */
    timeout?: number;
    
    /**
     * Maximum number of retries per server
     * @default 1
     */
    maxRetriesPerServer?: number;
}

/**
 * Fetches the Minecraft version manifest with automatic failover to alternative servers
 * Tries each server in sequence until one succeeds
 * 
 * @param options - Configuration options for the fetch operation
 * @returns Promise resolving to the manifest JSON data
 * @throws Error if all servers fail
 */
async function fetchMinecraftManifestImpl(
    options: FetchWithFailoverOptions = {}
): Promise<any> {
    const {
        timeout = 10000,
        maxRetriesPerServer = 1,
    } = options;

    let lastError: Error | null = null;

    for (const serverUrl of MINECRAFT_MANIFEST_SERVERS) {
        console.info(`[fetchMinecraftManifestWithFailover] Trying server: ${serverUrl}`);

        for (let attempt = 0; attempt <= maxRetriesPerServer; attempt++) {
            if (attempt > 0) {
                console.warn(
                    `[fetchMinecraftManifestWithFailover] Retry attempt ${attempt} for server: ${serverUrl}`
                );
            }

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(serverUrl, {
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                console.info(
                    `[fetchMinecraftManifestWithFailover] Successfully fetched manifest from: ${serverUrl}`
                );
                return data;
            } catch (error) {
                lastError = error as Error;
                console.warn(
                    `[fetchMinecraftManifestWithFailover] Server ${serverUrl} failed: ${lastError.message}`
                );

                // Don't retry immediately, wait a bit before next attempt
                if (attempt < maxRetriesPerServer) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }
    }

    throw new Error(
        `All manifest servers failed. Last error: ${lastError?.message || 'Unknown error'}`
    );
}

export async function fetchMinecraftManifestWithFailover(
    options: FetchWithFailoverOptions = {}
): Promise<any> {
    return withCache('minecraft_manifest', () => fetchMinecraftManifestImpl(options), MANIFEST_CACHE_TTL);
}

/**
 * Converts a Mojang URL to alternative mirror URLs
 * 
 * @param mojangUrl - The original Mojang URL
 * @returns Array of alternative URLs to try
 */
function convertToAlternativeUrls(mojangUrl: string): string[] {
    const urls = [mojangUrl]; // Start with original URL

    // If it's a Mojang URL, create alternative mirror URLs
    if (mojangUrl.startsWith("https://launchermeta.mojang.com/")) {
        const path = mojangUrl.replace("https://launchermeta.mojang.com/", "");

        // Add BMCLAPI mirror
        urls.push(`https://bmclapi2.bangbang93.com/${path}`);

        // Add MCBBS mirror
        urls.push(`https://download.mcbbs.net/${path}`);
    }

    return urls;
}

/**
 * Fetches a specific Minecraft version JSON with failover to alternative servers
 * 
 * @param versionUrl - The URL to the version JSON from the manifest
 * @param options - Configuration options for the fetch operation
 * @returns Promise resolving to the version JSON data
 * @throws Error if all servers fail
 */
export async function fetchVersionJsonWithFailover(
    versionUrl: string,
    options: FetchWithFailoverOptions = {}
): Promise<any> {
    const {
        timeout = 10000,
    } = options;

    const alternativeUrls = convertToAlternativeUrls(versionUrl);
    let lastError: Error | null = null;

    for (const url of alternativeUrls) {
        console.info(`[fetchVersionJsonWithFailover] Trying URL: ${url}`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, {
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.info(
                `[fetchVersionJsonWithFailover] Successfully fetched version JSON from: ${url}`
            );
            return data;
        } catch (error) {
            lastError = error as Error;
            console.warn(
                `[fetchVersionJsonWithFailover] URL ${url} failed: ${lastError.message}`
            );
        }
    }

    throw new Error(
        `Failed to fetch version JSON from all mirrors. Last error: ${lastError?.message || 'Unknown error'}`
    );
}
