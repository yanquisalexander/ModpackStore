import { API_ENDPOINT } from "@/consts";

export interface CreatorProfileData {
    id: string;
    displayName: string;
    slug: string;
    description: string;
    logoUrl: string;
    bannerUrl: string;
    discordUrl: string | null;
    verified: boolean;
    partner: boolean;
    nameLastChangedAt?: string;
    nextNameChangeAvailable?: string;
    memberCount?: number;
    modpackCount?: number;
    modpacks?: any[];
}

export interface UpdateCreatorProfileData {
    displayName?: string;
    description?: string | null;
    logoUrl?: string | null;
    bannerUrl?: string | null;
    discordUrl?: string | null;
}

export const creatorSettingsService = {
    getProfile: async (creatorId: string, token: string): Promise<CreatorProfileData> => {
        const response = await fetch(`${API_ENDPOINT}/creators/${creatorId}/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch creator profile');
        }

        const json = await response.json();
        return json.data;
    },

    getPublicProfile: async (slug: string): Promise<CreatorProfileData> => {
        const response = await fetch(`${API_ENDPOINT}/creators/slug/${slug}`);

        if (!response.ok) {
            throw new Error('Failed to fetch creator profile');
        }

        const json = await response.json();
        return json.data;
    },

    updateProfile: async (creatorId: string, data: UpdateCreatorProfileData, token: string): Promise<CreatorProfileData> => {
        const response = await fetch(`${API_ENDPOINT}/creators/${creatorId}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.errors?.[0]?.detail || error.message || 'Failed to update profile');
        }

        const json = await response.json();
        return json.data;
    }
};
