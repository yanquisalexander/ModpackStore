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
}

export const getModpackVersions = async (modpackId: string): Promise<ModpackVersionPublic[]> => {
    try {
        // For now, let's try to use the explore endpoint to get version information
        // If this doesn't work, we might need to create a new endpoint
        const response = await fetch(`${API_ENDPOINT}/explore/modpack/${modpackId}/versions`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        })

        if (!response.ok) {
            // Fallback: return mock data for development
            // This will need to be replaced with actual API integration
            console.warn(`Failed to fetch versions for modpack ${modpackId}, using mock data`)
            return getMockModpackVersions(modpackId)
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
        return getMockModpackVersions(modpackId)
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

// Mock data for development - this should be removed once the API is properly integrated
const getMockModpackVersions = (modpackId: string): ModpackVersionPublic[] => {
    return [
        {
            id: "version-1",
            version: "1.2.0",
            mcVersion: "1.20.1",
            forgeVersion: "47.2.0",
            changelog: "## Cambios importantes\n\n- Añadidos nuevos mods de tecnología\n- Optimizado el rendimiento general\n- Corregidos bugs críticos\n\n## Arreglos\n\n- Solucionado crash al abrir ciertos GUIs\n- Mejorada la compatibilidad entre mods\n- Corregidos problemas de renderizado",
            status: "published" as const,
            releaseDate: "2024-01-15T10:00:00Z",
            createdAt: "2024-01-10T10:00:00Z",
            updatedAt: "2024-01-15T10:00:00Z",
        },
        {
            id: "version-2",
            version: "1.1.5",
            mcVersion: "1.20.1", 
            forgeVersion: "47.1.0",
            changelog: "## Actualizaciones menores\n\n- Actualizado Create mod\n- Añadidos nuevos bloques decorativos\n- Mejorada la experiencia de juego\n\n## Arreglos\n\n- Corregido duplication glitch\n- Solucionados problemas de lag\n- Mejorada estabilidad general",
            status: "published" as const,
            releaseDate: "2024-01-01T10:00:00Z",
            createdAt: "2023-12-28T10:00:00Z",
            updatedAt: "2024-01-01T10:00:00Z",
        },
        {
            id: "version-3", 
            version: "1.1.0",
            mcVersion: "1.20.1",
            forgeVersion: "47.0.0",
            changelog: "## Primera versión estable\n\n- Conjunto inicial de mods\n- Configuración básica optimizada\n- Balance inicial de progresión\n\n## Características\n\n- +150 mods incluidos\n- Configuración custom para mejor experiencia\n- Questbook integrado",
            status: "published" as const,
            releaseDate: "2023-12-01T10:00:00Z",
            createdAt: "2023-11-25T10:00:00Z", 
            updatedAt: "2023-12-01T10:00:00Z",
        }
    ]
}