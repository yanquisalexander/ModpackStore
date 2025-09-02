import { API_ENDPOINT } from "../consts";

// Based on backend/src/models/Publisher.model.ts newPublisherSchema
export interface NewPublisherData {
    publisherName: string;
    tosUrl: string;
    privacyUrl: string;
    bannerUrl: string;
    logoUrl: string;
    description: string;
    websiteUrl?: string;
    discordUrl?: string;
    // Admin-only fields, assuming they can be set on creation by an admin
    banned?: boolean;
    verified?: boolean;
    partnered?: boolean;
    isHostingPartner?: boolean;
}

// Based on backend/src/models/Publisher.model.ts publisherUpdateSchema
export interface UpdatePublisherData extends Partial<NewPublisherData> {}

// Based on backend/src/models/Publisher.model.ts PublisherType
export interface PublisherData {
    id: string;
    publisherName: string;
    tosUrl: string;
    privacyUrl: string;
    bannerUrl: string;
    logoUrl: string;
    description: string;
    websiteUrl: string | null;
    discordUrl: string | null;
    banned: boolean;
    verified: boolean;
    partnered: boolean;
    isHostingPartner: boolean;
    createdAt: string; // Date as string from JSON
    // Potentially include members and modpacks if getCompletePublisher is used and returns them
    members?: any[];
    modpacks?: any[];
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

export async function listPublishers(token: string): Promise<PublisherData[]> {
    const response = await fetch(`${API_ENDPOINT}/admin/publishers`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    const json = await handleResponse<{ data: any[] }>(response);
    return json.data.map(item => item.attributes);
}

export async function getPublisherDetails(publisherId: string, token: string): Promise<PublisherData> {
    const response = await fetch(`${API_ENDPOINT}/admin/publishers/${publisherId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    const json = await handleResponse<{ data: any }>(response);
    return json.data.attributes;
}

export async function createPublisher(publisherData: NewPublisherData, token: string): Promise<PublisherData> {
    const response = await fetch(`${API_ENDPOINT}/admin/publishers`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(publisherData),
    });
    const json = await handleResponse<{ data: any }>(response);
    return json.data.attributes;
}

export async function updatePublisher(publisherId: string, publisherData: UpdatePublisherData, token: string): Promise<PublisherData> {
    const response = await fetch(`${API_ENDPOINT}/admin/publishers/${publisherId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(publisherData),
    });
    const json = await handleResponse<{ data: any }>(response);
    return json.data.attributes;
}

export async function deletePublisher(publisherId: string, token: string): Promise<void> {
    const response = await fetch(`${API_ENDPOINT}/admin/publishers/${publisherId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        // For DELETE, often a 204 No Content is returned for success, which wouldn't have JSON.
        // Or a 200 with a success message.
        if (response.status === 204) {
            return;
        }
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`API request failed with status ${response.status}: ${errorData.message || 'Unknown error'}`);
    }
    // If 200 OK with a body, it might be parsed, otherwise just return.
    // Depending on backend, it might return a success message or the deleted object.
    // For now, assuming no body or ignoring it for a successful delete.
    if (response.status !== 204) {
        try {
            await response.json(); // consume body if any
        } catch (e) {
            // ignore if no body or not json
        }
    }
}

// Member management functions

export interface PublisherMemberData {
    id: number;
    userId: string;
    publisherId: string;
    role: string;
    createdAt: string;
    updatedAt: string;
    user?: {
        id: string;
        username: string;
        email: string;
    };
}

export async function addMember(publisherId: string, userId: string, role: string, token: string): Promise<void> {
    const response = await fetch(`${API_ENDPOINT}/admin/publishers/${publisherId}/members`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, role }),
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`API request failed with status ${response.status}: ${errorData.message || 'Unknown error'}`);
    }
}

export async function removeMember(publisherId: string, userId: string, token: string): Promise<void> {
    const response = await fetch(`${API_ENDPOINT}/admin/publishers/${publisherId}/members/${userId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`API request failed with status ${response.status}: ${errorData.message || 'Unknown error'}`);
    }
}

export async function getPublisherMembers(publisherId: string, token: string): Promise<PublisherMemberData[]> {
    const response = await fetch(`${API_ENDPOINT}/admin/publishers/${publisherId}/members`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    const json = await handleResponse<{ data: any[] }>(response);
    return json.data.map(item => item.attributes);
}

export async function getPublisherModpacks(publisherId: string, token: string, limit = 20, offset = 0): Promise<{ modpacks: any[], total: number }> {
    const response = await fetch(`${API_ENDPOINT}/admin/publishers/${publisherId}/modpacks?limit=${limit}&offset=${offset}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    const json = await handleResponse<{ data: any[], meta: { total: number } }>(response);
    return {
        modpacks: json.data.map(item => item.attributes),
        total: json.meta.total
    };
}
