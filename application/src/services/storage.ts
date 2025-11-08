import { API_ENDPOINT } from "@/consts";

export interface PublisherFile {
    id: string;
    publisherId: string;
    fileName: string;
    fileSizeKb: number;
    r2Key: string;
    contentType: string;
    uploadedAt: string;
    cdnUrl: string;
}

export interface StorageUsage {
    usedKb: number;
    limitKb: number;
    availableKb: number;
    percentage: number;
}

/**
 * Get all files for a publisher
 */
export async function getPublisherFiles(
    token: string,
    publisherId: string
): Promise<PublisherFile[]> {
    const response = await fetch(`${API_ENDPOINT}/creators/publishers/${publisherId}/storage`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.statusText}`);
    }

    const data = await response.json();
    return data.files;
}

/**
 * Get storage usage for a publisher
 */
export async function getStorageUsage(
    token: string,
    publisherId: string
): Promise<StorageUsage> {
    const response = await fetch(`${API_ENDPOINT}/creators/publishers/${publisherId}/storage/usage`, {
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
    return data.usage;
}

/**
 * Upload a file to publisher storage
 */
export async function uploadFile(
    token: string,
    publisherId: string,
    file: File,
    onProgress?: (progress: number) => void
): Promise<PublisherFile> {
    const formData = new FormData();
    formData.append('file', file);

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
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
                    resolve(data.file);
                } catch (error) {
                    reject(new Error('Failed to parse response'));
                }
            } else {
                try {
                    const error = JSON.parse(xhr.responseText);
                    reject(new Error(error.message || xhr.statusText));
                } catch {
                    reject(new Error(xhr.statusText));
                }
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Network error occurred'));
        });

        xhr.open('POST', `${API_ENDPOINT}/creators/publishers/${publisherId}/storage/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
    });
}

/**
 * Delete a file from publisher storage
 */
export async function deleteFile(
    token: string,
    publisherId: string,
    fileId: string
): Promise<void> {
    const response = await fetch(`${API_ENDPOINT}/creators/publishers/${publisherId}/storage/${fileId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to delete file: ${response.statusText}`);
    }
}
