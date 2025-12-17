import { API_ENDPOINT } from "@/consts";

export interface PublisherProfileData {
    id: string;
    publisherName: string;
    description: string;
    logoUrl: string;
    bannerUrl: string;
    websiteUrl: string | null;
    discordUrl: string | null;
    twitterUrl: string | null;
    instagramUrl: string | null;
    youtubeUrl: string | null;
    tiktokUrl: string | null;
    // Cooldown/Status info
    nameLastChangedAt?: string;
    nextNameChangeAvailable?: string;
    // Public info
    isVerified?: boolean;
    isPartner?: boolean;
    modpackCount?: number;
    modpacks?: any[];
}

export interface UpdatePublisherProfileData {
    publisherName?: string;
    description?: string;
    logoUrl?: string;
    bannerUrl?: string;
    websiteUrl?: string | null;
    discordUrl?: string | null;
    twitterUrl?: string | null;
    instagramUrl?: string | null;
    youtubeUrl?: string | null;
    tiktokUrl?: string | null;
}

export const publisherSettingsService = {
    getProfile: async (publisherId: string, token: string): Promise<PublisherProfileData> => {
        const response = await fetch(`${API_ENDPOINT}/publishers/${publisherId}/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch publisher profile');
        }

        const json = await response.json();
        return json.data;
    },

    getPublicProfile: async (publisherSlugOrId: string): Promise<PublisherProfileData> => {
        const response = await fetch(`${API_ENDPOINT}/publishers/${publisherSlugOrId}/profile`);

        if (!response.ok) {
            throw new Error('Failed to fetch publisher profile');
        }

        const json = await response.json();
        return json.data;
    },

    updateProfile: async (publisherId: string, data: UpdatePublisherProfileData, token: string): Promise<PublisherProfileData> => {
        const response = await fetch(`${API_ENDPOINT}/publishers/${publisherId}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update profile');
        }

        const json = await response.json();
        return json.data;
    }
};
