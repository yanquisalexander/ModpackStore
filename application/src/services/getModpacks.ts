import { API_ENDPOINT } from "@/consts"
import { Modpack } from "@/types/modpacks";

export const getModpacks = async (): Promise<Modpack[]> => {
    const response = await fetch(`${API_ENDPOINT}/explore`, {
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

export const searchModpacks = async (query: string): Promise<Modpack[]> => {
    const url = new URL(`${API_ENDPOINT}/explore/search`)
    url.searchParams.append("q", query)

    const response = await fetch(url.toString(), {
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
    const response = await fetch(`${API_ENDPOINT}/explore/modpack/${modpackId}`, {
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
    return json.data.attributes
}