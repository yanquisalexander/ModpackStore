import { API_ENDPOINT } from '@/consts';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import {
    WhitelistUser,
    WhitelistStats,
    AddToWhitelistData,
    BulkAddToWhitelistData,
    WhitelistExportData,
    WhitelistAccessCheck,
    UserWhitelistInfo,
    WhitelistedModpack
} from '@/types/whitelist';

class WhitelistService {
    private get baseUrl() { return `${API_ENDPOINT}/creators/whitelist`; }
    private get accessUrl() { return `${API_ENDPOINT}/whitelist-access`; }

    /**
     * Get all whitelisted users for a modpack
     */
    async getWhitelistedUsers(modpackId: string, accessToken: string): Promise<WhitelistUser[]> {
        try {
            const response = await fetchWithAuth(`${this.baseUrl}/${modpackId}`, {
                token: accessToken,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch whitelisted users: ${response.statusText}`);
            }

            const { data } = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching whitelisted users:', error);
            throw error;
        }
    }

    /**
     * Get whitelist statistics for a modpack
     */
    async getWhitelistStats(modpackId: string, accessToken: string): Promise<WhitelistStats> {
        try {
            const response = await fetchWithAuth(`${this.baseUrl}/${modpackId}/stats`, {
                token: accessToken,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch whitelist stats: ${response.statusText}`);
            }

            const { data } = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching whitelist stats:', error);
            throw error;
        }
    }

    /**
     * Add a user to the whitelist
     */
    async addToWhitelist(modpackId: string, data: AddToWhitelistData, accessToken: string): Promise<void> {
        try {
            const response = await fetchWithAuth(`${this.baseUrl}/${modpackId}`, {
                method: 'POST',
                token: accessToken,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to add user to whitelist: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error adding user to whitelist:', error);
            throw error;
        }
    }

    /**
     * Bulk add users to the whitelist
     */
    async bulkAddToWhitelist(modpackId: string, data: BulkAddToWhitelistData, accessToken: string): Promise<{ added: number; failed: number }> {
        try {
            const response = await fetchWithAuth(`${this.baseUrl}/${modpackId}/bulk`, {
                method: 'POST',
                token: accessToken,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to bulk add users: ${response.statusText}`);
            }

            const { data: result } = await response.json();
            return result;
        } catch (error) {
            console.error('Error bulk adding users:', error);
            throw error;
        }
    }

    /**
     * Remove a user from the whitelist
     */
    async removeFromWhitelist(modpackId: string, userId: string, accessToken: string): Promise<void> {
        try {
            const response = await fetchWithAuth(`${this.baseUrl}/${modpackId}/user/${userId}`, {
                method: 'DELETE',
                token: accessToken,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to remove user from whitelist: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error removing user from whitelist:', error);
            throw error;
        }
    }

    /**
     * Clear entire whitelist for a modpack
     */
    async clearWhitelist(modpackId: string, accessToken: string): Promise<number> {
        try {
            const response = await fetchWithAuth(`${this.baseUrl}/${modpackId}/clear`, {
                method: 'DELETE',
                token: accessToken,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to clear whitelist: ${response.statusText}`);
            }

            const { data } = await response.json();
            return data.removedCount;
        } catch (error) {
            console.error('Error clearing whitelist:', error);
            throw error;
        }
    }

    /**
     * Export whitelist data
     */
    async exportWhitelist(modpackId: string, accessToken: string): Promise<WhitelistExportData> {
        try {
            const response = await fetchWithAuth(`${this.baseUrl}/${modpackId}/export`, {
                token: accessToken,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to export whitelist: ${response.statusText}`);
            }

            const { data } = await response.json();
            return data;
        } catch (error) {
            console.error('Error exporting whitelist:', error);
            throw error;
        }
    }

    // ===== Whitelist Access Methods (for client/launcher) =====

    /**
     * Check if the authenticated user has access to a specific modpack
     */
    async checkModpackAccess(modpackId: string, accessToken: string): Promise<WhitelistAccessCheck> {
        try {
            const response = await fetchWithAuth(`${this.accessUrl}/modpack/${modpackId}`, {
                token: accessToken,
            });

            if (!response.ok) {
                throw new Error(`Failed to check modpack access: ${response.statusText}`);
            }

            const { data } = await response.json();
            return data;
        } catch (error) {
            console.error('Error checking modpack access:', error);
            throw error;
        }
    }

    /**
     * Get all modpacks the authenticated user has whitelist access to
     */
    async getMyWhitelistedModpacks(accessToken: string): Promise<WhitelistedModpack[]> {
        try {
            const response = await fetchWithAuth(`${this.accessUrl}/my-whitelists`, {
                token: accessToken,
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch whitelisted modpacks: ${response.statusText}`);
            }

            const { data } = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching whitelisted modpacks:', error);
            throw error;
        }
    }

    /**
     * Check if the authenticated user is in any whitelists
     */
    async hasAnyWhitelists(accessToken: string): Promise<UserWhitelistInfo> {
        try {
            const response = await fetchWithAuth(`${this.accessUrl}/has-any`, {
                token: accessToken,
            });

            if (!response.ok) {
                throw new Error(`Failed to check user whitelists: ${response.statusText}`);
            }

            const { data } = await response.json();
            return data;
        } catch (error) {
            console.error('Error checking user whitelists:', error);
            throw error;
        }
    }
}

export const whitelistService = new WhitelistService();
