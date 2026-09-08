import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    LucideCloud,
    LucideUpload,
    LucideAlertCircle,
    LucideTrash2,
    LucideCopy,
    LucideCheck,
    LucideImage,
    LucideMusic,
    LucideVideo,
    LucideFile,
    LucideLoader2
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { getCreatorAssets, getStorageUsage, uploadAsset, deleteAsset, CreatorAsset, StorageUsage } from '@/services/storage';
import { toast } from 'sonner';

export const PublisherStorageView: React.FC = () => {
    const { publisherId } = useParams<{ publisherId: string }>();
    const { sessionTokens } = useAuthentication();
    
    const [files, setFiles] = useState<CreatorAsset[]>([]);
    const [usage, setUsage] = useState<StorageUsage | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<CreatorAsset | null>(null);
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

    // Load files and usage
    const loadData = useCallback(async () => {
        if (!publisherId || !sessionTokens?.accessToken) return;

        try {
            setLoading(true);
            const [filesData, usageData] = await Promise.all([
                getCreatorAssets(sessionTokens.accessToken, publisherId),
                getStorageUsage(sessionTokens.accessToken, publisherId)
            ]);
            setFiles(filesData);
            setUsage(usageData);
        } catch (error) {
            console.error('Error loading storage data:', error);
            toast.error('Error al cargar los archivos');
        } finally {
            setLoading(false);
        }
    }, [publisherId, sessionTokens?.accessToken]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Handle file upload
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !publisherId || !sessionTokens?.accessToken) return;

        // Check file size (10 MB limit)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            toast.error('El archivo excede el tamaño máximo permitido (10 MB)');
            return;
        }

        // Check if file type is allowed
        const allowedTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
            'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm',
            'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
        ];
        
        if (!allowedTypes.includes(file.type)) {
            toast.error('Tipo de archivo no permitido. Solo se permiten imágenes, audio y video.');
            return;
        }

        try {
            setUploading(true);
            setUploadProgress(0);
            
            await uploadAsset(
                sessionTokens.accessToken,
                publisherId,
                file,
                (progress) => setUploadProgress(progress)
            );
            
            toast.success('Archivo subido exitosamente');
            await loadData();
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error(error instanceof Error ? error.message : 'Error al subir el archivo');
        } finally {
            setUploading(false);
            setUploadProgress(0);
            // Reset input
            event.target.value = '';
        }
    };

    // Handle file deletion
    const handleDeleteFile = async () => {
        if (!fileToDelete || !publisherId || !sessionTokens?.accessToken) return;

        try {
            await deleteAsset(sessionTokens.accessToken, publisherId, fileToDelete.id);
            toast.success('Archivo eliminado exitosamente');
            await loadData();
        } catch (error) {
            console.error('Error deleting file:', error);
            toast.error('Error al eliminar el archivo');
        } finally {
            setDeleteDialogOpen(false);
            setFileToDelete(null);
        }
    };

    // Copy URL to clipboard
    const handleCopyUrl = async (file: CreatorAsset) => {
        try {
            await navigator.clipboard.writeText(file.url);
            setCopiedUrl(file.id);
            toast.success('URL copiada al portapapeles');
            setTimeout(() => setCopiedUrl(null), 2000);
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            toast.error('Error al copiar la URL');
        }
    };

    // Get icon for file type
    const getFileIcon = (contentType: string) => {
        if (contentType.startsWith('image/')) return LucideImage;
        if (contentType.startsWith('audio/')) return LucideMusic;
        if (contentType.startsWith('video/')) return LucideVideo;
        return LucideFile;
    };

    // Format file size
    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    };

    // Format date
    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!publisherId) {
        return (
            <div className="text-center py-8">
                <Alert variant="destructive">
                    <LucideAlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Publisher ID no encontrado.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header (Consistent with Admin Layout) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-500">
                        <LucideCloud className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">Cloud Storage</h1>
                        <p className="text-sm text-muted-foreground">
                            Administra tus recursos multimedia para los modpacks
                        </p>
                    </div>
                </div>
                <div>
                    <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept="image/*,audio/*,video/*"
                        onChange={handleFileUpload}
                        disabled={uploading}
                    />
                    <label htmlFor="file-upload">
                        <Button 
                            asChild 
                            disabled={uploading}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            <span>
                                {uploading ? (
                                    <>
                                        <LucideLoader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Subiendo...
                                    </>
                                ) : (
                                    <>
                                        <LucideUpload className="h-4 w-4 mr-2" />
                                        Subir Archivo
                                    </>
                                )}
                            </span>
                        </Button>
                    </label>
                </div>
            </div>

            {/* Upload Progress */}
            {uploading && (
                <Card>
                    <CardContent className="pt-6">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>Subiendo archivo...</span>
                                <span>{Math.round(uploadProgress)}%</span>
                            </div>
                            <Progress value={uploadProgress} />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Storage Usage */}
            {usage && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Uso de Almacenamiento</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                                {formatFileSize(usage.usedBytes)} de {formatFileSize(usage.limitBytes)} utilizados
                            </span>
                            <span className="font-medium">{usage.percentage.toFixed(1)}%</span>
                        </div>
                        <Progress value={usage.percentage} />
                    </CardContent>
                </Card>
            )}

            {/* Files List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Archivos</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">
                            <LucideLoader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">Cargando archivos...</p>
                        </div>
                    ) : files.length === 0 ? (
                        <div className="text-center py-8">
                            <LucideCloud className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                            <p className="mt-4 text-sm text-muted-foreground">
                                No hay archivos aún. Sube tu primer archivo.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {files.map((file) => {
                                const Icon = getFileIcon(file.contentType);
                                const isImage = file.contentType.startsWith('image/');
                                const isAudio = file.contentType.startsWith('audio/');
                                const isVideo = file.contentType.startsWith('video/');

                                return (
                                    <div
                                        key={file.id}
                                        className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        {/* File Icon/Preview */}
                                        <div className="flex-shrink-0">
                                            {isImage ? (
                                                <img
                                                    src={file.url}
                                                    alt={file.fileName}
                                                    className="w-16 h-16 object-cover rounded"
                                                />
                                            ) : (
                                                <div className="w-16 h-16 flex items-center justify-center bg-muted rounded">
                                                    <Icon className="h-8 w-8 text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>

                                        {/* File Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{file.fileName}</p>
                                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                                <span>{formatFileSize(file.sizeBytes)}</span>
                                                <span>•</span>
                                                <span>{formatDate(file.createdAt)}</span>
                                            </div>
                                        </div>

                                        {/* Preview for audio/video */}
                                        {(isAudio || isVideo) && (
                                            <div className="flex-shrink-0">
                                                {isAudio ? (
                                                    <audio controls className="h-10 max-w-xs">
                                                        <source src={file.url} type={file.contentType} />
                                                    </audio>
                                                ) : (
                                                    <video controls className="h-20 max-w-xs rounded">
                                                        <source src={file.url} type={file.contentType} />
                                                    </video>
                                                )}
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleCopyUrl(file)}
                                            >
                                                {copiedUrl === file.id ? (
                                                    <LucideCheck className="h-4 w-4" />
                                                ) : (
                                                    <LucideCopy className="h-4 w-4" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setFileToDelete(file);
                                                    setDeleteDialogOpen(true);
                                                }}
                                            >
                                                <LucideTrash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar archivo?</AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Estás seguro de que deseas eliminar "{fileToDelete?.fileName}"? Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteFile}>
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
