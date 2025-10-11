import fs from "fs";
import path from "path";
import { queue } from "./Queue";
import { ModpackFile, ModpackFileType } from "@/entities/ModpackFile";
import { ModpackVersionFile } from "@/entities/ModpackVersionFile";
import { In } from "typeorm";
import { sendProgressUpdate, sendCompletionUpdate, sendErrorUpdate } from "./realtime.service";
import JSZip from 'jszip';
import crypto from 'crypto';
import { batchUploadToR2 } from './r2UploadService';

export const ALLOWED_FILE_TYPES = ['mods', 'resourcepacks', 'config', 'shaderpacks', 'datapacks', 'extras'];

const TEMP_UPLOAD_DIR = path.join(__dirname, "../../tmp/uploads");
if (!fs.existsSync(TEMP_UPLOAD_DIR)) fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

type UploadSource = Buffer | File;

/**
 * Determina si el ZIP contiene un único directorio raíz que coincide con el tipo de archivo.
 * Si es así, devuelve esa ruta para que pueda ser eliminada del path final.
 * @param zip - La instancia de JSZip.
 * @param fileType - El tipo de archivo (ej: 'mods').
 * @returns El path base a eliminar (ej: 'mods/'), o una cadena vacía si no se debe eliminar nada.
 */
const determineBasePath = (zip: JSZip, fileType: string): string => {
  // 'extras' siempre se extrae tal cual
  if (fileType === 'extras') {
    return '';
  }

  const topLevelEntries = Object.values(zip.files).filter(file => !file.dir && !file.name.includes('/'));

  // Si hay archivos en la raíz del ZIP, no hay un directorio base que eliminar.
  if (topLevelEntries.length > 0) {
    return '';
  }

  // Obtenemos todos los directorios de primer nivel
  const rootDirs = new Set<string>();
  Object.values(zip.files).forEach(file => {
    if (!file.dir) {
      const parts = file.name.split('/');
      if (parts.length > 1) {
        rootDirs.add(parts[0]);
      }
    }
  });

  // Si hay más de un directorio en la raíz, o ninguno, no hacemos nada.
  // También comprobamos si el nombre del único directorio raíz coincide con el fileType.
  if (rootDirs.size === 1) {
    const singleRootDir = rootDirs.values().next().value;
    if (singleRootDir?.toLowerCase() === fileType.toLowerCase()) {
      console.log(`Se detectó un directorio raíz coincidente: '${singleRootDir}'. Se eliminará del path final.`);
      return `${singleRootDir}/`; // Retornamos el prefijo a eliminar, ej: "mods/"
    }
  }

  return '';
};


export const processModpackFileUpload = async (
  source: UploadSource,
  filename: string,
  modpackId: string,
  versionId: string,
  fileType: (typeof ALLOWED_FILE_TYPES)[number]
) => {
  if (!ALLOWED_FILE_TYPES.includes(fileType)) {
    throw new Error(`Tipo de archivo no permitido: ${fileType}`);
  }

  const buffer: Buffer =
    source instanceof Buffer
      ? source
      : (typeof File !== "undefined" && source instanceof File)
        ? Buffer.from(await source.arrayBuffer())
        : (() => { throw new Error("El tipo de 'source' no es soportado."); })();

  const tempPath = path.join(TEMP_UPLOAD_DIR, `${Date.now()}-${filename}`);
  fs.writeFileSync(tempPath, buffer);
  console.log(`Archivo guardado temporalmente: ${tempPath}`);

  const task = async () => {
    try {
      console.log(`Procesando ${fileType} para modpack ${modpackId}...`);
      sendProgressUpdate(modpackId, versionId, `Iniciando procesamiento de ${fileType}`, { category: fileType, percent: 0 });

      // Eliminar relaciones existentes para esta versión y tipo de archivo
      await ModpackVersionFile.delete({ modpackVersionId: versionId, fileType: fileType as ModpackFileType });
      sendProgressUpdate(modpackId, versionId, `Limpiando registros antiguos`, { category: fileType, percent: 5 });

      const zip = await JSZip.loadAsync(buffer);

      // Determinar si hay que eliminar un directorio base (ej. una carpeta 'mods' dentro de mods.zip)
      const basePathToStrip = determineBasePath(zip, fileType);

      const fileDbEntries: { path: string; hash: string; size: number }[] = [];
      const uniqueUploads = new Map<string, { key: string; body: Buffer; contentType: string }>();

      sendProgressUpdate(modpackId, versionId, `Procesando archivos desde ZIP`, { category: fileType, percent: 10 });

      const filesToProcess = Object.values(zip.files).filter(file => !file.dir);

      for (const file of filesToProcess) {
        const fileBuffer = await file.async('nodebuffer');

        // OPTIMIZACIÓN: Calcular hash directamente desde el buffer en memoria
        const hash = crypto.createHash('sha1').update(fileBuffer).digest('hex');

        // LÓGICA DE RUTAS: Eliminar el prefijo si es necesario y añadir el de la categoría
        let finalPath = file.name;
        if (basePathToStrip && finalPath.startsWith(basePathToStrip)) {
          finalPath = finalPath.substring(basePathToStrip.length);
        }

        // 'extras' no lleva prefijo, los demás sí.
        const dbPath = fileType === 'extras' ? finalPath : path.join(fileType, finalPath).replace(/\\/g, '/');

        // Ignorar archivos vacíos resultantes de la eliminación del path (ej. el propio directorio)
        if (!dbPath) continue;

        fileDbEntries.push({ path: dbPath, hash, size: fileBuffer.length });

        // Preparar para subida a R2, evitando duplicados por hash
        if (!uniqueUploads.has(hash)) {
          const hashKey = `${hash.substring(0, 2)}/${hash.substring(2, 4)}/${hash}`;
          uniqueUploads.set(hash, {
            key: `resources/files/${hashKey}`,
            body: fileBuffer,
            contentType: "application/octet-stream",
          });
        }
      }

      sendProgressUpdate(modpackId, versionId, `Subiendo ${uniqueUploads.size} archivos únicos`, { category: fileType, percent: 40 });

      const uploadPromises = Array.from(uniqueUploads.values());
      try {
        await batchUploadToR2(uploadPromises, 5); // 5 subidas concurrentes
        console.log(`Subidos ${uploadPromises.length} archivos únicos a R2 (${fileDbEntries.length - uploadPromises.length} duplicados omitidos).`);
      } catch (uploadError) {
        console.error(`Error subiendo archivos a R2:`, uploadError);
        throw new Error(`Fallo al subir archivos: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
      }

      // OPTIMIZACIÓN: Lógica de base de datos en lote
      sendProgressUpdate(modpackId, versionId, `Actualizando base de datos`, { category: fileType, percent: 85 });

      const allHashes = fileDbEntries.map(fe => fe.hash);
      const existingFiles = await ModpackFile.find({ where: { hash: In(allHashes) } });
      const existingHashes = new Set(existingFiles.map(ef => ef.hash));

      // 1. Identificar y guardar solo los ModpackFile que son nuevos
      const newModpackFileEntities = fileDbEntries
        .filter(fe => !existingHashes.has(fe.hash))
        // Evitar duplicados en el lote de nuevos archivos
        .filter((fe, index, self) => self.findIndex(t => t.hash === fe.hash) === index)
        .map(fe => ModpackFile.create({ hash: fe.hash, size: fe.size, type: fileType as ModpackFileType }));

      if (newModpackFileEntities.length > 0) {
        await ModpackFile.save(newModpackFileEntities);
        console.log(`Guardados ${newModpackFileEntities.length} nuevos registros en ModpackFile.`);
      }

      // 2. Crear todas las entradas de relación ModpackVersionFile
      const newVersionFileEntries = fileDbEntries.map(fe =>
        ModpackVersionFile.create({
          modpackVersionId: versionId,
          fileHash: fe.hash,
          path: fe.path,
          fileType: fileType as ModpackFileType,
        })
      );

      // 3. Guardar todas las relaciones en una sola operación
      if (newVersionFileEntries.length > 0) {
        await ModpackVersionFile.save(newVersionFileEntries);
        console.log(`Guardadas ${newVersionFileEntries.length} relaciones en ModpackVersionFile.`);
      }

      sendProgressUpdate(modpackId, versionId, `Proceso finalizado`, { category: fileType, percent: 95 });
      console.log(`Hashes generados para ${fileType}:`);
      console.table(fileDbEntries.map(fe => ({ path: fe.path, hash: fe.hash.substring(0, 12) })));

      sendCompletionUpdate(modpackId, versionId, `Procesamiento completo para ${fileType}`);

    } catch (error) {
      console.error(`Error procesando ${fileType} para modpack ${modpackId}:`, error);
      sendErrorUpdate(modpackId, versionId, `Error procesando ${fileType}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Limpiar el archivo ZIP temporal inicial
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
        console.log(`Archivo temporal eliminado: ${tempPath}`);
      }
    }
  };

  const { position, estimatedTime } = queue.add(task, `${modpackId}-${fileType}`);

  return {
    message: `Archivo recibido. Procesando en segundo plano. Posición en cola: ${position}. ${estimatedTime}`,
    tempPath,
  };
};