import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LucideArrowLeft, LucideEdit2, LucideSave, LucideUpload, LucideFile, LucideTrash2, LucideSend } from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINT } from '@/consts';
import { useAuthentication } from '@/stores/AuthContext';

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
    id: string;
    path: string;
    fileHash: string;
}

const ModpackVersionDetailView: React.FC = () => {
    console.log('Rendering ModpackVersionDetailView');
    const { orgId: publisherId, modpackId, versionId } = useParams<{
        orgId: string;
        modpackId: string;
        versionId: string;
    }>();

    console.log('Params:', { publisherId, modpackId, versionId });
    const navigate = useNavigate();
    const { sessionTokens } = useAuthentication();

    const [version, setVersion] = useState<ModpackVersion | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingChangelog, setEditingChangelog] = useState(false);
    const [changelog, setChangelog] = useState('');
    const [uploadingFile, setUploadingFile] = useState(false);
    const [publishing, setPublishing] = useState(false);

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
                throw new Error('Error al obtener detalles de la versión');
            }

            const data = await res.json();
            console.log('Version details fetched successfully:', data);
            setVersion(data.version);
            setChangelog(data.version.changelog || '');
        } catch (error) {
            console.error('Error fetching version details:', error);
            toast.error('Error al cargar los detalles de la versión');
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
                throw new Error('Error al actualizar el changelog');
            }

            setVersion({ ...version, changelog });
            setEditingChangelog(false);
            toast.success('Changelog actualizado correctamente');
        } catch (error) {
            console.error('Error updating changelog:', error);
            toast.error('Error al actualizar el changelog');
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

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploadingFile(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch(
                `${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}/files`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                    },
                    body: formData,
                }
            );

            if (!res.ok) {
                throw new Error('Error al subir el archivo');
            }

            toast.success('Archivo subido correctamente');
            fetchVersionDetails(); // Recargar los detalles para mostrar el nuevo archivo
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error('Error al subir el archivo');
        } finally {
            setUploadingFile(false);
        }
    };

    const deleteFile = async (fileId: string) => {
        try {
            const res = await fetch(
                `${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}/files/${fileId}`,
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
                        {version.status !== 'published' && (
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
                                        <p className="text-lg capitalize">{version.status}</p>
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
                                    {!editingChangelog && version.status !== 'published' ? (
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
                        {/* File Upload */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Archivos</CardTitle>
                                <CardDescription>
                                    Sube archivos relacionados con esta versión
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {version.status !== 'published' && (
                                        <div>
                                            <Input
                                                type="file"
                                                onChange={handleFileUpload}
                                                disabled={uploadingFile}
                                                className="hidden"
                                                id="file-upload"
                                            />
                                            <label htmlFor="file-upload">
                                                <Button
                                                    variant="outline"
                                                    className="w-full"
                                                    disabled={uploadingFile}
                                                    asChild
                                                >
                                                    <span>
                                                        <LucideUpload className="h-4 w-4 mr-2" />
                                                        {uploadingFile ? 'Subiendo...' : 'Subir Archivo'}
                                                    </span>
                                                </Button>
                                            </label>
                                        </div>
                                    )}

                                    {/* File List */}
                                    {version.files && version.files.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-medium text-gray-700">Archivos subidos:</h4>
                                            {version.files.map((file) => (
                                                <div
                                                    key={file.id}
                                                    className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                                                >
                                                    <div className="flex items-center space-x-2">
                                                        <LucideFile className="h-4 w-4 text-gray-500" />
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">
                                                                {file.path}
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                Hash: {file.fileHash.substring(0, 8)}...
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex space-x-2">
                                                        {version.status !== 'published' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => deleteFile(file.id)}
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
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModpackVersionDetailView;
