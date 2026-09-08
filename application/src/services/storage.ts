import { API_ENDPOINT } from "@/consts";

export interface CreatorAsset {
    id: string;
    creatorId: string;
    fileName: string;
    r2Key: string;
    contentType: string;
    sizeBytes: number;
    createdAt: string;
    url: string;
}

export interface StorageUsage {
    usedBytes: number;
    limitBytes: number;
    availableBytes: number;
    percentage: number;
}

export interface StorageConfig {
    creatorId: string;
    storageLimitBytes: number;
    createdAt: string;
    updatedAt: string;
}

/**
 * Get all assets for a creator
 */
export async function getCreatorAssets(
    token: string,
    creatorId: string
): Promise<CreatorAsset[]> {
    const response = await fetch(`${API_ENDPOINT}/creators/${creatorId}/assets`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch assets: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
}

/**
 * Get storage usage for a creator
 */
export async function getStorageUsage(
    token: string,
    creatorId: string
): Promise<StorageUsage> {
    const response = await fetch(`${API_ENDPOINT}/creators/${creatorId}/storage/usage`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch storage usage: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
}

/**
 * Get storage config for a creator
 */
export async function getStorageConfig(
    token: string,
    creatorId: string
): Promise<StorageConfig> {
    const response = await fetch(`${API_ENDPOINT}/creators/${creatorId}/storage/config`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch storage config: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
}

/**
 * Upload an asset to creator storage
 */
export async function uploadAsset(
    token: string,
    creatorId: string,
    file: File,
    onProgress?: (progress: number) => void
): Promise<CreatorAsset> {
    const formData = new FormData();
    formData.append('file', file);

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        if (onProgress) {
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    onProgress(percentComplete);
                }
            });
        }

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    resolve(data.data);
                } catch (error) {
                    reject(new Error('Failed to parse response'));
                }
            } else {
                try {
                    const error = JSON.parse(xhr.responseText);
                    reject(new Error(error.errors?.[0]?.detail || error.message || xhr.statusText));
                } catch {
                    reject(new Error(xhr.statusText));
                }
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Network error occurred'));
        });

        xhr.open('POST', `${API_ENDPOINT}/creators/${creatorId}/assets`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
    });
}

/**
 * Delete an asset from creator storage
 */
export async function deleteAsset(
    token: string,
    creatorId: string,
    assetId: string
): Promise<void> {
    const response = await fetch(`${API_ENDPOINT}/creators/${creatorId}/assets/${assetId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to delete asset: ${response.statusText}`);
    }
}

// Legacy exports for backwards compatibility
export const getPublisherFiles = getCreatorAssets;
export const uploadFile = uploadAsset;
export const deleteFile = deleteAsset;

export interface PublisherFile extends CreatorAsset {
    fileSizeKb: number;
    uploadedAt: string;
    cdnUrl: string;
}
