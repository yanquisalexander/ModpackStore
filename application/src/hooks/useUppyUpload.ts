import { useEffect, useRef, useCallback, useState } from 'react';
import Uppy, { UppyFile } from '@uppy/core';
import XHRUpload from '@uppy/xhr-upload';

export interface UppyUploadOptions {
    endpoint: string;
    headers?: Record<string, string>;
    fieldName?: string;
    formData?: Record<string, string>;
    allowedFileTypes?: string[];
    maxFileSize?: number;
    onProgress?: (progress: number) => void;
    onSuccess?: (response: any) => void;
    onError?: (error: Error) => void;
    onComplete?: () => void;
}

export const useUppyUpload = (options: UppyUploadOptions) => {
    const uppyRef = useRef<Uppy | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    // Initialize Uppy instance
    useEffect(() => {
        const uppy = new Uppy({
            autoProceed: false,
            allowMultipleUploadBatches: false,
            restrictions: {
                maxNumberOfFiles: 1,
                allowedFileTypes: options.allowedFileTypes,
                maxFileSize: options.maxFileSize,
            },
        });

        // Configure XHR Upload plugin
        uppy.use(XHRUpload, {
            endpoint: options.endpoint,
            headers: options.headers || {},
            fieldName: options.fieldName || 'file',
            formData: options.formData || {},
            method: 'POST',
        });

        // Event handlers
        uppy.on('upload-progress', (file, progress) => {
            if (file && progress.bytesTotal) {
                const percentage = Math.round((progress.bytesUploaded / progress.bytesTotal) * 100);
                setProgress(percentage);
                options.onProgress?.(percentage);
            }
        });

        uppy.on('upload-success', (file, response) => {
            setProgress(100);
            options.onSuccess?.(response);
        });

        uppy.on('upload-error', (file, error) => {
            options.onError?.(error as Error);
        });

        uppy.on('complete', (result) => {
            setIsUploading(false);
            options.onComplete?.();
        });

        uppyRef.current = uppy;

        // Cleanup
        return () => {
            uppy.close();
        };
    }, []);

    // Update endpoint and headers when they change
    useEffect(() => {
        if (uppyRef.current) {
            const xhrPlugin = uppyRef.current.getPlugin('XHRUpload') as any;
            if (xhrPlugin) {
                xhrPlugin.setOptions({
                    endpoint: options.endpoint,
                    headers: options.headers || {},
                    formData: options.formData || {},
                });
            }
        }
    }, [options.endpoint, options.headers, options.formData]);

    const addFile = useCallback((file: File) => {
        if (!uppyRef.current) return;

        // Remove any existing files first
        uppyRef.current.cancelAll();
        const files = uppyRef.current.getFiles();
        files.forEach(f => uppyRef.current?.removeFile(f.id));

        try {
            uppyRef.current.addFile({
                name: file.name,
                type: file.type,
                data: file,
            });
        } catch (error) {
            console.error('Error adding file to Uppy:', error);
            throw error;
        }
    }, []);

    const upload = useCallback(async () => {
        if (!uppyRef.current) {
            throw new Error('Uppy instance not initialized');
        }

        const files = uppyRef.current.getFiles();
        if (files.length === 0) {
            throw new Error('No file to upload');
        }

        setIsUploading(true);
        setProgress(0);

        try {
            const result = await uppyRef.current.upload();
            return result;
        } catch (error) {
            setIsUploading(false);
            throw error;
        }
    }, []);

    const cancelUpload = useCallback(() => {
        if (uppyRef.current) {
            uppyRef.current.cancelAll();
            setIsUploading(false);
            setProgress(0);
        }
    }, []);

    const removeFile = useCallback(() => {
        if (uppyRef.current) {
            const files = uppyRef.current.getFiles();
            files.forEach(f => uppyRef.current?.removeFile(f.id));
            setProgress(0);
        }
    }, []);

    return {
        uppy: uppyRef.current,
        addFile,
        upload,
        cancelUpload,
        removeFile,
        isUploading,
        progress,
    };
};
