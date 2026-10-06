import { API_ENDPOINT } from "@/consts"
import { Modpack } from "@/types/modpacks";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

export type ExploreProvider = "store" | "modrinth" | "all";

const providerParam = (provider?: ExploreProvider) =>
    provider === "store" ? "" : `?provider=${provider}`;

export const getModpacks = async (
    provider: ExploreProvider = "store"
): Promise<{ categories: any[], featured: any[] }> => {
    const suffix = providerParam(provider);
    const response = await fetchWithAuth(`${API_ENDPOINT}/explore${suffix}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    })

    if (!response.ok) {
        throw new Error(`Explore API error: ${response.status}`);
    }

    const json = await response.json()
    return {
        categories: json.data?.categories || [],
        featured: json.data?.featured || []
    }
}

export const searchModpacks = async (
    query: string,
    provider: ExploreProvider = "store"
): Promise<Modpack[]> => {
    const url = new URL(`${API_ENDPOINT}/explore/search`)
    url.searchParams.append("q", query)
    if (provider === "modrinth" || provider === "all") url.searchParams.append("provider", provider)


    const response = await fetchWithAuth(url.toString(), {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    })

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }

    const json = await response.json()
    return json.data.map((item: any) => item.attributes)
}

export const getModpackById = async (
    modpackId: string,
    provider: ExploreProvider = "store"
): Promise<Modpack> => {
    const suffix = providerParam(provider);
    const response = await fetchWithAuth(`${API_ENDPOINT}/explore/modpacks/${modpackId}${suffix}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    })

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }

    const json = await response.json()
    return json.data
}