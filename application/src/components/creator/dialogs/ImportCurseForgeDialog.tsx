import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { LucideUpload, LucideFile, LucideTrash2, LucidePackage, LucideCheck, LucideX, LucideLoader2 } from 'lucide-react';
import { useAuthentication } from "@/stores/AuthContext";
import { API_ENDPOINT } from "@/consts";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (result: any) => void;
    publisherId?: string;
}

interface ImportProgress {
    stage: 'uploading' | 'processing' | 'completed' | 'error';
    uploadProgress: number;
    message: string;
}

interface ImportResult {
    modpack: {
        id: string;
        name: string;
        version: string;
        slug: string;
    };
    stats: {
        totalMods: number;
        downloadedMods: number;
        failedMods: number;
        overrideFiles: number;
    };
    errors: string[];
    isNewModpack: boolean;
}

const ImportCurseForgeDialog: React.FC<Props> = ({ isOpen, onClose, onSuccess, publisherId }) => {
    const { sessionTokens } = useAuthentication();
    const [file, setFile] = useState<File | null>(null);
    const [slug, setSlug] = useState<string>('');
    const [visibility, setVisibility] = useState<string>('public');
    const [parallelDownloads, setParallelDownloads] = useState<number>(5);
    const [progress, setProgress] = useState<ImportProgress>({
        stage: 'uploading',
        uploadProgress: 0,
        message: ''
    });
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] || null;
        
        if (selectedFile) {
            // Validate file type
            if (!selectedFile.name.toLowerCase().endsWith('.zip')) {
                toast.error('Solo se permiten archivos ZIP de CurseForge');
                return;
            }
            
            // Validate file size (100MB limit)
            if (selectedFile.size > 100 * 1024 * 1024) {
                toast.error('El archivo es demasiado grande. Límite: 100MB');
                return;
            }
        }
        
        setFile(selectedFile);
        setResult(null);
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const resetForm = () => {
        setFile(null);
        setSlug('');
        setVisibility('public');
        setParallelDownloads(5);
        setProgress({
            stage: 'uploading',
            uploadProgress: 0,
            message: ''
        });
        setImporting(false);
        setResult(null);
    };

    const handleImport = useCallback(async () => {
        if (!file || !publisherId) {
            toast.error('Archivo y organización requeridos');
            return;
        }

        setImporting(true);
        setProgress({
            stage: 'uploading',
            uploadProgress: 0,
            message: 'Subiendo archivo ZIP...'
        });

        try {
            const formData = new FormData();
            formData.append('zipFile', file);
            if (slug.trim()) formData.append('slug', slug.trim());
            formData.append('visibility', visibility);
            formData.append('parallelDownloads', parallelDownloads.toString());

            const xhr = new XMLHttpRequest();

            // Handle upload progress
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const progressPercent = Math.round((event.loaded / event.total) * 100);
                    setProgress(prev => ({
                        ...prev,
                        uploadProgress: progressPercent,
                        message: `Subiendo archivo... ${progressPercent}%`
                    }));
                }
            });

            // Handle response
            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        setProgress({
                            stage: 'completed',
                            uploadProgress: 100,
                            message: 'Importación completada exitosamente'
                        });
                        
                        setResult({
                            ...response.data,
                            isNewModpack: !response.data.modpack.existingModpack
                        });
                        
                        toast.success('Modpack importado exitosamente desde CurseForge');
                        onSuccess?.(response.data);
                    } catch (parseError) {
                        console.error('Error parsing response:', parseError);
                        setProgress({
                            stage: 'error',
                            uploadProgress: 0,
                            message: 'Error al procesar la respuesta del servidor'
                        });
                        toast.error('Error al procesar la respuesta del servidor');
                    }
                } else {
                    try {
                        const errorResponse = JSON.parse(xhr.responseText);
                        const errorMessage = errorResponse.errors?.[0]?.detail || 
                                           errorResponse.message || 
                                           `Error ${xhr.status}: ${xhr.statusText}`;
                        
                        setProgress({
                            stage: 'error',
                            uploadProgress: 0,
                            message: errorMessage
                        });
                        toast.error('Error al importar modpack', { description: errorMessage });
                    } catch (parseError) {
                        setProgress({
                            stage: 'error',
                            uploadProgress: 0,
                            message: `Error ${xhr.status}: ${xhr.statusText}`
                        });
                        toast.error(`Error al importar modpack: ${xhr.status}`);
                    }
                }
                setImporting(false);
            });

            // Handle network errors
            xhr.addEventListener('error', () => {
                setProgress({
                    stage: 'error',
                    uploadProgress: 0,
                    message: 'Error de conexión al servidor'
                });
                toast.error('Error de conexión al servidor');
                setImporting(false);
            });

            // Start request
            xhr.open('POST', `${API_ENDPOINT}/creators/publishers/${publisherId}/modpacks/import/curseforge`);
            xhr.setRequestHeader('Authorization', `Bearer ${sessionTokens?.accessToken}`);
            
            setProgress(prev => ({
                ...prev,
                stage: 'processing',
                message: 'Procesando importación...'
            }));
            
            xhr.send(formData);

        } catch (error) {
            console.error('Import error:', error);
            setProgress({
                stage: 'error',
                uploadProgress: 0,
                message: 'Error inesperado durante la importación'
            });
            toast.error('Error inesperado durante la importación');
            setImporting(false);
        }
    }, [file, publisherId, slug, visibility, parallelDownloads, sessionTokens?.accessToken, onSuccess]);

    const handleClose = () => {
        if (importing) {
            toast.error('No se puede cerrar durante la importación');
            return;
        }
        resetForm();
        onClose();
    };

    const renderProgressStage = () => {
        if (!importing && !result) return null;

        if (result) {
            return (
                <div className="space-y-4">
                    <div className="flex items-center space-x-2 text-green-600">
                        <LucideCheck className="h-5 w-5" />
                        <span className="font-medium">Importación completada</span>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-semibold text-green-800 mb-2">
                            {result.isNewModpack ? '🎉 Nuevo modpack creado' : '📦 Nueva versión creada'}
                        </h4>
                        <div className="text-sm text-green-700 space-y-1">
                            <p><strong>Nombre:</strong> {result.modpack.name}</p>
                            <p><strong>Versión:</strong> {result.modpack.version}</p>
                            <p><strong>Slug:</strong> {result.modpack.slug}</p>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-800 mb-2">📊 Estadísticas de importación</h4>
                        <div className="text-sm text-blue-700 grid grid-cols-2 gap-2">
                            <p><strong>Total de mods:</strong> {result.stats.totalMods}</p>
                            <p><strong>Descargados:</strong> {result.stats.downloadedMods}</p>
                            <p><strong>Fallidos:</strong> {result.stats.failedMods}</p>
                            <p><strong>Archivos override:</strong> {result.stats.overrideFiles}</p>
                        </div>
                    </div>

                    {result.errors.length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Advertencias</h4>
                            <ul className="text-sm text-yellow-700 space-y-1">
                                {result.errors.map((error, index) => (
                                    <li key={index}>• {error}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div className="flex items-center space-x-2">
                    {progress.stage === 'error' ? (
                        <LucideX className="h-5 w-5 text-red-500" />
                    ) : (
                        <LucideLoader2 className="h-5 w-5 animate-spin text-blue-500" />
                    )}
                    <span className={`font-medium ${progress.stage === 'error' ? 'text-red-600' : 'text-blue-600'}`}>
                        {progress.message}
                    </span>
                </div>

                {progress.stage === 'uploading' && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Progreso de subida</span>
                            <span>{progress.uploadProgress}%</span>
                        </div>
                        <Progress value={progress.uploadProgress} className="w-full" />
                    </div>
                )}

                {progress.stage === 'processing' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-700">
                            El servidor está procesando el archivo ZIP de CurseForge. Esto puede tomar varios minutos 
                            dependiendo del tamaño del modpack y la cantidad de mods a descargar.
                        </p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                        <LucidePackage className="h-5 w-5 text-orange-500" />
                        <span>Importar desde CurseForge</span>
                    </DialogTitle>
                    <DialogDescription>
                        Sube un archivo ZIP exportado desde CurseForge para crear un nuevo modpack o una nueva versión.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {!importing && !result && (
                        <>
                            {/* File Upload Section */}
                            {!file ? (
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                                    <Input
                                        type="file"
                                        accept=".zip"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                        id="curseforge-file-upload"
                                    />
                                    <label htmlFor="curseforge-file-upload" className="cursor-pointer">
                                        <LucideUpload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                        <p className="text-sm text-gray-600">
                                            Haz clic para seleccionar un archivo ZIP de CurseForge
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Máximo 100MB
                                        </p>
                                    </label>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                                        <LucideFile className="h-8 w-8 text-gray-500" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900">
                                                {file.name}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {formatFileSize(file.size)}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setFile(null)}
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            <LucideTrash2 className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* Import Options */}
                                    <div className="space-y-3 border-t pt-3">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 block mb-1">
                                                Slug personalizado (opcional)
                                            </label>
                                            <Input
                                                value={slug}
                                                onChange={(e) => setSlug(e.target.value)}
                                                placeholder="mi-modpack-personalizado"
                                                className="text-sm"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                Si se deja vacío, se generará automáticamente desde el nombre del modpack
                                            </p>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-gray-700 block mb-1">
                                                Visibilidad
                                            </label>
                                            <Select value={visibility} onValueChange={setVisibility}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="public">Público</SelectItem>
                                                    <SelectItem value="private">Privado</SelectItem>
                                                    <SelectItem value="unlisted">No listado</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-gray-700 block mb-1">
                                                Descargas paralelas ({parallelDownloads})
                                            </label>
                                            <Input
                                                type="range"
                                                min="1"
                                                max="10"
                                                value={parallelDownloads}
                                                onChange={(e) => setParallelDownloads(parseInt(e.target.value))}
                                                className="w-full"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                Número de mods a descargar simultáneamente (1-10)
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Progress Section */}
                    {renderProgressStage()}
                </div>

                <DialogFooter>
                    {result ? (
                        <Button onClick={handleClose}>
                            Cerrar
                        </Button>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleClose}
                                disabled={importing}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={!file || importing}
                                className="min-w-[120px]"
                            >
                                {importing ? (
                                    <>
                                        <LucideLoader2 className="h-4 w-4 animate-spin mr-2" />
                                        Importando...
                                    </>
                                ) : (
                                    'Importar modpack'
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ImportCurseForgeDialog;