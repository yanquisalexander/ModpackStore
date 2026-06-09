import { ModpackVersionFile } from "@/entities/ModpackVersionFile";
import { ModpackVersion } from "@/entities/ModpackVersion";
import { ModpackVersionStatus } from "@/types/enums";

/**
 * Resuelve los archivos de una versión de modpack filtrados por el entorno de destino.
 * 
 * @param modpackId - El ID del modpack.
 * @param target - El entorno de destino ('client' o 'server').
 * @param versionId - (Opcional) El ID de la versión específica. Si no se proporciona, usa la última versión publicada.
 * @returns Lista de archivos filtrados.
 */
export async function resolveModpackVersionFiles(
    modpackId: string,
    target: 'client' | 'server' | 'both' = 'both',
    versionId?: string
): Promise<ModpackVersionFile[]> {
    const whereCondition: any = { modpackId };

    if (versionId && versionId !== 'latest') {
        whereCondition.id = versionId;
    } else {
        whereCondition.status = ModpackVersionStatus.PUBLISHED;
    }

    const mpVersion = await ModpackVersion.findOne({
        where: whereCondition,
        relations: ['files', 'files.file'],
        order: (!versionId || versionId === 'latest') ? { releaseDate: 'DESC' } : undefined,
    });

    if (!mpVersion) {
        throw new Error("Modpack version not found");
    }

    let filteredFiles = mpVersion.files;
    if (target === 'client') {
        filteredFiles = mpVersion.files.filter(f => f.side !== 'server');
    } else if (target === 'server') {
        filteredFiles = mpVersion.files.filter(f => f.side !== 'client');
    }

    return filteredFiles;
}
