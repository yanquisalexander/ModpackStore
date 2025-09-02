import axios, { AxiosInstance } from 'axios';
import { CurseForgeProjectInfo, CurseForgeFileInfo } from '@/types/curseforge';

export class CurseForgeAPIClient {
    private client: AxiosInstance;
    private apiKey: string;

    constructor(apiKey?: string) {
        this.apiKey = apiKey || process.env.CURSEFORGE_API_KEY || '';
        this.client = axios.create({
            baseURL: 'https://api.curseforge.com/v1',
            headers: {
                'Accept': 'application/json',
                'x-api-key': this.apiKey
            },
            timeout: 30000
        });
    }

    /**
     * Get project information by project ID
     */
    async getProject(projectId: number): Promise<CurseForgeProjectInfo | null> {
        try {
            const response = await this.client.get(`/mods/${projectId}`);
            return response.data.data;
        } catch (error) {
            console.error(`Failed to get project ${projectId}:`, error);
            return null;
        }
    }

    /**
     * Get file information by project ID and file ID
     */
    async getFile(projectId: number, fileId: number): Promise<CurseForgeFileInfo | null> {
        try {
            const response = await this.client.get(`/mods/${projectId}/files/${fileId}`);
            return response.data.data;
        } catch (error) {
            console.error(`Failed to get file ${fileId} from project ${projectId}:`, error);
            return null;
        }
    }

    /**
     * Download a file from CurseForge
     */
    async downloadFile(downloadUrl: string): Promise<Buffer | null> {
        try {
            const response = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                timeout: 120000, // 2 minutes for large mod files
                headers: {
                    'User-Agent': 'ModpackStore/1.0'
                }
            });
            return Buffer.from(response.data);
        } catch (error) {
            console.error(`Failed to download file from ${downloadUrl}:`, error);
            return null;
        }
    }

    /**
     * Get download URL for a file - CurseForge API doesn't always provide direct URLs
     * This method handles the redirect chain
     */
    async getDownloadUrl(projectId: number, fileId: number): Promise<string | null> {
        try {
            const response = await this.client.get(`/mods/${projectId}/files/${fileId}/download-url`);
            return response.data.data;
        } catch (error) {
            // Fallback to file info if direct download URL is not available
            const fileInfo = await this.getFile(projectId, fileId);
            return fileInfo?.downloadUrl || null;
        }
    }

    /**
     * Batch get files information for multiple mods
     */
    async batchGetFiles(requests: Array<{ projectId: number; fileId: number }>): Promise<Array<{
        projectId: number;
        fileId: number;
        projectInfo: CurseForgeProjectInfo | null;
        fileInfo: CurseForgeFileInfo | null;
    }>> {
        const results = await Promise.allSettled(
            requests.map(async ({ projectId, fileId }) => {
                const [projectInfo, fileInfo] = await Promise.all([
                    this.getProject(projectId),
                    this.getFile(projectId, fileId)
                ]);
                return { projectId, fileId, projectInfo, fileInfo };
            })
        );

        return results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                console.error(`Failed to get info for mod ${requests[index].projectId}/${requests[index].fileId}:`, result.reason);
                return {
                    projectId: requests[index].projectId,
                    fileId: requests[index].fileId,
                    projectInfo: null,
                    fileInfo: null
                };
            }
        });
    }
}