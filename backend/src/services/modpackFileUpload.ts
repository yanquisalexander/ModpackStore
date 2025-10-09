import fs from "fs";
import path from "path";
import { queue } from "./Queue";
import { ModpackFile, ModpackFileType } from "@/entities/ModpackFile";
import { ModpackVersionFile } from "@/entities/ModpackVersionFile";
import { In } from "typeorm";
import { sendProgressUpdate, sendCompletionUpdate, sendErrorUpdate } from "./realtime.service";
import JSZip from 'jszip';
import crypto from 'crypto';
import { uploadToR2, batchUploadToR2 } from './r2UploadService';

export const ALLOWED_FILE_TYPES = ['mods', 'resourcepacks', 'config', 'shaderpacks', 'datapacks', 'extras'];

const TEMP_UPLOAD_DIR = path.join(__dirname, "../../tmp/uploads");
if (!fs.existsSync(TEMP_UPLOAD_DIR)) fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

type UploadSource = Buffer | File;

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

  // Convertir File a Buffer si es necesario
  const buffer: Buffer =
    source instanceof Buffer
      ? source
      : (typeof File !== "undefined" && source instanceof File)
        ? Buffer.from(await source.arrayBuffer())
        : (() => { throw new Error("El tipo de 'source' no es soportado."); })();

  // Guardar temporalmente el archivo
  const tempPath = path.join(TEMP_UPLOAD_DIR, `${Date.now()}-${filename}`);
  fs.writeFileSync(tempPath, buffer);
  console.log(`Archivo guardado temporalmente: ${tempPath}`);

  // Función que se delega a la queue
  const task = async () => {
    try {
      console.log(`Procesando ${fileType} para modpack ${modpackId}...`);
      sendProgressUpdate(modpackId, versionId, `Iniciando procesamiento de ${fileType}`, { category: fileType, percent: 0 });

      // Eliminar todos los ModpackVersionFile existentes para esta versión y tipo
      await ModpackVersionFile.createQueryBuilder()
        .delete()
        .from(ModpackVersionFile)
        .where(`modpackVersionId = :versionId AND fileHash IN (
          SELECT hash FROM modpack_files WHERE type = :fileType
        )`, { versionId, fileType })
        .execute();

      // Load entire ZIP file into memory
      const zip = await JSZip.loadAsync(buffer);

      // Create temporary directory for extraction
      const tempDir = path.join(TEMP_UPLOAD_DIR, `${modpackId}-${versionId}-${fileType}`);
      fs.mkdirSync(tempDir, { recursive: true });

      const fileEntries: { path: string; hash: string; size: number }[] = [];
      const uploadPromises: { key: string; body: Buffer; contentType: string }[] = [];

      sendProgressUpdate(modpackId, versionId, `Extrayendo archivos del ZIP`, { category: fileType, percent: 10 });

      for (const [fileName, file] of Object.entries(zip.files)) {
        if (!file.dir) {
          const fileBuffer = await file.async('nodebuffer');
          const filePath = path.join(tempDir, fileName);

          // Ensure parent directories exist
          const dirPath = path.dirname(filePath);
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }

          // Extract file to disk
          fs.writeFileSync(filePath, fileBuffer);

          // Calculate hash by reading from disk
          const hash = crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex');

          fileEntries.push({ path: fileName, hash, size: fileBuffer.length });

          // Prepare for batch upload using hash-based keys
          const hashKey = `${hash.substring(0, 2)}/${hash.substring(2, 4)}/${hash}`;
          uploadPromises.push({
            key: `resources/files/${hashKey}`,
            body: fileBuffer,
            contentType: "application/octet-stream"
          });
        }
      }

      sendProgressUpdate(modpackId, versionId, `Subiendo archivos a almacenamiento`, { category: fileType, percent: 50 });

      // Batch upload all files to R2 with concurrency control
      try {
        await batchUploadToR2(uploadPromises, 5); // Upload up to 5 files concurrently
        console.log(`Successfully uploaded ${fileEntries.length} files to R2`);
      } catch (uploadError) {
        console.error(`Error uploading files to R2:`, uploadError);
        throw new Error(`Failed to upload files: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
      }

      // Clear buffers from memory after upload
      fileEntries.forEach(fe => {
        // Note: Buffers will be garbage collected automatically
      });

      // After processing, check which files already exist to avoid re-uploading (though we already uploaded, this is for DB logic)
      const allHashes = fileEntries.map(fe => fe.hash);
      const existingFiles = await ModpackFile.find({ where: { hash: In(allHashes) } });
      const existingHashes = new Set(existingFiles.map(ef => ef.hash));
      const newFileCount = fileEntries.length - existingHashes.size;

      console.log(`Uploaded ${newFileCount} new files, ${existingHashes.size} already existed`);

      sendProgressUpdate(modpackId, versionId, `Archivos procesados: ${fileEntries.length} archivos`, { category: fileType, percent: 85 });

      // Save to DB
      const savePromises = fileEntries.map(async (fe) => {
        try {
          // Find or create ModpackFile
          let modpackFile = await ModpackFile.findOne({ where: { hash: fe.hash } });
          if (!modpackFile) {
            modpackFile = new ModpackFile();
            modpackFile.hash = fe.hash;
            modpackFile.size = fe.size;
            modpackFile.type = fileType as ModpackFileType;
            await modpackFile.save();
          }

          // Create ModpackVersionFile entry for all files, even if they already exist
          const modpackVersionFile = new ModpackVersionFile();
          modpackVersionFile.modpackVersionId = versionId;
          modpackVersionFile.fileHash = fe.hash;
          modpackVersionFile.path = fe.path;
          modpackVersionFile.file = modpackFile; // Associate with the ModpackFile
          await modpackVersionFile.save();
        } catch (error) {
          // Ignore duplicate key errors for both ModpackFile and ModpackVersionFile
          if (error instanceof Error && !error.message.includes('duplicate key') && !error.message.includes('llave duplicada')) {
            throw error;
          }
        }
      });

      await Promise.all(savePromises);
      sendProgressUpdate(modpackId, versionId, `Guardados ${fileEntries.length} archivos en base de datos`, { category: fileType, percent: 95 });

      // Mostrar tabla con path y hash
      console.log(`Hashes generados para ${fileType}:`);
      console.table(fileEntries.map(fe => ({ path: fe.path, hash: fe.hash })));

      console.log(`Procesamiento completo para ${fileType}`);
      sendCompletionUpdate(modpackId, versionId, `Procesamiento completo para ${fileType}`);

      // Clean up temporary directory
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Error procesando ${fileType} para modpack ${modpackId}:`, error);
      sendErrorUpdate(modpackId, versionId, `Error procesando ${fileType}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Clean up temp file
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
          console.log(`Archivo temporal eliminado: ${tempPath}`);
        }
      } catch (cleanupError) {
        console.error(`Error eliminando archivo temporal: ${cleanupError}`);
      }
    }
  };

  // Delegar a la queue
  const { position, estimatedTime } = queue.add(task, `${modpackId}-${fileType}`);

  return {
    message: `Archivo recibido, se procesará en background. Posición en cola: ${position}. ${estimatedTime}`,
    tempPath,
  };
};
