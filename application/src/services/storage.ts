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
 * Upload an asset to creator storage (directo a R2 con presigned URL).
 * Flujo: upload-url -> PUT directo a R2 -> confirm.
 * Los límites (tipo, tope 10MB solo no-verificados, cuota) se validan en servidor.
 */
export async function uploadAsset(
    token: string,
    creatorId: string,
    file: File,
    onProgress?: (progress: number) => void
): Promise<CreatorAsset> {
    const parseError = async (res: Response, fallback: string): Promise<Error> => {
        try {
            const body = await res.json();
            return new Error(body.errors?.[0]?.detail || body.error || fallback);
        } catch {
            return new Error(fallback);
        }
    };

    // 1) Pedir URL presignada (valida tipo + tope + cuota en servidor)
    const urlRes = await fetch(`${API_ENDPOINT}/creators/${creatorId}/assets/upload-url`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
        }),
    });
    if (!urlRes.ok) throw await parseError(urlRes, urlRes.statusText);
    const { uploadUrl, r2Key } = (await urlRes.json()).data;

    // 2) Subida directa a R2 (no pasa por la API, con progreso)
    await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        if (onProgress) {
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
            });
        }
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Direct upload failed: ${xhr.statusText}`));
        });
        xhr.addEventListener('error', () => reject(new Error('Network error occurred')));
        xhr.open('PUT', uploadUrl);
        if (file.type) xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
    });

    // 3) Confirmar (revalida en servidor y registra en DB)
    const confirmRes = await fetch(`${API_ENDPOINT}/creators/${creatorId}/assets/confirm`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            fileName: file.name,
            r2Key,
            contentType: file.type,
            sizeBytes: file.size,
        }),
    });
    if (!confirmRes.ok) throw await parseError(confirmRes, confirmRes.statusText);
    return (await confirmRes.json()).data;
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
