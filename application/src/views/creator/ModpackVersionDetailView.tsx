import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LucideEdit2, LucideSave, LucideUpload, LucideFile, LucideTrash2, LucideSend, LucidePackage, LucideImage, LucideSettings, LucidePalette, LucideFolder } from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINT } from '@/consts';
import { useAuthentication } from '@/stores/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { handleApiError } from '@/lib/utils';

interface ModpackVersion {
    id: string;
    version: string;
    mcVersion: string;
    forgeVersion?: string;
    changelog?: string;
    status: string;
    releaseDate?: string;
    createdAt: string;
    updatedAt: string;
    modpack: {
        id: string;
        name: string;
        publisherId: string;
    };
    files: ModpackVersionFile[];
}

interface ModpackVersionFile {
    fileHash: string;
    path: string;
    file: {
        type: 'mods' | 'resourcepacks' | 'config' | 'shaderpacks' | 'extras';
    };
}

const ModpackVersionDetailView: React.FC = () => {
    console.log('Rendering ModpackVersionDetailView');
    const { orgId: publisherId, modpackId, versionId } = useParams<{
        orgId: string;
        modpackId: string;
        versionId: string;
    }>();

    const { sessionTokens } = useAuthentication();

    const [version, setVersion] = useState<ModpackVersion | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingChangelog, setEditingChangelog] = useState(false);
    const [changelog, setChangelog] = useState('');
    const [uploadingFile, setUploadingFile] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [uploadDialog, setUploadDialog] = useState<{
        open: boolean;
        type: string;
        file: File | null;
        progress: number;
    }>({
        open: false,
        type: '',
        file: null,
        progress: 0
    });

    // New state for file reuse functionality
    const [reuseDialog, setReuseDialog] = useState<{
        open: boolean;
        type: string;
        previousFiles: Array<{
            version: string;
            versionId: string;
            files: Array<{
                fileHash: string;
                path: string;
                size: number;
            }>;
        }>;
        selectedFiles: string[];
        loading: boolean;
    }>({
        open: false,
        type: '',
        previousFiles: [],
        selectedFiles: [],
        loading: false
    });

    useEffect(() => {
        if (publisherId && modpackId && versionId) {
            fetchVersionDetails();
        }
    }, [publisherId, modpackId, versionId]);

    const fetchVersionDetails = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}`, {
                headers: {
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                },
            });

            if (!res.ok) {
                await handleApiError(res);
            }

            const data = await res.json();
            console.log('Version details fetched successfully:', data);
            setVersion(data.version);
            setChangelog(data.version.changelog || '');
        } catch (error) {
            console.error('Error fetching version details:', error);
            toast.error(error instanceof Error ? error.message : 'Error al cargar los detalles de la versión');
        } finally {
            setLoading(false);
        }
    };

    const updateChangelog = async () => {
        if (!version) return;

        try {
            const res = await fetch(
                `${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ changelog }),
                }
            );

            if (!res.ok) {
                await handleApiError(res);
            }

            setVersion({ ...version, changelog });
            setEditingChangelog(false);
            toast.success('Changelog actualizado correctamente');
        } catch (error) {
            console.error('Error updating changelog:', error);
            toast.error(error instanceof Error ? error.message : 'Error al actualizar el changelog');
        }
    };

    const publishVersion = async () => {
        if (!version) return;

        setPublishing(true);
        try {
            const res = await fetch(
                `${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}/publish`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                        'Content-Type': 'application/json',
                    }
                }
            );

            if (!res.ok) {
                throw new Error('Error al publicar la versión');
            }

            setVersion({ ...version, status: 'published', releaseDate: new Date().toISOString() });
            toast.success('Versión publicada correctamente');
        } catch (error) {
            console.error('Error publishing version:', error);
            toast.error('Error al publicar la versión');
        } finally {
            setPublishing(false);
        }
    };

    const handleFileUpload = async (file: File, type: string) => {
        if (!file) return;

        // Validar que sea un archivo ZIP
        if (!file.name.toLowerCase().endsWith('.zip')) {
            toast.error('Solo se permiten archivos ZIP');
            return;
        }

        setUploadingFile(true);
        setUploadDialog(prev => ({ ...prev, progress: 0 }));

        return new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    setUploadDialog(prev => ({ ...prev, progress: percentComplete }));
                }
            });

            xhr.addEventListener('load', () => {
                // Try to parse a JSON error body from the API so we can show useful messages
                const isSuccess = xhr.status >= 200 && xhr.status < 300;
                let parsed: any = null;
                try {
                    if (xhr.responseText) {
                        parsed = JSON.parse(xhr.responseText);
                    }
                } catch (e) {
                    // ignore parse errors, we'll fallback to statusText
                }

                if (isSuccess) {
                    setUploadDialog(prev => ({ ...prev, progress: 100 }));
                    toast.success('Archivo subido correctamente');
                    fetchVersionDetails();
                    resolve();
                } else {
                    // Build a helpful message from the API error structure if present
                    let message = `Error ${xhr.status}`;
                    if (parsed && parsed.errors && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
                        // Prefer the 'detail' field, fall back to title/code
                        message = parsed.errors.map((err: any) => err.detail || err.title || err.code || JSON.stringify(err)).join('; ');
                    } else if (xhr.statusText) {
                        message = `${message}: ${xhr.statusText}`;
                    }

                    reject(new Error(message));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Error de red al subir el archivo'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('Subida cancelada'));
            });

            const formData = new FormData();
            formData.append('file', file);

            xhr.open('POST', `${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}/files/${type}`);
            xhr.setRequestHeader('Authorization', `Bearer ${sessionTokens?.accessToken}`);
            xhr.send(formData);
        }).catch((error) => {
            console.error('Error uploading file:', error);
            toast.error(error.message || 'Error al subir el archivo');
        }).finally(() => {
            setUploadingFile(false);
            setUploadDialog(prev => ({ ...prev, open: false, file: null, progress: 0 }));
        });
    };

    const openUploadDialog = (type: string) => {
        setUploadDialog({
            open: true,
            type,
            file: null,
            progress: 0
        });
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setUploadDialog(prev => ({ ...prev, file }));
        }
    };

    const confirmUpload = async () => {
        if (uploadDialog.file) {
            await handleFileUpload(uploadDialog.file, uploadDialog.type);
        }
    };

    // New functions for file reuse
    const fetchPreviousFiles = async (type: string) => {
        setReuseDialog(prev => ({ ...prev, loading: true }));
        try {
            const res = await fetch(`${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}/previous-files/${type}`, {
                headers: {
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                },
            });

            if (!res.ok) {
                await handleApiError(res);
                return;
            }

            const data = await res.json();
            setReuseDialog(prev => ({
                ...prev,
                previousFiles: data.previousFiles || [],
                selectedFiles: [],
                loading: false
            }));
        } catch (error) {
            console.error('Error fetching previous files:', error);
            toast.error('Error al cargar archivos anteriores');
            setReuseDialog(prev => ({ ...prev, loading: false }));
        }
    };

    const openReuseDialog = async (type: string) => {
        setReuseDialog({
            open: true,
            type,
            previousFiles: [],
            selectedFiles: [],
            loading: false
        });
        await fetchPreviousFiles(type);
    };

    const toggleFileSelection = (fileHash: string) => {
        setReuseDialog(prev => ({
            ...prev,
            selectedFiles: prev.selectedFiles.includes(fileHash)
                ? prev.selectedFiles.filter(h => h !== fileHash)
                : [...prev.selectedFiles, fileHash]
        }));
    };

    const confirmFileReuse = async () => {
        if (reuseDialog.selectedFiles.length === 0) {
            toast.error('Selecciona al menos un archivo para reutilizar');
            return;
        }

        try {
            const res = await fetch(`${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}/reuse-files/${reuseDialog.type}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fileHashes: reuseDialog.selectedFiles
                })
            });

            if (!res.ok) {
                await handleApiError(res);
                return;
            }

            const data = await res.json();
            toast.success(data.message || 'Archivos reutilizados correctamente');
            fetchVersionDetails();
            setReuseDialog(prev => ({ ...prev, open: false }));
        } catch (error) {
            console.error('Error reusing files:', error);
            toast.error(error instanceof Error ? error.message : 'Error al reutilizar archivos');
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, type: string) => {
        e.preventDefault();

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            await handleFileUpload(files[0], type);
        }
    };

    const deleteFile = async (fileHash: string, fileType: string) => {
        try {
            const res = await fetch(
                `${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}/files/${fileType}/${fileHash}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                    },
                }
            );

            if (!res.ok) {
                throw new Error('Error al eliminar el archivo');
            }

            toast.success('Archivo eliminado correctamente');
            fetchVersionDetails(); // Recargar los detalles
        } catch (error) {
            console.error('Error deleting file:', error);
            toast.error('Error al eliminar el archivo');
        }
    };

    const FileSection: React.FC<{
        title: string;
        description: string;
        type: 'mods' | 'resourcepacks' | 'config' | 'shaderpacks' | 'extras';
        files: ModpackVersionFile[];
        icon: React.ReactNode;
    }> = ({ title, description, type, files, icon }) => {
        const filteredFiles = files.filter(file => file.file.type === type);

        return (
            <Card
                className="transition-all duration-200 hover:shadow-md"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, type)}
            >
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {icon}
                        {title}
                        {version && version.status !== 'published' && (
                            <span className="text-xs text-gray-400 ml-auto">
                                Arrastra ZIP aquí
                            </span>
                        )}
                    </CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">

                        {version && version.status !== 'published' && (
                            <div className="flex flex-col items-center space-y-2">
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openUploadDialog(type)}
                                        disabled={uploadingFile}
                                    >
                                        <LucideUpload className="h-4 w-4 mr-2" />
                                        {uploadingFile ? 'Subiendo...' : 'Subir ZIP'}
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => openReuseDialog(type)}
                                        disabled={uploadingFile}
                                    >
                                        <LucidePackage className="h-4 w-4 mr-2" />
                                        Reutilizar
                                    </Button>
                                </div>
                                {filteredFiles.length > 0 && (
                                    <span className="text-xs text-green-600 mt-1">
                                        ✓ Archivos cargados desde versiones anteriores o subidos
                                    </span>
                                )}
                                {filteredFiles.length === 0 && (
                                    <span className="text-xs text-gray-500 mt-1">
                                        Sube nuevos archivos o reutiliza de versiones anteriores
                                    </span>
                                )}
                            </div>
                        )}

                        {filteredFiles.length > 0 && (
                            <div className="space-y-2 max-h-40 overflow-y-scroll overflow-x-hidden">
                                <h4 className="text-sm font-medium text-gray-700">Archivos:</h4>
                                {filteredFiles.map((file) => (
                                    <div
                                        key={file.fileHash}
                                        className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                                    >
                                        <div className="flex items-center space-x-2">
                                            <LucideFile className="h-4 w-4 text-gray-500" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {file.path.split('/').pop()}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Hash: {file.fileHash.substring(0, 8)}...
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            {version && version.status !== 'published' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => deleteFile(file.fileHash, file.file.type)}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <LucideTrash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!version) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Versión no encontrada</h2>
                    <p className="text-gray-600">La versión que buscas no existe o no tienes permisos para verla.</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Upload Dialog */}
            <Dialog open={uploadDialog.open} onOpenChange={(open) => setUploadDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Subir archivo ZIP</DialogTitle>
                        <DialogDescription>
                            Selecciona un archivo ZIP para subir a la sección de {uploadDialog.type}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {!uploadDialog.file ? (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                                <Input
                                    type="file"
                                    accept=".zip"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    id="dialog-file-upload"
                                />
                                <label htmlFor="dialog-file-upload" className="cursor-pointer">
                                    <LucideUpload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                    <p className="text-sm text-gray-600">
                                        Haz clic para seleccionar un archivo ZIP
                                    </p>
                                </label>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                                    <LucideFile className="h-8 w-8 text-gray-500" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">
                                            {uploadDialog.file.name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {formatFileSize(uploadDialog.file.size)}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setUploadDialog(prev => ({ ...prev, file: null }))}
                                        className="text-red-600 hover:text-red-700"
                                    >
                                        <LucideTrash2 className="h-4 w-4" />
                                    </Button>
                                </div>

                                {uploadingFile && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span>Subiendo...</span>
                                            <span>{uploadDialog.progress}%</span>
                                        </div>
                                        <Progress value={uploadDialog.progress} className="w-full" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setUploadDialog(prev => ({ ...prev, open: false, file: null }))}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={confirmUpload}
                            disabled={!uploadDialog.file || uploadingFile}
                        >
                            {uploadingFile ? 'Subiendo...' : 'Subir archivo'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* File Reuse Dialog */}
            <Dialog open={reuseDialog.open} onOpenChange={(open) => setReuseDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Reutilizar archivos de versiones anteriores</DialogTitle>
                        <DialogDescription>
                            Selecciona archivos de tipo "{reuseDialog.type}" de versiones anteriores para reutilizar
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto">
                        {reuseDialog.loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                                    <p className="mt-2 text-sm text-gray-600">Cargando archivos anteriores...</p>
                                </div>
                            </div>
                        ) : reuseDialog.previousFiles.length === 0 ? (
                            <div className="text-center py-8">
                                <LucidePackage className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                                <p className="text-gray-600">No hay archivos de tipo "{reuseDialog.type}" en versiones anteriores</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {reuseDialog.previousFiles.map((version) => (
                                    <div key={version.versionId} className="border rounded-lg p-4">
                                        <h3 className="font-medium text-gray-900 mb-3">
                                            Versión {version.version} ({version.files.length} archivos)
                                        </h3>
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {version.files.map((file) => (
                                                <div
                                                    key={file.fileHash}
                                                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                                                        reuseDialog.selectedFiles.includes(file.fileHash)
                                                            ? 'bg-blue-50 border border-blue-200'
                                                            : 'bg-gray-50 hover:bg-gray-100'
                                                    }`}
                                                    onClick={() => toggleFileSelection(file.fileHash)}
                                                >
                                                    <div className="flex items-center space-x-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={reuseDialog.selectedFiles.includes(file.fileHash)}
                                                            onChange={() => toggleFileSelection(file.fileHash)}
                                                            className="rounded border-gray-300"
                                                        />
                                                        <LucideFile className="h-4 w-4 text-gray-500" />
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">{file.path}</p>
                                                            <p className="text-xs text-gray-500">
                                                                {formatFileSize(file.size)} • {file.fileHash.substring(0, 8)}...
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex justify-between">
                        <div className="text-sm text-gray-600">
                            {reuseDialog.selectedFiles.length} archivo(s) seleccionado(s)
                        </div>
                        <div className="space-x-2">
                            <Button
                                variant="outline"
                                onClick={() => setReuseDialog(prev => ({ ...prev, open: false }))}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={confirmFileReuse}
                                disabled={reuseDialog.selectedFiles.length === 0}
                            >
                                Reutilizar {reuseDialog.selectedFiles.length} archivo(s)
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="min-h-screen">
                <div className="max-w-6xl mx-auto px-4 py-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center space-x-4">

                            <div>
                                <h1 className="text-3xl font-bold text-zinc-50">{version.modpack.name}</h1>
                                <p className="text-zinc-300">Versión {version.version}</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            {version && version.status !== 'published' && (
                                <Button
                                    onClick={publishVersion}
                                    disabled={publishing}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                    <LucideSend className="h-4 w-4 mr-2" />
                                    {publishing ? 'Publicando...' : 'Publicar'}
                                </Button>
                            )}
                            <Badge
                                variant={version.status === 'published' ? 'default' : 'secondary'}
                                className={version.status === 'published' ? 'bg-green-100 text-green-800' : ''}
                            >
                                {version.status}
                            </Badge>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Content */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Version Info */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Información de la Versión</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">Versión</label>
                                            <p className="text-lg font-semibold">{version.version}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">Minecraft</label>
                                            <p className="text-lg">{version.mcVersion}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">Forge</label>
                                            <p className="text-lg">{version.forgeVersion || 'No especificado'}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">Estado</label>
                                            <p className="text-lg capitalize">{version?.status || 'Desconocido'}</p>
                                        </div>
                                    </div>
                                    <Separator />
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Creado</label>
                                        <p>{new Date(version.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    {version.releaseDate && (
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">Publicado</label>
                                            <p>{new Date(version.releaseDate).toLocaleDateString()}</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Changelog */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>Changelog</CardTitle>
                                            <CardDescription>
                                                Describe los cambios en esta versión
                                            </CardDescription>
                                        </div>
                                        {!editingChangelog && version?.status !== 'published' ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setEditingChangelog(true)}
                                            >
                                                <LucideEdit2 className="h-4 w-4 mr-2" />
                                                Editar
                                            </Button>
                                        ) : editingChangelog ? (
                                            <div className="flex space-x-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setEditingChangelog(false);
                                                        setChangelog(version.changelog || '');
                                                    }}
                                                >
                                                    Cancelar
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={updateChangelog}
                                                >
                                                    <LucideSave className="h-4 w-4 mr-2" />
                                                    Guardar
                                                </Button>
                                            </div>
                                        ) : null}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {editingChangelog ? (
                                        <Textarea
                                            value={changelog}
                                            onChange={(e) => setChangelog(e.target.value)}
                                            placeholder="Describe los cambios en esta versión..."
                                            rows={6}
                                            className="w-full"
                                        />
                                    ) : (
                                        <div className="prose max-w-none">
                                            <pre className="whitespace-pre-wrap text-sm text-zinc-200 bg-zinc-800 p-4 rounded-md">
                                                {version.changelog || 'No hay changelog disponible.'}
                                            </pre>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Mods Section */}
                            <FileSection
                                title="Mods"
                                description="Archivos .jar de mods que se instalarán en la carpeta mods"
                                type="mods"
                                files={version.files || []}
                                icon={<LucidePackage className="h-5 w-5" />}
                            />

                            {/* Resource Packs Section */}
                            <FileSection
                                title="Resource Packs"
                                description="Packs de recursos que se instalarán en la carpeta resourcepacks"
                                type="resourcepacks"
                                files={version.files || []}
                                icon={<LucideImage className="h-5 w-5" />}
                            />

                            {/* Config Section */}
                            <FileSection
                                title="Config"
                                description="Archivos de configuración que se instalarán en la carpeta config"
                                type="config"
                                files={version.files || []}
                                icon={<LucideSettings className="h-5 w-5" />}
                            />

                            {/* Shader Packs Section */}
                            <FileSection
                                title="Shader Packs"
                                description="Packs de shaders que se instalarán en la carpeta shaderpacks"
                                type="shaderpacks"
                                files={version.files || []}
                                icon={<LucidePalette className="h-5 w-5" />}
                            />

                            {/* Extras Section */}
                            <FileSection
                                title="Extras"
                                description="Archivos adicionales que se descomprimirán en .minecraft"
                                type="extras"
                                files={version.files || []}
                                icon={<LucideFolder className="h-5 w-5" />}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ModpackVersionDetailView;
