/**
 * EJEMPLOS DE USO - Sistema de Upload con Uppy
 * 
 * Este archivo muestra ejemplos de cómo usar el nuevo sistema de upload
 * basado en Uppy. NO es código de producción, solo ejemplos de referencia.
 */

import { uploadFileWithUppy } from '@/utils/uppyUpload';
import { useUppyUpload } from '@/hooks/useUppyUpload';
import { useFileUpload } from '@/hooks/useFileUpload';

// ============================================================================
// EJEMPLO 1: Upload Simple con uploadFileWithUppy (recomendado para la mayoría de casos)
// ============================================================================

async function ejemploUploadSimple() {
    const file = new File(['contenido'], 'archivo.zip');
    
    try {
        await uploadFileWithUppy({
            file,
            endpoint: '/api/upload',
            headers: {
                'Authorization': 'Bearer mi-token'
            },
            fieldName: 'file',
            formData: {
                visibility: 'public',
                category: 'modpack'
            },
            onProgress: (progress) => {
                console.log(`Progreso: ${progress}%`);
                // Actualizar UI con setProgress(progress)
            },
            onSuccess: (response) => {
                console.log('Upload exitoso:', response);
                // toast.success('Archivo subido correctamente');
            },
            onError: (error) => {
                console.error('Error en upload:', error);
                // toast.error(error.message);
            }
        });
    } catch (error) {
        console.error('Error:', error);
    }
}

// ============================================================================
// EJEMPLO 2: Uso del hook useUppyUpload (para componentes reutilizables)
// ============================================================================

function ComponenteConUpload() {
    const uppyUpload = useUppyUpload({
        endpoint: '/api/upload',
        headers: { 'Authorization': 'Bearer token' },
        fieldName: 'file',
        allowedFileTypes: ['.zip', '.jar'],
        maxFileSize: 100 * 1024 * 1024, // 100MB
        onProgress: (progress) => {
            console.log(`Progreso: ${progress}%`);
        },
        onSuccess: (response) => {
            console.log('Éxito:', response);
        },
        onError: (error) => {
            console.error('Error:', error);
        }
    });

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            uppyUpload.addFile(file);
            await uppyUpload.upload();
        } catch (error) {
            console.error('Error:', error);
        }
    };

    return (
        <div>
            <input type="file" onChange={handleFileSelect} />
            {uppyUpload.isUploading && (
                <div>Subiendo... {uppyUpload.progress}%</div>
            )}
        </div>
    );
}

// ============================================================================
// EJEMPLO 3: Hook useFileUpload integrado con Uppy (backward compatible)
// ============================================================================

function ComponenteConFileUpload() {
    const {
        file,
        preview,
        progress,
        isUploading,
        error,
        selectFile,
        upload,
        reset
    } = useFileUpload({
        acceptedTypes: ['image/*'],
        maxSize: 5 * 1024 * 1024, // 5MB
        endpoint: '/api/upload', // ← Nuevo: activa Uppy
        headers: { 'Authorization': 'Bearer token' },
        fieldName: 'image',
        onUploadSuccess: (response) => {
            console.log('Imagen subida:', response);
        },
        onUploadError: (error) => {
            console.error('Error:', error);
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] || null;
        selectFile(selectedFile);
    };

    const handleUpload = async () => {
        if (!file) return;
        
        try {
            await upload();
            console.log('Upload completado');
        } catch (error) {
            console.error('Error en upload:', error);
        }
    };

    return (
        <div>
            <input type="file" accept="image/*" onChange={handleFileChange} />
            
            {file && (
                <>
                    <p>Archivo: {file.name}</p>
                    {preview && <img src={preview} alt="Preview" />}
                    <button onClick={handleUpload} disabled={isUploading}>
                        {isUploading ? 'Subiendo...' : 'Subir'}
                    </button>
                </>
            )}
            
            {isUploading && (
                <div>
                    <progress value={progress} max={100} />
                    <span>{progress}%</span>
                </div>
            )}
            
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    );
}

// ============================================================================
// EJEMPLO 4: Upload de ModpackVersion (caso real del código)
// ============================================================================

async function ejemploUploadModpackVersion(
    file: File,
    publisherId: string,
    modpackId: string,
    versionId: string,
    type: string,
    accessToken: string
) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
        throw new Error('Solo se permiten archivos ZIP');
    }

    try {
        await uploadFileWithUppy({
            file,
            endpoint: `/api/creators/publishers/${publisherId}/modpacks/${modpackId}/versions/${versionId}/files/${type}`,
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            fieldName: 'file',
            onProgress: (progress) => {
                // setUploadDialog(prev => ({ ...prev, progress }));
                console.log(`Progreso: ${progress}%`);
            },
            onSuccess: (response) => {
                // toast.success('Archivo subido correctamente');
                // fetchVersionDetails();
                console.log('Éxito:', response);
            },
            onError: (error) => {
                // toast.error(error.message);
                console.error('Error:', error);
            }
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
}

// ============================================================================
// EJEMPLO 5: Importar Modpack desde CurseForge (caso real del código)
// ============================================================================

async function ejemploImportCurseForge(
    file: File,
    publisherId: string,
    accessToken: string,
    slug?: string,
    visibility: string = 'public',
    parallelDownloads: number = 5
) {
    const formDataFields: Record<string, string> = {
        visibility,
        parallelDownloads: parallelDownloads.toString(),
    };
    
    if (slug?.trim()) {
        formDataFields.slug = slug.trim();
    }

    try {
        const response = await uploadFileWithUppy({
            file,
            endpoint: `/api/creators/publishers/${publisherId}/modpacks/import/curseforge`,
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            fieldName: 'zipFile',
            formData: formDataFields,
            onProgress: (progress) => {
                console.log(`Subiendo archivo... ${progress}%`);
                // setProgress({ uploadProgress: progress, message: `Subiendo...` });
            },
            onSuccess: (response) => {
                console.log('Importación completada:', response);
                // toast.success('Modpack importado exitosamente');
            },
            onError: (error) => {
                console.error('Error en importación:', error);
                // toast.error('Error al importar modpack');
            }
        });
        
        return response;
    } catch (error) {
        console.error('Import error:', error);
        throw error;
    }
}

// ============================================================================
// CONFIGURACIÓN AVANZADA - Para futuras extensiones
// ============================================================================

/*
// REINTENTOS AUTOMÁTICOS
// Uppy maneja reintentos automáticamente en errores de red
// No requiere configuración adicional por defecto

// UPLOAD POR CHUNKS (para archivos muy grandes)
import AwsS3Multipart from '@uppy/aws-s3-multipart';

const uppy = new Uppy();
uppy.use(AwsS3Multipart, {
    companionUrl: '/api/companion',
    limit: 4, // número de partes a subir concurrentemente
});

// COMPRESIÓN DE IMÁGENES
import Compressor from '@uppy/compressor';

uppy.use(Compressor, {
    quality: 0.6,
    maxWidth: 2000,
    maxHeight: 2000,
});

// VALIDACIONES PERSONALIZADAS
const uppy = new Uppy({
    restrictions: {
        maxFileSize: 100 * 1024 * 1024,
        allowedFileTypes: ['.zip', '.jar'],
    },
    onBeforeFileAdded: (currentFile, files) => {
        // Validación custom
        if (currentFile.name.includes('invalid')) {
            return false;
        }
        return true;
    },
});

// CANCELACIÓN DE UPLOAD
uppy.on('upload-started', () => {
    // Guardar referencia para poder cancelar después
});

// Cancelar upload en progreso
uppy.cancelAll();
*/

export {
    ejemploUploadSimple,
    ComponenteConUpload,
    ComponenteConFileUpload,
    ejemploUploadModpackVersion,
    ejemploImportCurseForge
};
