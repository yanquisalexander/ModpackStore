import { API_ENDPOINT } from "@/consts"
import { Modpack } from "@/types/modpacks";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

export const getModpacks = async (): Promise<{ categories: any[], featured: any[] }> => {
    const response = await fetchWithAuth(`${API_ENDPOINT}/explore`, {
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

export const searchModpacks = async (query: string): Promise<Modpack[]> => {
    const url = new URL(`${API_ENDPOINT}/explore/search`)
    url.searchParams.append("q", query)


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

export const getModpackById = async (modpackId: string): Promise<Modpack> => {
    const response = await fetchWithAuth(`${API_ENDPOINT}/explore/modpacks/${modpackId}`, {
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