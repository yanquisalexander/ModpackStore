import fs from "fs";
import path from "path";
import crypto from "crypto";
import JSZip from "jszip";
import { queue } from "./Queue";
import { uploadToR2, batchUploadToR2 } from "./r2UploadService";
import { ModpackFile, ModpackFileType } from "@/entities/ModpackFile";
import { ModpackVersionFile } from "@/entities/ModpackVersionFile";
import { In } from "typeorm";

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
    console.log(`Procesando ${fileType} para modpack ${modpackId}...`);

    // Eliminar todos los ModpackVersionFile existentes para esta versión y tipo
    await ModpackVersionFile.createQueryBuilder()
      .delete()
      .from(ModpackVersionFile)
      .where(`modpackVersionId = :versionId AND fileHash IN (
        SELECT hash FROM modpack_files WHERE type = :fileType
      )`, { versionId, fileType })
      .execute();

    const fileEntries: { path: string; hash: string; content: Buffer }[] = [];

    const zip = await JSZip.loadAsync(buffer);
    const extractDir = path.join(TEMP_UPLOAD_DIR, `${modpackId}-${fileType}-${Date.now()}`);
    fs.mkdirSync(extractDir, { recursive: true });

    for (const entryName of Object.keys(zip.files)) {
      const zipFile = zip.files[entryName];
      if (!zipFile.dir) {
        const content = await zipFile.async("nodebuffer");
        const hash = crypto.createHash("sha1").update(content).digest("hex");
        // Adjust path based on fileType
        const adjustedPath = fileType === 'extras' ? entryName : `${fileType}/${entryName}`;
        fileEntries.push({ path: adjustedPath, hash, content });

        // Guardar temporalmente para compatibilidad
        const filePath = path.join(extractDir, entryName);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content);
      }
    }


    // Batch query: obtener todos los archivos existentes por hash
    const allHashes = fileEntries.map(fe => fe.hash);
    const existingFiles = await ModpackFile.find({ where: { hash: In(allHashes) } });
    const existingHashes = new Set(existingFiles.map(ef => ef.hash));

    // Procesar solo los que no existen
    const newFiles = fileEntries.filter(fe => !existingHashes.has(fe.hash));
    const getHashKey = (hash: string) => path.posix.join("resources", "files", hash.slice(0, 2), hash.slice(2, 4), hash);
    const uploads = newFiles.map(fe => ({
      key: getHashKey(fe.hash),
      body: fe.content,
      contentType: "application/octet-stream"
    }));

    // Batch upload to R2 with concurrency control
    const uploadResults = await batchUploadToR2(uploads, 5); // concurrency 5

    console.log(`Subidos ${uploadResults.length} archivos nuevos a R2 para ${fileType}`);

    // Save to DB after uploads
    const savePromises = fileEntries.map(async (fe) => {
      try {
        // Find or create ModpackFile
        let modpackFile = await ModpackFile.findOne({ where: { hash: fe.hash } });
        if (!modpackFile) {
          modpackFile = new ModpackFile();
          modpackFile.hash = fe.hash;
          modpackFile.size = fe.content.length;
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

    // Mostrar tabla con path y hash (todos, incluyendo existentes)
    console.log(`Hashes generados para ${fileType}:`);
    console.table(fileEntries.map(fe => ({ path: fe.path, hash: fe.hash })));

    console.log(`Procesamiento completo para ${fileType}`);

    // Limpiar directorio temporal
    fs.rmSync(extractDir, { recursive: true, force: true });
  };

  // Delegar a la queue
  const { position, estimatedTime } = queue.add(task, `${modpackId}-${fileType}`);

  return {
    message: `Archivo recibido, se procesará en background. Posición en cola: ${position}. ${estimatedTime}`,
    tempPath,
  };
};
