import { API_ENDPOINT } from '@/consts';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import {
    WhitelistUser,
    WhitelistStats,
    AddToWhitelistData,
    BulkAddToWhitelistData,
    BulkWhitelistResult,
    WhitelistExportData,
    WhitelistAccessCheck,
    UserWhitelistInfo,
    WhitelistedModpack
} from '@/types/whitelist';

/** Backend shape: `{ errors: [{ status, code, title, detail }] }` (APIError.toPayload). */
function extractErrorDetail(errorData: any): string | undefined {
    if (errorData?.errors?.[0]?.detail) return errorData.errors[0].detail;
    if (errorData?.detail) return errorData.detail;
    if (typeof errorData?.error === "string") return errorData.error;
    return undefined;
}

function extractErrorCode(errorData: any): string | undefined {
    if (errorData?.errors?.[0]?.code) return errorData.errors[0].code;
    if (typeof errorData?.code === "string") return errorData.code;
    return undefined;
}

export interface WhitelistServiceError extends Error {
    code?: string;
}

/**
 * Códigos `code` conocidos que devuelve el backend (APIError) en whitelist.
 * El alta (POST /:modpackId) puede devolver: ALREADY_WHITELISTED,
 * USER_NOT_FOUND, MODPACK_NOT_FOUND, NOT_WHITELIST_VISIBILITY, MISSING_USER.
 */
export type WhitelistErrorCode =
    | 'ALREADY_WHITELISTED'
    | 'USER_NOT_FOUND'
    | 'MODPACK_NOT_FOUND'
    | 'NOT_WHITELIST_VISIBILITY'
    | 'MISSING_USER'
    | 'MISSING_USERS'
    | 'TOO_MANY_USERS'
    | 'NOT_WHITELISTED';

/** Extrae el `code` tipado de un error del servicio (undefined si no lo tiene). */
export function getWhitelistErrorCode(error: unknown): WhitelistErrorCode | undefined {
    if (typeof error === 'object' && error !== null && 'code' in error) {
        const code = (error as { code: unknown }).code;
        switch (code) {
            case 'ALREADY_WHITELISTED':
            case 'USER_NOT_FOUND':
            case 'MODPACK_NOT_FOUND':
            case 'NOT_WHITELIST_VISIBILITY':
            case 'MISSING_USER':
            case 'MISSING_USERS':
            case 'TOO_MANY_USERS':
            case 'NOT_WHITELISTED':
                return code;
            default:
                return undefined;
        }
    }
    return undefined;
}

function toServiceError(errorData: any, fallback: string): WhitelistServiceError {
    const err = new Error(extractErrorDetail(errorData) ?? fallback) as WhitelistServiceError;
    const code = extractErrorCode(errorData);
    if (code) err.code = code;
    return err;
}

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
                throw toServiceError(errorData, `Failed to fetch whitelisted users: ${response.statusText}`);
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
                throw toServiceError(errorData, `Failed to fetch whitelist stats: ${response.statusText}`);
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
                throw toServiceError(errorData, `Failed to add user to whitelist: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error adding user to whitelist:', error);
            throw error;
        }
    }

    /**
     * Bulk add users to the whitelist (by userIds and/or usernames).
     * Nunca falla entero: devuelve resultado por ítem (`added`/`already`/`not_found`/`error`).
     */
    async bulkAddToWhitelist(modpackId: string, data: BulkAddToWhitelistData, accessToken: string): Promise<BulkWhitelistResult> {
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
                throw toServiceError(errorData, `Failed to bulk add users: ${response.statusText}`);
            }

            const { data: result } = await response.json();
            return result as BulkWhitelistResult;
        } catch (error) {
            console.error('Error bulk adding users:', error);
            throw error;
        }
    }

    /**
     * Bulk import por nombres (lista pegada). Atajo sobre `bulkAddToWhitelist`.
     */
    async bulkAddByUsernames(
        modpackId: string,
        data: { usernames: string[]; notes?: string },
        accessToken: string,
    ): Promise<BulkWhitelistResult> {
        return this.bulkAddToWhitelist(modpackId, data, accessToken);
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
                throw toServiceError(errorData, `Failed to remove user from whitelist: ${response.statusText}`);
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
                throw toServiceError(errorData, `Failed to clear whitelist: ${response.statusText}`);
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
                throw toServiceError(errorData, `Failed to export whitelist: ${response.statusText}`);
            }

            const { data } = await response.json();
            return data;
        } catch (error) {
            console.error('Error exporting whitelist:', error);
            throw error;
        }
    }

    /**
     * Get ingame (Yggdrasil) enforcement settings for a modpack
     */
    async getIngameSettings(modpackId: string, accessToken: string): Promise<{ enforceIngame: boolean; kickMessage: string }> {
        const response = await fetchWithAuth(`${this.baseUrl}/${modpackId}/ingame-settings`, {
            token: accessToken,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw toServiceError(errorData, `Failed to fetch ingame settings: ${response.statusText}`);
        }

        const { data } = await response.json();
        return data;
    }

    /**
     * Update ingame (Yggdrasil) enforcement settings for a modpack
     */
    async updateIngameSettings(modpackId: string, data: { enforceIngame?: boolean; kickMessage?: string }, accessToken: string): Promise<{ enforceIngame: boolean; kickMessage: string }> {
        const response = await fetchWithAuth(`${this.baseUrl}/${modpackId}/ingame-settings`, {
            method: 'PUT',
            token: accessToken,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw toServiceError(errorData, `Failed to update ingame settings: ${response.statusText}`);
        }

        const { data: result } = await response.json();
        return result;
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
