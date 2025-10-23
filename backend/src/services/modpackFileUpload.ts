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
import { path7x } from '7zip-bin';
import { execSync } from 'child_process';

export const ALLOWED_FILE_TYPES = ['mods', 'resourcepacks', 'config', 'shaderpacks', 'datapacks', 'extras'];
export const ALLOWED_ARCHIVE_EXTENSIONS = ['.zip', '.rar', '.7z'];

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

/**
 * Detecta el tipo de archivo basado en la extensión del nombre del archivo.
 * @param filename - El nombre del archivo.
 * @returns El tipo de archivo ('zip', 'rar', '7z') o null si no es soportado.
 */
const detectArchiveType = (filename: string): 'zip' | 'rar' | '7z' | null => {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.zip':
      return 'zip';
    case '.rar':
      return 'rar';
    case '.7z':
      return '7z';
    default:
      return null;
  }
};

/**
 * Extrae archivos de un archivo comprimido (ZIP, RAR, 7z) a un directorio temporal.
 * @param archivePath - Ruta al archivo comprimido.
 * @param extractDir - Directorio donde extraer los archivos.
 * @param archiveType - Tipo de archivo ('zip', 'rar', '7z').
 * @returns Array de objetos con información de los archivos extraídos.
 */
const extractArchive = async (
  archivePath: string,
  extractDir: string,
  archiveType: 'zip' | 'rar' | '7z'
): Promise<{ name: string; buffer: Buffer }[]> => {
  if (archiveType === 'zip') {
    // Usar JSZip para ZIP
    const buffer = fs.readFileSync(archivePath);
    const zip = await JSZip.loadAsync(buffer);
    const files: { name: string; buffer: Buffer }[] = [];

    for (const [name, file] of Object.entries(zip.files)) {
      if (!file.dir) {
        const buffer = await file.async('nodebuffer');
        files.push({ name, buffer });
      }
    }

    return files;
  } else {
    // Usar 7zip para RAR y 7z
    const sevenZipPath = path7x;
    const extractCommand = `"${sevenZipPath}" x "${archivePath}" -o"${extractDir}" -y`;

    try {
      execSync(extractCommand, { stdio: 'pipe' });
    } catch (error) {
      throw new Error(`Error extracting ${archiveType} file: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Leer todos los archivos extraídos
    const files: { name: string; buffer: Buffer }[] = [];
    const walkDir = (dir: string, basePath: string = '') => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.join(basePath, item).replace(/\\/g, '/');
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          walkDir(fullPath, relativePath);
        } else {
          const buffer = fs.readFileSync(fullPath);
          files.push({ name: relativePath, buffer });
        }
      }
    };

    walkDir(extractDir);
    return files;
  }
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
  const extractDir = path.join(TEMP_UPLOAD_DIR, `extract-${Date.now()}`);
  fs.writeFileSync(tempPath, buffer);
  console.log(`Archivo guardado temporalmente: ${tempPath}`);

  const task = async () => {
    try {
      console.log(`Procesando ${fileType} para modpack ${modpackId}...`);
      sendProgressUpdate(modpackId, versionId, `Iniciando procesamiento de ${fileType}`, { category: fileType, percent: 0 });

      // Eliminar relaciones existentes para esta versión y tipo de archivo
      await ModpackVersionFile.delete({ modpackVersionId: versionId, fileType: fileType as ModpackFileType });
      sendProgressUpdate(modpackId, versionId, `Limpiando registros antiguos`, { category: fileType, percent: 5 });

      // Detectar y extraer archivos según el tipo de archivo (ZIP, RAR, 7z)
      const archiveType = detectArchiveType(filename);
      if (!archiveType) {
        throw new Error(`Tipo de archivo no soportado para la extracción: ${filename}`);
      }

      // Crear directorio temporal para extracción
      if (!fs.existsSync(extractDir)) fs.mkdirSync(extractDir, { recursive: true });

      // Usar la función de extracción para obtener los archivos en un buffer
      const extractedFiles = await extractArchive(tempPath, extractDir, archiveType);

      // Determinar si hay que eliminar un directorio base (solo para ZIP)
      let basePathToStrip = '';
      if (archiveType === 'zip') {
        // Para ZIP, usar la lógica existente con JSZip
        const zipBuffer = fs.readFileSync(tempPath);
        const zip = await JSZip.loadAsync(zipBuffer);
        basePathToStrip = determineBasePath(zip, fileType);
      } else {
        // Para RAR/7z, lógica simplificada: si todos los archivos están en un directorio que coincide con fileType, eliminarlo
        const rootDirs = new Set<string>();
        extractedFiles.forEach(file => {
          const parts = file.name.split('/');
          if (parts.length > 1) {
            rootDirs.add(parts[0]);
          }
        });

        if (rootDirs.size === 1) {
          const singleRootDir = rootDirs.values().next().value;
          if (singleRootDir?.toLowerCase() === fileType.toLowerCase()) {
            basePathToStrip = `${singleRootDir}/`;
          }
        }
      }

      const fileDbEntries: { path: string; hash: string; size: number }[] = [];
      const uniqueUploads = new Map<string, { key: string; body: Buffer; contentType: string }>();

      sendProgressUpdate(modpackId, versionId, `Procesando archivos desde ${archiveType.toUpperCase()}`, { category: fileType, percent: 10 });

      // Procesar cada archivo extraído
      for (const file of extractedFiles) {
        const fileBuffer = file.buffer;

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
      // Limpiar el archivo temporal inicial y el directorio de extracción
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
        console.log(`Archivo temporal eliminado: ${tempPath}`);
      }
      if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true });
        console.log(`Directorio de extracción eliminado: ${extractDir}`);
      }
    }
  };

  const { position, estimatedTime } = queue.add(task, `${modpackId}-${fileType}`);

  return {
    message: `Archivo recibido. Procesando en segundo plano. Posición en cola: ${position}. ${estimatedTime}`,
    tempPath,
  };
};