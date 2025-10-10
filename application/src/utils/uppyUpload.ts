import Uppy from '@uppy/core';
import XHRUpload from '@uppy/xhr-upload';

export interface UploadFileOptions {
    file: File;
    endpoint: string;
    headers?: Record<string, string>;
    fieldName?: string;
    formData?: Record<string, string>;
    onProgress?: (progress: number) => void;
    onSuccess?: (response: any) => void;
    onError?: (error: Error) => void;
}

/**
 * Upload a file using Uppy with XHR
 * This is a standalone utility for one-off uploads that don't need the full hook
 */
export const uploadFileWithUppy = async (options: UploadFileOptions): Promise<any> => {
    const {
        file,
        endpoint,
        headers = {},
        fieldName = 'file',
        formData = {},
        onProgress,
        onSuccess,
        onError,
    } = options;

    return new Promise((resolve, reject) => {
        const uppy = new Uppy({
            autoProceed: false,
            allowMultipleUploadBatches: false,
            restrictions: {
                maxNumberOfFiles: 1,
            },
        });

        // Configure XHR Upload plugin
        uppy.use(XHRUpload, {
            endpoint,
            headers,
            fieldName,
            formData: true,
            method: 'POST',
        });

        // Event handlers
        uppy.on('upload-progress', (uppyFile, progress) => {
            if (uppyFile && progress.bytesTotal) {
                const percentage = Math.round((progress.bytesUploaded / progress.bytesTotal) * 100);
                onProgress?.(percentage);
            }
        });

        uppy.on('upload-success', (_uppyFile, response) => {
            onSuccess?.(response);
            uppy.destroy();
            resolve(response);
        });

        uppy.on('upload-error', (_uppyFile, error) => {
            const err = error as Error;
            onError?.(err);
            uppy.destroy();
            reject(err);
        });

        uppy.on('error', (error) => {
            const err = error as Error;
            onError?.(err);
            uppy.destroy();
            reject(err);
        });

        // Add file and start upload
        try {
            uppy.addFile({
                name: file.name,
                type: file.type,
                data: file,
                meta: formData,
            });

            uppy.upload().catch((error) => {
                uppy.destroy();
                reject(error);
            });
        } catch (error) {
            uppy.destroy();
            reject(error);
        }
    });
};

/**
 * Cancel an ongoing upload
 * Note: This is a utility for managing Uppy instances externally
 */
export const createUppyInstance = (options: {
    endpoint: string;
    headers?: Record<string, string>;
    fieldName?: string;
    formData?: Record<string, string>;
}) => {
    const uppy = new Uppy({
        autoProceed: false,
        allowMultipleUploadBatches: false,
        restrictions: {
            maxNumberOfFiles: 1,
        },
    });

    uppy.use(XHRUpload, {
        endpoint: options.endpoint,
        headers: options.headers || {},
        fieldName: options.fieldName || 'file',
        formData: true,
        method: 'POST',
    });

    return uppy;
};
