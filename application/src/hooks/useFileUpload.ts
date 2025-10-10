import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useUppyUpload, UppyUploadOptions } from './useUppyUpload';

export interface FileUploadState {
    file: File | null;
    preview: string | null;
    progress: number;
    isUploading: boolean;
    error: string | null;
}

export interface UseFileUploadOptions {
    acceptedTypes?: string[];
    maxSize?: number; // in bytes
    onFileSelect?: (file: File | null) => void;
    // Uppy integration options (optional)
    endpoint?: string;
    headers?: Record<string, string>;
    fieldName?: string;
    formData?: Record<string, string>;
    onUploadSuccess?: (response: any) => void;
    onUploadError?: (error: Error) => void;
    onUploadComplete?: () => void;
}

export const useFileUpload = (options: UseFileUploadOptions = {}) => {
    const {
        acceptedTypes = ['image/*'],
        maxSize = 5 * 1024 * 1024, // 5MB default
        onFileSelect,
        endpoint,
        headers,
        fieldName,
        formData,
        onUploadSuccess,
        onUploadError,
        onUploadComplete
    } = options;

    const [state, setState] = useState<FileUploadState>({
        file: null,
        preview: null,
        progress: 0,
        isUploading: false,
        error: null,
    });

    // Initialize Uppy if endpoint is provided
    const uppyUpload = endpoint ? useUppyUpload({
        endpoint,
        headers,
        fieldName,
        formData,
        allowedFileTypes: acceptedTypes,
        maxFileSize: maxSize,
        onProgress: (progress: number) => {
            setState(prev => ({ ...prev, progress }));
        },
        onSuccess: (response: any) => {
            setState(prev => ({ ...prev, progress: 100, isUploading: false }));
            onUploadSuccess?.(response);
        },
        onError: (error: Error) => {
            setState(prev => ({ ...prev, error: error.message, isUploading: false }));
            toast.error(error.message);
            onUploadError?.(error);
        },
        onComplete: () => {
            setState(prev => ({ ...prev, isUploading: false }));
            onUploadComplete?.();
        }
    }) : null;

    const validateFile = useCallback((file: File): boolean => {
        // Check file type
        const isValidType = acceptedTypes.some(type => {
            if (type === 'image/*') {
                return file.type.startsWith('image/');
            }
            return file.type === type;
        });

        if (!isValidType) {
            const allowedTypes = acceptedTypes.join(', ');
            toast.error(`Tipo de archivo no válido. Se permite: ${allowedTypes}`);
            return false;
        }

        // Check file size
        if (file.size > maxSize) {
            const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
            toast.error(`El archivo es demasiado grande. Tamaño máximo: ${maxSizeMB}MB`);
            return false;
        }

        return true;
    }, [acceptedTypes, maxSize]);

    const selectFile = useCallback((file: File | null) => {
        if (!file) {
            setState({
                file: null,
                preview: null,
                progress: 0,
                isUploading: false,
                error: null,
            });
            onFileSelect?.(null);
            return;
        }

        if (!validateFile(file)) {
            return;
        }

        // Create preview URL for images
        let preview: string | null = null;
        if (file.type.startsWith('image/')) {
            preview = URL.createObjectURL(file);
        }

        setState({
            file,
            preview,
            progress: 0,
            isUploading: false,
            error: null,
        });

        onFileSelect?.(file);
    }, [validateFile, onFileSelect]);

    const setProgress = useCallback((progress: number) => {
        setState(prev => ({ ...prev, progress }));
    }, []);

    const setUploading = useCallback((isUploading: boolean) => {
        setState(prev => ({ ...prev, isUploading }));
    }, []);

    const setError = useCallback((error: string | null) => {
        setState(prev => ({ ...prev, error }));
    }, []);

    const reset = useCallback(() => {
        setState({
            file: null,
            preview: null,
            progress: 0,
            isUploading: false,
            error: null,
        });
    }, []);

    const formatFileSize = useCallback((bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }, []);

    const upload = useCallback(async () => {
        if (!state.file) {
            throw new Error('No file selected');
        }

        if (!uppyUpload) {
            throw new Error('Upload endpoint not configured');
        }

        setState(prev => ({ ...prev, isUploading: true, error: null, progress: 0 }));

        try {
            uppyUpload.addFile(state.file);
            await uppyUpload.upload();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Upload failed';
            setState(prev => ({ ...prev, error: errorMessage, isUploading: false }));
            throw error;
        }
    }, [state.file, uppyUpload]);

    return {
        ...state,
        selectFile,
        setProgress,
        setUploading,
        setError,
        reset,
        formatFileSize,
        upload,
        uppyInstance: uppyUpload,
    };
};