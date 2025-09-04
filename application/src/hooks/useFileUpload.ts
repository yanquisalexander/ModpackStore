import { useState, useCallback } from 'react';
import { toast } from 'sonner';

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
}

export const useFileUpload = (options: UseFileUploadOptions = {}) => {
    const {
        acceptedTypes = ['image/*'],
        maxSize = 5 * 1024 * 1024, // 5MB default
        onFileSelect
    } = options;

    const [state, setState] = useState<FileUploadState>({
        file: null,
        preview: null,
        progress: 0,
        isUploading: false,
        error: null,
    });

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

    return {
        ...state,
        selectFile,
        setProgress,
        setUploading,
        setError,
        reset,
        formatFileSize,
    };
};