import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { LucideUpload, LucideFile, LucideTrash2, LucidePackage, LucideCheck, LucideX, LucideLoader2 } from 'lucide-react';
import { useAuthentication } from "@/stores/AuthContext";
import { API_ENDPOINT } from "@/consts";
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import JSZip from 'jszip';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (result: any) => void;
    publisherId?: string;
}

interface ImportProgress {
    stage: 'reading' | 'uploading' | 'confirming' | 'completed' | 'error';
    uploadProgress: number;
    message: string;
}

interface ImportResult {
    modpack: {
        id: string;
        name: string;
        slug: string;
    };
    version: {
        id: string;
        version: string;
        mcVersion: string;
    };
    jobId: string;
}

const ImportCurseForgeDialog: React.FC<Props> = ({ isOpen, onClose, onSuccess, publisherId }) => {
    const { sessionTokens } = useAuthentication();
    const [file, setFile] = useState<File | null>(null);
    const [slug, setSlug] = useState<string>('');
    const [progress, setProgress] = useState<ImportProgress>({
        stage: 'reading',
        uploadProgress: 0,
        message: ''
    });
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] || null;

        if (selectedFile) {
            if (!selectedFile.name.toLowerCase().endsWith('.zip')) {
                toast.error('Solo se permiten archivos ZIP de CurseForge');
                return;
            }

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
        setProgress({
            stage: 'reading',
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

        try {
            // Step 0: Read manifest.json from inside the ZIP
            setProgress({
                stage: 'reading',
                uploadProgress: 0,
                message: 'Leyendo manifest.json del ZIP...'
            });

            const zip = await JSZip.loadAsync(file);
            const manifestFile = zip.file('manifest.json');
            if (!manifestFile) {
                throw new Error('No se encontró manifest.json en el archivo ZIP. Asegúrese de que es un modpack CurseForge válido.');
            }
            const manifestText = await manifestFile.async('text');
            let manifest: any;
            try {
                manifest = JSON.parse(manifestText);
            } catch {
                throw new Error('El manifest.json no contiene JSON válido.');
            }

            // Step 1: Get presigned upload URL
            setProgress({
                stage: 'uploading',
                uploadProgress: 0,
                message: 'Obteniendo URL de subida...'
            });

            const uploadUrlResponse = await fetchWithAuth(
                `${API_ENDPOINT}/creators/${publisherId}/modpacks/import/curseforge/upload-url`,
                { method: 'POST' }
            );
            if (!uploadUrlResponse.ok) {
                const errorData = await uploadUrlResponse.json().catch(() => ({ message: 'Error al obtener URL de subida' }));
                throw new Error(errorData.message || `HTTP ${uploadUrlResponse.status}`);
            }
            const { uploadUrl, zipR2Key } = await uploadUrlResponse.json();

            // Step 2: Upload ZIP directly to R2 via presigned URL
            setProgress({
                stage: 'uploading',
                uploadProgress: 0,
                message: 'Subiendo archivo ZIP...'
            });

            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', uploadUrl);
                xhr.setRequestHeader('Content-Type', 'application/zip');

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const pct = Math.round((e.loaded / e.total) * 100);
                        setProgress(prev => ({
                            ...prev,
                            uploadProgress: pct,
                            message: `Subiendo archivo ZIP... ${pct}%`
                        }));
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        reject(new Error(`Error al subir el archivo: HTTP ${xhr.status}`));
                    }
                };

                xhr.onerror = () => reject(new Error('Error de red al subir el archivo'));
                xhr.send(file);
            });

            // Step 3: Confirm import with manifest + zipR2Key
            setProgress({
                stage: 'confirming',
                uploadProgress: 100,
                message: 'Confirmando importación con el servidor...'
            });

            const body: Record<string, any> = { zipR2Key, manifest };
            if (slug.trim()) {
                body.slug = slug.trim();
            }

            const confirmResponse = await fetchWithAuth(
                `${API_ENDPOINT}/creators/${publisherId}/modpacks/import/curseforge`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }
            );

            if (!confirmResponse.ok) {
                const errorData = await confirmResponse.json().catch(() => ({ message: 'Error al confirmar la importación' }));
                throw new Error(errorData.message || `HTTP ${confirmResponse.status}`);
            }

            const responseData = await confirmResponse.json();

            setProgress({
                stage: 'completed',
                uploadProgress: 100,
                message: 'Importación completada exitosamente'
            });

            const importResult: ImportResult = responseData.data;
            setResult(importResult);
            toast.success('Modpack importado exitosamente desde CurseForge');
            onSuccess?.(importResult);

        } catch (error: any) {
            console.error('Import error:', error);
            const errorMessage = error?.message || 'Error inesperado durante la importación';
            setProgress({
                stage: 'error',
                uploadProgress: 0,
                message: errorMessage
            });
            toast.error('Error al importar modpack', { description: errorMessage });
            setImporting(false);
        }
    }, [file, publisherId, slug, sessionTokens?.accessToken, onSuccess]);

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
                            Modpack importado
                        </h4>
                        <div className="text-sm text-green-700 space-y-1">
                            <p><strong>Nombre:</strong> {result.modpack.name}</p>
                            <p><strong>Versión:</strong> {result.version.version}</p>
                            <p><strong>Slug:</strong> {result.modpack.slug}</p>
                            <p><strong>Minecraft:</strong> {result.version.mcVersion}</p>
                            <p><strong>Job ID:</strong> <code className="text-xs bg-green-100 px-1 rounded">{result.jobId}</code></p>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-700">
                            El servidor está procesando los mods del modpack. Esto puede tomar varios minutos.
                        </p>
                    </div>
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

                {(progress.stage === 'uploading' || progress.stage === 'confirming') && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Progreso de subida</span>
                            <span>{progress.uploadProgress}%</span>
                        </div>
                        <Progress value={progress.uploadProgress} className="w-full" />
                    </div>
                )}

                {progress.stage === 'confirming' && (
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
                        Sube un archivo ZIP exportado desde CurseForge para crear un nuevo modpack.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {!importing && !result && (
                        <>
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
                                    </div>
                                </div>
                            )}
                        </>
                    )}

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
