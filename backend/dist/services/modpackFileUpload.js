"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModpackFileUploadService = exports.FileType = void 0;
const crypto_1 = require("crypto");
// import { readFile } from 'fs/promises'; // readFile seems unused
// import { basename, join } from 'path'; // basename, join seem unused
const jszip_1 = __importDefault(require("jszip"));
const schema_1 = require("../db/schema");
const client_1 = require("../db/client");
const drizzle_orm_1 = require("drizzle-orm");
const client_s3_1 = require("@aws-sdk/client-s3");
var FileType;
(function (FileType) {
    FileType["MODS"] = "mods";
    FileType["CONFIGS"] = "configs";
    FileType["RESOURCES"] = "resources";
})(FileType || (exports.FileType = FileType = {}));
class ModpackFileUploadService {
    constructor(region, bucketName, endpoint) {
        this.bucketName = bucketName;
        this.s3Client = new client_s3_1.S3Client({
            region,
            endpoint,
            forcePathStyle: true, // Necesario para algunos servicios compatibles con S3 como MinIO
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
            }
        });
    }
    /**
     * Calcula el hash SHA-256 de un buffer de datos
     */
    calculateHash(data) {
        return (0, crypto_1.createHash)('sha256').update(data).digest('hex');
    }
    /**
     * Guarda un archivo en R2 Storage
     */
    saveFile(modpackId, versionId, fileType, fileBuffer) {
        return __awaiter(this, void 0, void 0, function* () {
            const hash = this.calculateHash(fileBuffer);
            const key = `${modpackId}/${versionId}/${fileType}/${hash}.zip`;
            // Guardamos el archivo en R2
            yield this.s3Client.send(new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: fileBuffer,
                ContentType: 'application/zip',
                Metadata: {
                    'file-hash': hash,
                    'file-type': fileType
                }
            }));
            return hash;
        });
    }
    /**
     * Obtiene un archivo desde R2 Storage
     */
    getFile(key) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            const response = yield this.s3Client.send(new client_s3_1.GetObjectCommand({
                Bucket: this.bucketName,
                Key: key
            }));
            // Convertir el stream de respuesta a Buffer
            const chunks = [];
            try {
                for (var _d = true, _e = __asyncValues(response.Body), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                    _c = _f.value;
                    _d = false;
                    const chunk = _c;
                    chunks.push(Buffer.from(chunk));
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return Buffer.concat(chunks);
        });
    }
    /**
     * Extrae información de los archivos individuales dentro del ZIP
     */
    extractFileInfo(zipBuffer) {
        return __awaiter(this, void 0, void 0, function* () {
            const zip = yield jszip_1.default.loadAsync(zipBuffer);
            const fileInfos = [];
            // Recorremos todos los archivos en el ZIP
            for (const [path, file] of Object.entries(zip.files)) {
                if (!file.dir) { // Ignoramos directorios
                    const content = yield file.async('nodebuffer');
                    fileInfos.push({
                        path: path,
                        hash: this.calculateHash(content),
                        size: content.length
                    });
                }
            }
            return fileInfos;
        });
    }
    /**
     * Busca la última versión publicada del modpack para comparar
     */
    findPreviousVersionFile(modpackId, fileType) {
        return __awaiter(this, void 0, void 0, function* () {
            // Buscamos la última versión del modpack
            const latestVersions = yield client_1.client
                .select()
                .from(schema_1.ModpackVersionsTable)
                .where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.modpackId, modpackId))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.ModpackVersionsTable.releaseDate))
                .limit(1);
            if (latestVersions.length === 0) {
                return null; // No hay versiones previas
            }
            const latestVersionId = latestVersions[0].id;
            // Buscamos el archivo de tipo específico de esta versión
            const versionFiles = yield client_1.client
                .select()
                .from(schema_1.ModpackVersionFilesTable)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.ModpackVersionFilesTable.modpackVersionId, latestVersionId), (0, drizzle_orm_1.eq)(schema_1.ModpackVersionFilesTable.type, fileType)));
            if (versionFiles.length === 0) {
                return null; // No hay archivos de este tipo en la versión anterior
            }
            const versionFileId = versionFiles[0].id;
            // Obtenemos todos los archivos individuales
            const individualFiles = yield client_1.client
                .select()
                .from(schema_1.ModpackVersionIndividualFilesTable)
                .where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionIndividualFilesTable.modpackVersionFileId, versionFileId));
            // Creamos un mapa para acceso rápido
            const fileMap = {};
            for (const file of individualFiles) {
                fileMap[file.path] = {
                    hash: file.hash,
                    size: file.size || 0,
                    id: file.id
                };
            }
            return {
                versionFileId,
                individualFiles: fileMap
            };
        });
    }
    /**
     * Sube un archivo ZIP al modpack y procesa sus contenidos
     */
    uploadFile(userId, modpackId, modpackVersionId, fileType, fileBuffer, reuseFromVersion) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Verificar que el modpack existe
            const modpack = yield client_1.client
                .select()
                .from(schema_1.ModpacksTable)
                .where((0, drizzle_orm_1.eq)(schema_1.ModpacksTable.id, modpackId))
                .limit(1);
            if (modpack.length === 0) {
                throw new Error(`Modpack con ID ${modpackId} no encontrado`);
            }
            // Verificar que la versión existe y pertenece al modpack
            const modpackVersion = yield client_1.client
                .select()
                .from(schema_1.ModpackVersionsTable)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.id, modpackVersionId), (0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.modpackId, modpackId)))
                .limit(1);
            if (modpackVersion.length === 0) {
                throw new Error(`Versión con ID ${modpackVersionId} no encontrada para el modpack ${modpackId}`);
            }
            // Si se solicitó reutilizar archivos de otra versión y el tipo es compatible
            if (reuseFromVersion && (fileType === FileType.CONFIGS || fileType === FileType.RESOURCES)) {
                try {
                    // Verificar que la versión a reutilizar existe
                    const reusedVersion = yield client_1.client
                        .select()
                        .from(schema_1.ModpackVersionsTable)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.id, reuseFromVersion), (0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.modpackId, modpackId)))
                        .limit(1);
                    if (reusedVersion.length > 0) {
                        // Buscar archivo del mismo tipo en la versión a reutilizar
                        const reusedFiles = yield client_1.client
                            .select()
                            .from(schema_1.ModpackVersionFilesTable)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.ModpackVersionFilesTable.modpackVersionId, reuseFromVersion), (0, drizzle_orm_1.eq)(schema_1.ModpackVersionFilesTable.type, fileType)))
                            .limit(1);
                        if (reusedFiles.length > 0) {
                            const reusedFileId = reusedFiles[0].id;
                            // Copiar referencia del archivo en vez de subir uno nuevo
                            const [versionFile] = yield client_1.client
                                .insert(schema_1.ModpackVersionFilesTable)
                                .values({
                                modpackVersionId: modpackVersionId,
                                type: fileType,
                                hash: reusedFiles[0].hash,
                                isDelta: reusedFiles[0].isDelta,
                            })
                                .returning({ id: schema_1.ModpackVersionFilesTable.id });
                            // Copiar referencias de archivos individuales
                            const individualFiles = yield client_1.client
                                .select()
                                .from(schema_1.ModpackVersionIndividualFilesTable)
                                .where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionIndividualFilesTable.modpackVersionFileId, reusedFileId));
                            // Copiar cada archivo individual
                            for (const file of individualFiles) {
                                yield client_1.client
                                    .insert(schema_1.ModpackVersionIndividualFilesTable)
                                    .values({
                                    modpackVersionFileId: versionFile.id,
                                    path: file.path,
                                    hash: file.hash,
                                    size: file.size,
                                });
                            }
                            // Actualizar el manifest para indicar la reutilización
                            yield this.updateVersionManifest(modpackId, modpackVersionId, fileType, reusedFiles[0].hash, true, reuseFromVersion);
                            const totalSize = individualFiles.reduce((sum, file) => sum + (file.size || 0), 0);
                            return {
                                versionFileId: versionFile.id,
                                isDelta: reusedFiles[0].isDelta,
                                fileCount: individualFiles.length,
                                totalSize,
                                addedFiles: 0,
                                removedFiles: 0,
                                modifiedFiles: 0,
                            };
                        }
                    }
                }
                catch (error) {
                    console.error('Error al reutilizar archivos:', error);
                    // Continuamos con la subida normal si hubo un error
                }
            }
            // Guardar el archivo ZIP en R2
            const fileHash = yield this.saveFile(modpackId, modpackVersionId, fileType, fileBuffer);
            // Extraer información de los archivos dentro del ZIP
            const newFiles = yield this.extractFileInfo(fileBuffer);
            // Buscar versión anterior para comparación
            const previousVersion = yield this.findPreviousVersionFile(modpackId, fileType);
            // Determinar si es un delta y qué archivos cambiaron
            let isDelta = false;
            let addedFiles = 0;
            let removedFiles = 0;
            let modifiedFiles = 0;
            if (previousVersion) {
                isDelta = true;
                // Comprobamos archivos añadidos o modificados
                for (const file of newFiles) {
                    const prevFile = previousVersion.individualFiles[file.path];
                    if (!prevFile) {
                        addedFiles++;
                    }
                    else if (prevFile.hash !== file.hash) {
                        modifiedFiles++;
                    }
                }
                // Comprobamos archivos eliminados
                const newFilePaths = new Set(newFiles.map(f => f.path));
                for (const path in previousVersion.individualFiles) {
                    if (!newFilePaths.has(path)) {
                        removedFiles++;
                    }
                }
            }
            // Insertar registro en la tabla de archivos de versión
            const [versionFile] = yield client_1.client
                .insert(schema_1.ModpackVersionFilesTable)
                .values({
                modpackVersionId: modpackVersionId,
                type: fileType,
                hash: fileHash,
                isDelta,
            })
                .returning({ id: schema_1.ModpackVersionFilesTable.id });
            const versionFileId = versionFile.id;
            // Guardar archivos individuales en R2 y en la base de datos
            for (const file of newFiles) {
                // Extraer el archivo del ZIP
                const zip = yield jszip_1.default.loadAsync(fileBuffer);
                const fileContent = yield ((_a = zip.file(file.path)) === null || _a === void 0 ? void 0 : _a.async('nodebuffer'));
                if (fileContent) {
                    // Guardar el archivo individual en R2
                    const individualKey = `${modpackId}/${modpackVersionId}/${fileType}/individual/${file.hash}`;
                    yield this.s3Client.send(new client_s3_1.PutObjectCommand({
                        Bucket: this.bucketName,
                        Key: individualKey,
                        Body: fileContent,
                        ContentType: 'application/octet-stream',
                        Metadata: {
                            'file-hash': file.hash,
                            'original-path': file.path
                        }
                    }));
                }
                // Registrar en la base de datos
                yield client_1.client
                    .insert(schema_1.ModpackVersionIndividualFilesTable)
                    .values({
                    modpackVersionFileId: versionFileId,
                    path: file.path,
                    hash: file.hash,
                    size: file.size,
                });
            }
            // Actualizar el manifiesto de la versión
            yield this.updateVersionManifest(modpackId, modpackVersionId, fileType, fileHash);
            // Calcular el tamaño total
            const totalSize = newFiles.reduce((sum, file) => sum + file.size, 0);
            return {
                versionFileId,
                isDelta,
                fileCount: newFiles.length,
                totalSize,
                addedFiles,
                removedFiles,
                modifiedFiles,
            };
        });
    }
    /**
     * Actualiza o crea el manifiesto de una versión de modpack
     */
    updateVersionManifest(modpackId_1, versionId_1, fileType_1, fileHash_1) {
        return __awaiter(this, arguments, void 0, function* (modpackId, versionId, fileType, fileHash, isReused = false, reusedFromVersionId) {
            // Obtener información de la versión
            const version = yield client_1.client
                .select()
                .from(schema_1.ModpackVersionsTable)
                .where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.id, versionId))
                .limit(1);
            if (version.length === 0) {
                throw new Error(`Versión no encontrada: ${versionId}`);
            }
            // Obtener información del modpack
            const modpack = yield client_1.client
                .select()
                .from(schema_1.ModpacksTable)
                .where((0, drizzle_orm_1.eq)(schema_1.ModpacksTable.id, modpackId))
                .limit(1);
            if (modpack.length === 0) {
                throw new Error(`Modpack no encontrado: ${modpackId}`);
            }
            // Intentar obtener el manifiesto existente
            let manifest;
            const manifestKey = `${modpackId}/${versionId}/manifest.json`;
            try {
                const existingManifest = yield this.getFile(manifestKey);
                manifest = JSON.parse(existingManifest.toString('utf-8'));
            }
            catch (error) {
                // Si no existe, crear uno nuevo
                manifest = {
                    name: modpack[0].name,
                    version: version[0].version,
                    mcVersion: version[0].mcVersion,
                    forgeVersion: version[0].forgeVersion,
                    files: {},
                    reusedFrom: {}
                };
            }
            // Actualizar la parte correspondiente al tipo de archivo
            manifest.files[fileType] = fileHash;
            // Si se reutilizó de otra versión, guardar esa información
            if (isReused && reusedFromVersionId) {
                if (!manifest.reusedFrom) {
                    manifest.reusedFrom = {};
                }
                manifest.reusedFrom[fileType] = reusedFromVersionId;
            }
            // Guardar el manifiesto actualizado
            yield this.s3Client.send(new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: manifestKey,
                Body: JSON.stringify(manifest, null, 2),
                ContentType: 'application/json'
            }));
        });
    }
}
exports.ModpackFileUploadService = ModpackFileUploadService;
(modpackId, versionFileId) => {
    var _a, _b;
    // Obtener información del archivo de versión
    const versionFile = yield client_1.client
        .select()
        .from(schema_1.ModpackVersionFilesTable)
        .where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionFilesTable.id, versionFileId))
        .limit(1);
    if (versionFile.length === 0 || !versionFile[0].isDelta) {
        throw new Error(`Archivo de versión ${versionFileId} no encontrado o no es un delta`);
    }
    const currentVersionFile = versionFile[0];
    // Obtener la versión del modpack
    const modpackVersion = yield client_1.client
        .select()
        .from(schema_1.ModpackVersionsTable)
        .where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.id, currentVersionFile.modpackVersionId))
        .limit(1);
    if (modpackVersion.length === 0) {
        throw new Error(`Versión del modpack no encontrada`);
    }
    // Buscar versiones anteriores para reconstruir el delta
    const previousVersions = yield client_1.client
        .select()
        .from(schema_1.ModpackVersionsTable)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.modpackId, modpackId), (0, drizzle_orm_1.lt)(schema_1.ModpackVersionsTable.releaseDate, modpackVersion[0].releaseDate)))
        .orderBy((0, drizzle_orm_1.desc)(schema_1.ModpackVersionsTable.releaseDate));
    // Si no hay versiones anteriores, no podemos reconstruir
    if (previousVersions.length === 0) {
        throw new Error(`No hay versiones anteriores para reconstruir el delta`);
    }
    // Buscar el archivo de la misma categoría en la versión anterior
    const previousVersionFiles = yield client_1.client
        .select()
        .from(schema_1.ModpackVersionFilesTable)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.ModpackVersionFilesTable.modpackVersionId, previousVersions[0].id), (0, drizzle_orm_1.eq)(schema_1.ModpackVersionFilesTable.type, currentVersionFile.type)));
    if (previousVersionFiles.length === 0) {
        throw new Error(`No se encontró un archivo del mismo tipo en la versión anterior`);
    }
    const previousVersionFileId = previousVersionFiles[0].id;
    // Obtener archivos individuales de la versión actual
    const currentFiles = yield client_1.client
        .select()
        .from(schema_1.ModpackVersionIndividualFilesTable)
        .where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionIndividualFilesTable.modpackVersionFileId, versionFileId));
    // Obtener archivos individuales de la versión anterior
    const previousFiles = yield client_1.client
        .select()
        .from(schema_1.ModpackVersionIndividualFilesTable)
        .where((0, drizzle_orm_1.eq)(schema_1.ModpackVersionIndividualFilesTable.modpackVersionFileId, previousVersionFileId));
    // Crear un mapa de los archivos previos para acceso rápido
    const prevFilesMap = new Map(previousFiles.map(f => [f.path, f]));
    // Crear un nuevo ZIP con los archivos combinados
    const zip = new jszip_1.default();
    // Descargar y añadir archivos actuales desde R2
    for (const file of currentFiles) {
        try {
            // Construir la clave para R2 donde estaría el archivo individual
            const key = `${modpackId}/${modpackVersion[0].id}/${currentVersionFile.type}/individual/${file.hash}`;
            const content = yield this.getFile(key);
            zip.file(file.path, content);
        }
        catch (err) {
            console.error(`Error al obtener el archivo individual:`, err);
            // Intentamos extraerlo del ZIP completo (opcional)
            try {
                const zipKey = `${modpackId}/${modpackVersion[0].id}/${currentVersionFile.type}/${currentVersionFile.hash}.zip`;
                const zipContent = yield this.getFile(zipKey);
                const originalZip = yield jszip_1.default.loadAsync(zipContent);
                // Buscar el archivo por su ruta relativa
                const fileContent = yield ((_a = originalZip.file(file.path)) === null || _a === void 0 ? void 0 : _a.async('nodebuffer'));
                if (fileContent) {
                    zip.file(file.path, fileContent);
                }
            }
            catch (zipErr) {
                console.error(`Error al extraer del ZIP original:`, zipErr);
            }
        }
    }
    // Añadir archivos de la versión anterior que no están en la actual
    for (const prevFile of previousFiles) {
        // Si el archivo no existe en la versión actual, lo añadimos
        if (!currentFiles.some(f => f.path === prevFile.path)) {
            try {
                const key = `${modpackId}/${previousVersions[0].id}/${currentVersionFile.type}/individual/${prevFile.hash}`;
                const content = yield this.getFile(key);
                zip.file(prevFile.path, content);
            }
            catch (err) {
                console.error(`Error al obtener archivo anterior:`, err);
                // Intentamos extraerlo del ZIP completo de la versión anterior
                try {
                    const zipKey = `${modpackId}/${previousVersions[0].id}/${currentVersionFile.type}/${previousVersionFiles[0].hash}.zip`;
                    const zipContent = yield this.getFile(zipKey);
                    const originalZip = yield jszip_1.default.loadAsync(zipContent);
                    const fileContent = yield ((_b = originalZip.file(prevFile.path)) === null || _b === void 0 ? void 0 : _b.async('nodebuffer'));
                    if (fileContent) {
                        zip.file(prevFile.path, fileContent);
                    }
                }
                catch (zipErr) {
                    console.error(`Error al extraer del ZIP anterior:`, zipErr);
                }
            }
        }
    }
    // Generar el ZIP final
    return yield zip.generateAsync({ type: 'nodebuffer' });
};
async;
checkUploadPermission(userId, string, modpackId, string);
Promise < boolean > {
    // Esta función verificaría los permisos en las tablas PublisherMembersTable y ModpackPermissionsTable
    // Por simplicidad, retornamos true en este ejemplo
    return: true
};
// TODO: Replace console.log with a dedicated logger solution throughout the service.
// TODO: Implement robust authorization checks for all operations (e.g., checkUploadPermission).
// TODO: Consider using custom error classes for better error handling and propagation.
class ModpackFileUploadService {
    constructor(region, bucketName, endpoint, accessKeyId, secretAccessKey) {
        this.bucketName = bucketName;
        const effectiveAccessKeyId = accessKeyId || process.env.R2_ACCESS_KEY_ID;
        const effectiveSecretAccessKey = secretAccessKey || process.env.R2_SECRET_ACCESS_KEY;
        if (!effectiveAccessKeyId || !effectiveSecretAccessKey) {
            console.error("[SERVICE_MODPACK_UPLOAD] S3 credentials are not configured. Uploads will fail.");
            // throw new Error("S3 credentials are not configured."); // Or handle this more gracefully depending on app flow
        }
        this.s3Client = new client_s3_1.S3Client({
            region,
            endpoint,
            forcePathStyle: !!endpoint, // forcePathStyle is often true for MinIO/custom S3 endpoints
            credentials: {
                accessKeyId: effectiveAccessKeyId || '', // Provide default empty string if null/undefined
                secretAccessKey: effectiveSecretAccessKey || '' // Provide default empty string
            }
        });
    }
    /**
     * Calculates the hash SHA-256 of a buffer of data
     */
    calculateHash(data) {
        return (0, crypto_1.createHash)('sha256').update(data).digest('hex');
    }
    /**
     * Saves a file to S3 Storage
     */
    saveFileToStorage(key, fileBuffer, contentType, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.s3Client.send(new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: fileBuffer,
                ContentType: contentType,
                Metadata: metadata
            }));
        });
    }
    /**
     * Generates the S3 key for a main version file (the ZIP).
     */
    getMainFileS3Key(modpackId, versionId, fileType, fileHash) {
        return `${modpackId}/${versionId}/${fileType}/${fileHash}.zip`;
    }
    /**
     * Generates the S3 key for an individual file extracted from a ZIP.
     */
    getIndividualFileS3Key(modpackId, versionId, fileType, individualFileHash) {
        return `${modpackId}/${versionId}/${fileType}/individual/${individualFileHash}`;
    }
    /**
     * Obtiene un archivo desde R2 Storage
     */
    getFile(key) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_2, _b, _c;
            try {
                const response = yield this.s3Client.send(new client_s3_1.GetObjectCommand({
                    Bucket: this.bucketName,
                    Key: key
                }));
                const chunks = [];
                // Assuming response.Body is a ReadableStream (Node.js) or similar async iterable
                if (response.Body) {
                    try {
                        for (var _d = true, _e = __asyncValues(response.Body), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                            _c = _f.value;
                            _d = false;
                            const chunk = _c;
                            chunks.push(Buffer.from(chunk));
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                }
                else {
                    throw new Error("S3 GetObjectCommand response body is empty.");
                }
                return Buffer.concat(chunks);
            }
            catch (error) {
                console.error(`[SERVICE_MODPACK_UPLOAD] Failed to get file from S3 at key ${key}:`, error);
                throw new Error(`Failed to retrieve file from storage (key: ${key}): ${error.message}`);
            }
        });
    }
    /**
     * Extrae información de los archivos individuales dentro del ZIP
     */
    extractFileInfoFromZip(zipBuffer) {
        return __awaiter(this, void 0, void 0, function* () {
            const zip = yield jszip_1.default.loadAsync(zipBuffer);
            const fileInfos = [];
            for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
                if (!zipEntry.dir) {
                    const content = yield zipEntry.async('nodebuffer');
                    fileInfos.push({
                        path: relativePath, // JSZip uses relative paths
                        hash: this.calculateHash(content),
                        size: content.length
                    });
                }
            }
            return fileInfos;
        });
    }
    _ensureModpackAndVersionExist(modpackId, modpackVersionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const modpackRecord = yield client_1.client.query.ModpacksTable.findFirst({ where: (0, drizzle_orm_1.eq)(schema_1.ModpacksTable.id, modpackId) });
            if (!modpackRecord)
                throw new Error(`Modpack con ID ${modpackId} no encontrado`);
            const versionRecord = yield client_1.client.query.ModpackVersionsTable.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.id, modpackVersionId), (0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.modpackId, modpackId))
            });
            if (!versionRecord)
                throw new Error(`Versión con ID ${modpackVersionId} no encontrada para el modpack ${modpackId}`);
            return { modpack: new Modpack(modpackRecord), version: new ModpackVersion(versionRecord) };
        });
    }
    _handleFileReuse(modpackId, currentModpackVersionId, fileType, reuseFromVersionId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[SERVICE_MODPACK_UPLOAD] Attempting to reuse ${fileType} file from version ${reuseFromVersionId} for version ${currentModpackVersionId}`);
            const reusedVersion = yield client_1.client.query.ModpackVersionsTable.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.id, reuseFromVersionId), (0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.modpackId, modpackId))
            });
            if (!reusedVersion) {
                console.warn(`[SERVICE_MODPACK_UPLOAD] Version to reuse (ID: ${reuseFromVersionId}) not found for modpack ${modpackId}. Proceeding with new file upload.`);
                return null;
            }
            const reusedVersionFileRecord = yield client_1.client.query.ModpackVersionFilesTable.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.ModpackVersionFilesTable.modpackVersionId, reuseFromVersionId), (0, drizzle_orm_1.eq)(schema_1.ModpackVersionFilesTable.type, fileType))
            });
            if (!reusedVersionFileRecord) {
                console.warn(`[SERVICE_MODPACK_UPLOAD] No ${fileType} file found in version ${reuseFromVersionId} to reuse. Proceeding with new file upload.`);
                return null;
            }
            // Start transaction for DB operations
            return yield client_1.client.transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const [newVersionFileEntry] = yield tx
                    .insert(schema_1.ModpackVersionFilesTable)
                    .values({
                    modpackVersionId: currentModpackVersionId,
                    type: fileType,
                    hash: reusedVersionFileRecord.hash, // Reuse hash of the main ZIP
                    isDelta: reusedVersionFileRecord.isDelta, // Reuse delta status
                    size: reusedVersionFileRecord.size, // Reuse size of the main ZIP
                })
                    .returning();
                const individualFilesToCopy = yield tx.query.ModpackVersionIndividualFilesTable.findMany({
                    where: (0, drizzle_orm_1.eq)(schema_1.ModpackVersionIndividualFilesTable.modpackVersionFileId, reusedVersionFileRecord.id)
                });
                if (individualFilesToCopy.length > 0) {
                    const newIndividualFilesValues = individualFilesToCopy.map(f => ({
                        modpackVersionFileId: newVersionFileEntry.id,
                        path: f.path,
                        hash: f.hash,
                        size: f.size,
                    }));
                    yield tx.insert(schema_1.ModpackVersionIndividualFilesTable).values(newIndividualFilesValues);
                }
                yield this._updateVersionManifestInternal(modpackId, currentModpackVersionId, fileType, reusedVersionFileRecord.hash, tx, true, reuseFromVersionId);
                const totalSize = individualFilesToCopy.reduce((sum, file) => sum + (file.size || 0), 0);
                console.log(`[SERVICE_MODPACK_UPLOAD] Successfully reused ${fileType} from version ${reuseFromVersionId} for ${currentModpackVersionId}.`);
                return {
                    versionFileId: newVersionFileEntry.id,
                    isDelta: reusedVersionFileRecord.isDelta || false,
                    fileCount: individualFilesToCopy.length,
                    totalSize,
                    addedFiles: 0, removedFiles: 0, modifiedFiles: 0, // No changes as it's a reuse
                };
            }));
        });
    }
    _processAndStoreNewFile(modpackId, modpackVersionId, fileType, fileBuffer, modpackInfo, // Pass necessary info to avoid re-fetching
    versionInfo, previousVersionData // Use helper type
    ) {
        return __awaiter(this, void 0, void 0, function* () {
            const mainFileHash = this.calculateHash(fileBuffer);
            const mainFileS3Key = this.getMainFileS3Key(modpackId, modpackVersionId, fileType, mainFileHash);
            console.log(`[SERVICE_MODPACK_UPLOAD] Saving main ${fileType} ZIP to S3: ${mainFileS3Key}`);
            yield this.saveFileToStorage(mainFileS3Key, fileBuffer, 'application/zip', {
                'file-hash': mainFileHash, 'file-type': fileType
            });
            console.log(`[SERVICE_MODPACK_UPLOAD] Extracting file info from ${fileType} ZIP.`);
            const newIndividualFileInfos = yield this.extractFileInfoFromZip(fileBuffer); // Load ZIP once
            let isDelta = false;
            let added = 0, removed = 0, modified = 0;
            if (previousVersionData) {
                isDelta = true;
                const prevFileMap = previousVersionData.individualFiles;
                const newFilePaths = new Set(newIndividualFileInfos.map(f => f.path));
                for (const newFile of newIndividualFileInfos) {
                    const prevFile = prevFileMap[newFile.path];
                    if (!prevFile)
                        added++;
                    else if (prevFile.hash !== newFile.hash)
                        modified++;
                }
                for (const path in prevFileMap) {
                    if (!newFilePaths.has(path))
                        removed++;
                }
                console.log(`[SERVICE_MODPACK_UPLOAD] Delta calculated for ${fileType}: Added ${added}, Removed ${removed}, Modified ${modified}.`);
            }
            else {
                added = newIndividualFileInfos.length; // All files are new if no previous version
                console.log(`[SERVICE_MODPACK_UPLOAD] No previous version found for ${fileType}. All ${added} files considered new.`);
            }
            // Transaction for DB inserts
            return yield client_1.client.transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const [versionFileEntry] = yield tx
                    .insert(schema_1.ModpackVersionFilesTable)
                    .values({
                    modpackVersionId: modpackVersionId, type: fileType, hash: mainFileHash, isDelta,
                    size: fileBuffer.length // Store size of the main ZIP
                })
                    .returning();
                if (newIndividualFileInfos.length > 0) {
                    // Upload individual files to S3 (if this strategy is kept)
                    // This part is resource-intensive. Consider if storing individual files in S3 is truly necessary
                    // if the main ZIP is already stored.
                    const zip = yield jszip_1.default.loadAsync(fileBuffer); // Load ZIP once for all individual file extractions
                    for (const fileInfo of newIndividualFileInfos) {
                        const individualFileContent = yield ((_a = zip.file(fileInfo.path)) === null || _a === void 0 ? void 0 : _a.async('nodebuffer'));
                        if (individualFileContent) {
                            const individualFileS3Key = this.getIndividualFileS3Key(modpackId, modpackVersionId, fileType, fileInfo.hash);
                            // console.log(`[SERVICE_MODPACK_UPLOAD] Saving individual file ${fileInfo.path} to S3: ${individualFileS3Key}`);
                            yield this.saveFileToStorage(individualFileS3Key, individualFileContent, 'application/octet-stream', {
                                'file-hash': fileInfo.hash, 'original-path': fileInfo.path
                            });
                        }
                    }
                    // Batch insert individual file metadata
                    const individualFileValues = newIndividualFileInfos.map(f => ({
                        modpackVersionFileId: versionFileEntry.id,
                        path: f.path, hash: f.hash, size: f.size,
                    }));
                    yield tx.insert(schema_1.ModpackVersionIndividualFilesTable).values(individualFileValues);
                    console.log(`[SERVICE_MODPACK_UPLOAD] Stored metadata for ${newIndividualFileInfos.length} individual files in DB.`);
                }
                yield this._updateVersionManifestInternal(modpackId, modpackVersionId, fileType, mainFileHash, tx, false, undefined, modpackInfo, versionInfo);
                const totalSize = newIndividualFileInfos.reduce((sum, file) => sum + file.size, 0);
                return {
                    versionFileId: versionFileEntry.id, isDelta, fileCount: newIndividualFileInfos.length, totalSize,
                    addedFiles: added, removedFiles: removed, modifiedFiles: modified,
                };
            }));
        });
    }
    /**
     * Sube un archivo ZIP al modpack y procesa sus contenidos
     */
    uploadFile(userId, // For authorization checks (TODO)
    modpackId, modpackVersionId, fileType, fileBuffer, reuseFromVersion) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[SERVICE_MODPACK_UPLOAD] Uploading ${fileType} for modpack ${modpackId}, version ${modpackVersionId}. User: ${userId}`);
            const { modpack, version: modpackVersion } = yield this._ensureModpackAndVersionExist(modpackId, modpackVersionId);
            // Authorization: await this.checkUploadPermission(userId, modpackId);
            // if (!canUpload) throw new Error("Forbidden");
            if (reuseFromVersion && (fileType === FileType.CONFIGS || fileType === FileType.RESOURCES)) {
                const reuseResult = yield this._handleFileReuse(modpackId, modpackVersionId, fileType, reuseFromVersion);
                if (reuseResult)
                    return reuseResult;
                // If reuseResult is null, it means reuse failed or wasn't applicable, proceed to normal upload.
            }
            const previousVersionData = yield this.findPreviousVersionFile(modpackId, fileType);
            const modpackInfo = { name: modpack.name }; // Pass only needed data
            const versionInfo = { version: modpackVersion.version, mcVersion: modpackVersion.mcVersion, forgeVersion: modpackVersion.forgeVersion };
            return this._processAndStoreNewFile(modpackId, modpackVersionId, fileType, fileBuffer, modpackInfo, versionInfo, previousVersionData);
        });
    }
    /**
     * Actualiza o crea el manifiesto de una versión de modpack (internal version using transaction)
     */
    _updateVersionManifestInternal(modpackId_1, versionId_1, fileType_1, fileHash_1, dbOrTx_1) {
        return __awaiter(this, arguments, void 0, function* (modpackId, versionId, fileType, fileHash, dbOrTx, // Drizzle transaction or DB client
        isReused = false, reusedFromVersionId, 
        // Pass modpack and version details if already fetched to avoid re-querying
        modpackDetails, versionDetails) {
            console.log(`[SERVICE_MODPACK_UPLOAD] Updating manifest for modpack ${modpackId}, version ${versionId}, fileType ${fileType}.`);
            let modpackName = modpackDetails === null || modpackDetails === void 0 ? void 0 : modpackDetails.name;
            let versionString = versionDetails === null || versionDetails === void 0 ? void 0 : versionDetails.version;
            let mcVersionString = versionDetails === null || versionDetails === void 0 ? void 0 : versionDetails.mcVersion;
            let forgeVersionString = versionDetails === null || versionDetails === void 0 ? void 0 : versionDetails.forgeVersion;
            if (!modpackName || !versionString || !mcVersionString) {
                const versionData = yield (dbOrTx || client_1.client).query.ModpackVersionsTable.findFirst({
                    where: (0, drizzle_orm_1.eq)(schema_1.ModpackVersionsTable.id, versionId),
                    columns: { version: true, mcVersion: true, forgeVersion: true },
                    with: { modpack: { columns: { name: true } } }
                });
                if (!versionData || !versionData.modpack)
                    throw new Error(`Version ${versionId} or its modpack not found for manifest update.`);
                modpackName = versionData.modpack.name;
                versionString = versionData.version;
                mcVersionString = versionData.mcVersion;
                forgeVersionString = versionData.forgeVersion;
            }
            const manifestKey = `${modpackId}/${versionId}/manifest.json`;
            let manifest;
            try {
                const existingManifestBuffer = yield this.getFile(manifestKey);
                manifest = JSON.parse(existingManifestBuffer.toString('utf-8'));
            }
            catch (error) {
                // If manifest doesn't exist or error fetching, create a new one.
                // Check if it's a "not found" type error from S3 before creating new.
                console.log(`[SERVICE_MODPACK_UPLOAD] Manifest ${manifestKey} not found or failed to fetch. Creating new one. Error: ${error.message}`);
                manifest = {
                    name: modpackName,
                    version: versionString,
                    mcVersion: mcVersionString,
                    forgeVersion: forgeVersionString || undefined, // Handle null from DB
                    files: {},
                    reusedFrom: {}
                };
            }
            manifest.files[fileType] = fileHash;
            if (isReused && reusedFromVersionId) {
                manifest.reusedFrom = manifest.reusedFrom || {};
                manifest.reusedFrom[fileType] = reusedFromVersionId;
            }
            else if (manifest.reusedFrom && manifest.reusedFrom[fileType] && !isReused) {
                // If file is not reused but was previously marked as reused, clear that mark.
                delete manifest.reusedFrom[fileType];
            }
            console.log(`[SERVICE_MODPACK_UPLOAD] Saving updated manifest to S3: ${manifestKey}`);
            yield this.saveFileToStorage(manifestKey, Buffer.from(JSON.stringify(manifest, null, 2)), 'application/json');
        });
    }
    // Public wrapper for updateVersionManifest if needed to be called externally (not using a transaction)
    updateVersionManifest(modpackId_1, versionId_1, fileType_1, fileHash_1) {
        return __awaiter(this, arguments, void 0, function* (modpackId, versionId, fileType, fileHash, isReused = false, reusedFromVersionId) {
            yield this._updateVersionManifestInternal(modpackId, versionId, fileType, fileHash, client_1.client, isReused, reusedFromVersionId);
        });
    }
}
exports.ModpackFileUploadService = ModpackFileUploadService;
