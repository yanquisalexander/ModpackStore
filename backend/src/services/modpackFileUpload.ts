import fs from "fs";
import path from "path";
import { queue } from "./Queue";
import { ModpackFile, ModpackFileType } from "@/entities/ModpackFile";
import { ModpackVersionFile } from "@/entities/ModpackVersionFile";
import { In } from "typeorm";
import { sendProgressUpdate, sendCompletionUpdate, sendErrorUpdate } from "./realtime.service";
import crypto from 'crypto';
import { batchUploadToR2 } from './r2UploadService';
import { path7x } from '7zip-bin';
import { execSync } from 'child_process';
import { Readable } from "stream";

export const ALLOWED_FILE_TYPES = ['mods', 'resourcepacks', 'config', 'shaderpacks', 'datapacks', 'extras'];
export const ALLOWED_ARCHIVE_EXTENSIONS = ['.zip', '.rar', '.7z'];

const TEMP_UPLOAD_DIR = path.join(__dirname, "../../tmp/uploads");
if (!fs.existsSync(TEMP_UPLOAD_DIR)) fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

type UploadSource = Buffer | File;

/**
 * Calcula el hash SHA1 de un archivo de forma eficiente usando streams.
 */
const calculateFileHash = (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
};

/**
 * Determina si el directorio extraído contiene un único directorio raíz que coincide con el tipo de archivo.
 */
const determineBasePathFromDir = (extractDir: string, fileType: string): string => {
  if (fileType === 'extras') return '';

  const entries = fs.readdirSync(extractDir, { withFileTypes: true });

  // Si hay más de un elemento en la raíz, o si el único elemento no es un directorio, no hay base path.
  // Pero espera, puede haber carpetas ocultas o archivos de sistema como .DS_Store.
  const visibleEntries = entries.filter(e => !e.name.startsWith('.'));

  if (visibleEntries.length === 1 && visibleEntries[0].isDirectory()) {
    const dirName = visibleEntries[0].name;
    if (dirName.toLowerCase() === fileType.toLowerCase()) {
      console.log(`Se detectó un directorio raíz coincidente: '${dirName}'. Se eliminará del path final.`);
      return `${dirName}/`;
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
 * Usa 7-Zip para todos los formatos por eficiencia de memoria.
 */
const extractArchive = async (
  archivePath: string,
  extractDir: string,
  archiveType: 'zip' | 'rar' | '7z'
): Promise<void> => {
  const sevenZipPath = path7x;
  const extractCommand = `"${sevenZipPath}" x "${archivePath}" -o"${extractDir}" -y`;

  try {
    execSync(extractCommand, { stdio: 'pipe' });
  } catch (error) {
    throw new Error(`Error extracting ${archiveType} file: ${error instanceof Error ? error.message : String(error)}`);
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

  const tempPath = path.join(TEMP_UPLOAD_DIR, `${Date.now()}-${filename}`);
  const extractDir = path.join(TEMP_UPLOAD_DIR, `extract-${Date.now()}`);

  if (source instanceof Buffer) {
    fs.writeFileSync(tempPath, source);
  } else if (typeof File !== "undefined" && source instanceof File) {
    // Optimización: Stream del archivo a disco para evitar cargar todo el ZIP en memoria
    const writeStream = fs.createWriteStream(tempPath);
    const webStream = source.stream();
    const nodeStream = Readable.fromWeb(webStream as any);

    await new Promise<void>((resolve, reject) => {
      nodeStream.pipe(writeStream);
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
      nodeStream.on('error', reject);
    });
  } else {
    throw new Error("El tipo de 'source' no es soportado.");
  }

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

      // Extraer el archivo a disco
      await extractArchive(tempPath, extractDir, archiveType);

      // Determinar si hay que eliminar un directorio base
      const basePathToStrip = determineBasePathFromDir(extractDir, fileType);

      const fileDbEntries: { path: string; hash: string; size: number }[] = [];
      const uniqueUploads = new Map<string, { key: string; fullPath: string; contentType: string }>();

      sendProgressUpdate(modpackId, versionId, `Procesando archivos desde ${archiveType.toUpperCase()}`, { category: fileType, percent: 10 });

      // Procesar recursivamente el directorio extraído
      const processDirectory = async (dir: string, currentBasePath: string = "") => {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          const relativePath = path.join(currentBasePath, item.name).replace(/\\/g, '/');

          if (item.isDirectory()) {
            await processDirectory(fullPath, relativePath + "/");
          } else {
            // Calcular hash y tamaño desde el archivo en disco
            const hash = await calculateFileHash(fullPath);
            const size = fs.statSync(fullPath).size;

            // LÓGICA DE RUTAS: Eliminar el prefijo si es necesario y añadir el de la categoría
            let finalPath = relativePath;
            if (basePathToStrip && finalPath.startsWith(basePathToStrip)) {
              finalPath = finalPath.substring(basePathToStrip.length);
            }

            // 'extras' no lleva prefijo, los demás sí.
            const dbPath = fileType === 'extras' ? finalPath : path.join(fileType, finalPath).replace(/\\/g, '/');

            // Ignorar archivos vacíos resultantes de la eliminación del path
            if (!dbPath) continue;

            fileDbEntries.push({ path: dbPath, hash, size });

            // Preparar para subida a R2, evitando duplicados por hash
            if (!uniqueUploads.has(hash)) {
              const hashKey = `${hash.substring(0, 2)}/${hash.substring(2, 4)}/${hash}`;
              uniqueUploads.set(hash, {
                key: `resources/files/${hashKey}`,
                fullPath: fullPath,
                contentType: "application/octet-stream",
              });
            }
          }
        }
      };

      await processDirectory(extractDir);

      sendProgressUpdate(modpackId, versionId, `Subiendo ${uniqueUploads.size} archivos únicos`, { category: fileType, percent: 40 });

      const uploadPromises = Array.from(uniqueUploads.values()).map(upload => ({
        key: upload.key,
        body: fs.createReadStream(upload.fullPath),
        contentType: upload.contentType,
      }));

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