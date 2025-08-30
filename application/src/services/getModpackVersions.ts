import { API_ENDPOINT } from "@/consts"
import { ModpackVersion } from "@/types/modpacks"

export interface ModpackVersionPublic {
    id: string
    version: string
    mcVersion: string
    forgeVersion?: string | null
    changelog: string
    status: 'draft' | 'published' | 'archived'
    releaseDate?: string | null
    createdAt: string
    updatedAt: string
    files: {
        path: string
        file: {
            type: string
        }
    }[]
}

export const getModpackVersions = async (modpackId: string): Promise<ModpackVersionPublic[]> => {
    try {
        // For now, let's try to use the explore endpoint to get version information
        // If this doesn't work, we might need to create a new endpoint
        const response = await fetch(`${API_ENDPOINT}/explore/modpacks/${modpackId}/versions`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        })

        if (!response.ok) {
            console.warn(`Failed to fetch versions for modpack ${modpackId}, using mock data`)
        }

        const json = await response.json()
        // Assuming the API returns versions in JSON:API format
        if (json.data && Array.isArray(json.data)) {
            return json.data.map((item: any) => item.attributes || item)
        }

        return json.versions || json.data || []
    } catch (error) {
        console.error("Error fetching modpack versions:", error)
        // Return mock data for development
        return []
    }
}

// Helper function to get the latest published version
export const getLatestVersion = (versions: ModpackVersionPublic[]): ModpackVersionPublic | null => {
    const publishedVersions = versions.filter(v => v.status === 'published')
    if (publishedVersions.length === 0) return null

    // Sort by release date (most recent first)
    const sorted = publishedVersions.sort((a, b) => {
        const dateA = new Date(a.releaseDate || a.createdAt)
        const dateB = new Date(b.releaseDate || b.createdAt)
        return dateB.getTime() - dateA.getTime()
    })

    return sorted[0]
}

// Helper function to filter non-archived versions
export const getNonArchivedVersions = (versions: ModpackVersionPublic[]): ModpackVersionPublic[] => {
    return versions.filter(v => v.status !== 'archived')
}

