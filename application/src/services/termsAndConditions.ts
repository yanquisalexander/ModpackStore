import { API_ENDPOINT } from "../consts";

export interface ToSSettings {
    content: string;
    enabled: boolean;
}

export interface ToSSettingsUpdate {
    content?: string;
    enabled?: boolean;
}

/**
 * Helper function to handle API responses.
 * @param response - The fetch response object.
 * @returns The JSON response.
 * @throws Error if the response is not ok.
 */
async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`API request failed with status ${response.status}: ${errorData.message || 'Unknown error'}`);
    }
    return response.json() as Promise<T>;
}

// Public API - no auth required
export async function getPublicToSSettings(): Promise<ToSSettings> {
    const response = await fetch(`${API_ENDPOINT}/public/tos`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });
    const json = await handleResponse<{ data: ToSSettings }>(response);
    return json.data;
}

// Auth API - requires authentication
export async function acceptTermsAndConditions(token: string): Promise<{ tosAcceptedAt: string }> {
    const response = await fetch(`${API_ENDPOINT}/auth/accept-tos`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    const json = await handleResponse<{ data: { tosAcceptedAt: string } }>(response);
    return json.data;
}

// Admin API - requires admin authentication
export async function getAdminToSSettings(token: string): Promise<ToSSettings> {
    const response = await fetch(`${API_ENDPOINT}/admin/settings/tos`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    const json = await handleResponse<{ data: ToSSettings }>(response);
    return json.data;
}

export async function updateToSSettings(settingsData: ToSSettingsUpdate, token: string): Promise<ToSSettings> {
    const response = await fetch(`${API_ENDPOINT}/admin/settings/tos`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(settingsData),
    });
    const json = await handleResponse<{ data: ToSSettings }>(response);
    return json.data;
}

export async function revokeAllToSAcceptances(token: string): Promise<{ usersUpdated: number }> {
    const response = await fetch(`${API_ENDPOINT}/admin/settings/tos/revoke-all`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    const json = await handleResponse<{ data: { usersUpdated: number } }>(response);
    return json.data;
}

// Terms and Conditions API service object for convenience
export const ToSService = {
    getPublicSettings: getPublicToSSettings,
    acceptTerms: acceptTermsAndConditions,
    getAdminSettings: getAdminToSSettings,
    updateSettings: updateToSSettings,
    revokeAllAcceptances: revokeAllToSAcceptances,
};