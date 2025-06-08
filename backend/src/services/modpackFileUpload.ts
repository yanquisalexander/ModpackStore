import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { basename, join } from 'path';
import JSZip from 'jszip';
import {
  ModpacksTable,
  ModpackVersionsTable,
  ModpackVersionFilesTable,
  ModpackVersionIndividualFilesTable
} from '../db/schema';
import { client as db } from '../db/client';
import { eq, and, desc, lt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

export enum FileType {
  MODS = 'mods',
  CONFIGS = 'configs',
  RESOURCES = 'resources'
}

interface FileInfo {
  path: string;
  hash: string;
  size: number;
}

interface UploadResult {
  versionFileId: number;
  isDelta: boolean;
  fileCount: number;
  totalSize: number;
  addedFiles: number;
  removedFiles: number;
  modifiedFiles: number;
}

interface ModpackManifest {
  name: string;
  version: string;
  mcVersion: string;
  forgeVersion?: string;
  files: {
    mods?: string;
    configs?: string; 
    resources?: string;
  };
  reusedFrom?: {
    mods?: string;
    configs?: string;
    resources?: string;
  };
}

export class ModpackFileUploadService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(region: string, bucketName: string, endpoint?: string) {
    this.bucketName = bucketName;
    
    this.s3Client = new S3Client({
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
  private calculateHash(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Guarda un archivo en R2 Storage
   */
  private async saveFile(modpackId: string, versionId: string, fileType: FileType, fileBuffer: Buffer): Promise<string> {
    const hash = this.calculateHash(fileBuffer);
    const key = `${modpackId}/${versionId}/${fileType}/${hash}.zip`;
    
    // Guardamos el archivo en R2
    await this.s3Client.send(new PutObjectCommand({
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
  }
  
  /**
   * Obtiene un archivo desde R2 Storage
   */
  private async getFile(key: string): Promise<Buffer> {
    const response = await this.s3Client.send(new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key
    }));
    
    // Convertir el stream de respuesta a Buffer
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(Buffer.from(chunk));
    }
    
    return Buffer.concat(chunks);
  }

  /**
   * Extrae información de los archivos individuales dentro del ZIP
   */
  private async extractFileInfo(zipBuffer: Buffer): Promise<FileInfo[]> {
    const zip = await JSZip.loadAsync(zipBuffer);
    const fileInfos: FileInfo[] = [];

    // Recorremos todos los archivos en el ZIP
    for (const [path, file] of Object.entries(zip.files)) {
      if (!file.dir) {  // Ignoramos directorios
        const content = await file.async('nodebuffer');
        fileInfos.push({
          path: path,
          hash: this.calculateHash(content),
          size: content.length
        });
      }
    }

    return fileInfos;
  }

  /**
   * Busca la última versión publicada del modpack para comparar
   */
  private async findPreviousVersionFile(modpackId: string, fileType: FileType): Promise<{ 
    versionFileId: number, 
    individualFiles: Record<string, { hash: string, size: number, id: number }> 
  } | null> {
    // Buscamos la última versión del modpack
    const latestVersions = await db
      .select()
      .from(ModpackVersionsTable)
      .where(eq(ModpackVersionsTable.modpackId, modpackId))
      .orderBy(desc(ModpackVersionsTable.releaseDate))
      .limit(1);

    if (latestVersions.length === 0) {
      return null; // No hay versiones previas
    }

    const latestVersionId = latestVersions[0].id;

    // Buscamos el archivo de tipo específico de esta versión
    const versionFiles = await db
      .select()
      .from(ModpackVersionFilesTable)
      .where(
        and(
          eq(ModpackVersionFilesTable.modpackVersionId, latestVersionId),
          eq(ModpackVersionFilesTable.type, fileType)
        )
      );

    if (versionFiles.length === 0) {
      return null; // No hay archivos de este tipo en la versión anterior
    }

    const versionFileId = versionFiles[0].id;

    // Obtenemos todos los archivos individuales
    const individualFiles = await db
      .select()
      .from(ModpackVersionIndividualFilesTable)
      .where(eq(ModpackVersionIndividualFilesTable.modpackVersionFileId, versionFileId));

    // Creamos un mapa para acceso rápido
    const fileMap: Record<string, { hash: string, size: number, id: number }> = {};
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
  }

  /**
   * Sube un archivo ZIP al modpack y procesa sus contenidos
   */
  public async uploadFile(
    userId: string,
    modpackId: string,
    modpackVersionId: string,
    fileType: FileType,
    fileBuffer: Buffer,
    reuseFromVersion?: string
  ): Promise<UploadResult> {
    // Verificar que el modpack existe
    const modpack = await db
      .select()
      .from(ModpacksTable)
      .where(eq(ModpacksTable.id, modpackId))
      .limit(1);

    if (modpack.length === 0) {
      throw new Error(`Modpack con ID ${modpackId} no encontrado`);
    }

    // Verificar que la versión existe y pertenece al modpack
    const modpackVersion = await db
      .select()
      .from(ModpackVersionsTable)
      .where(
        and(
          eq(ModpackVersionsTable.id, modpackVersionId),
          eq(ModpackVersionsTable.modpackId, modpackId)
        )
      )
      .limit(1);

    if (modpackVersion.length === 0) {
      throw new Error(`Versión con ID ${modpackVersionId} no encontrada para el modpack ${modpackId}`);
    }

    // Si se solicitó reutilizar archivos de otra versión y el tipo es compatible
    if (reuseFromVersion && (fileType === FileType.CONFIGS || fileType === FileType.RESOURCES)) {
      try {
        // Verificar que la versión a reutilizar existe
        const reusedVersion = await db
          .select()
          .from(ModpackVersionsTable)
          .where(
            and(
              eq(ModpackVersionsTable.id, reuseFromVersion),
              eq(ModpackVersionsTable.modpackId, modpackId)
            )
          )
          .limit(1);
          
        if (reusedVersion.length > 0) {
          // Buscar archivo del mismo tipo en la versión a reutilizar
          const reusedFiles = await db
            .select()
            .from(ModpackVersionFilesTable)
            .where(
              and(
                eq(ModpackVersionFilesTable.modpackVersionId, reuseFromVersion),
                eq(ModpackVersionFilesTable.type, fileType)
              )
            )
            .limit(1);
            
          if (reusedFiles.length > 0) {
            const reusedFileId = reusedFiles[0].id;
            
            // Copiar referencia del archivo en vez de subir uno nuevo
            const [versionFile] = await db
              .insert(ModpackVersionFilesTable)
              .values({
                modpackVersionId: modpackVersionId,
                type: fileType,
                hash: reusedFiles[0].hash,
                isDelta: reusedFiles[0].isDelta,
              })
              .returning({ id: ModpackVersionFilesTable.id });
              
            // Copiar referencias de archivos individuales
            const individualFiles = await db
              .select()
              .from(ModpackVersionIndividualFilesTable)
              .where(eq(ModpackVersionIndividualFilesTable.modpackVersionFileId, reusedFileId));
              
            // Copiar cada archivo individual
            for (const file of individualFiles) {
              await db
                .insert(ModpackVersionIndividualFilesTable)
                .values({
                  modpackVersionFileId: versionFile.id,
                  path: file.path,
                  hash: file.hash,
                  size: file.size,
                });
            }
            
            // Actualizar el manifest para indicar la reutilización
            await this.updateVersionManifest(modpackId, modpackVersionId, fileType, reusedFiles[0].hash, true, reuseFromVersion);
            
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
      } catch (error) {
        console.error('Error al reutilizar archivos:', error);
        // Continuamos con la subida normal si hubo un error
      }
    }

    // Guardar el archivo ZIP en R2
    const fileHash = await this.saveFile(modpackId, modpackVersionId, fileType, fileBuffer);
    
    // Extraer información de los archivos dentro del ZIP
    const newFiles = await this.extractFileInfo(fileBuffer);
    
    // Buscar versión anterior para comparación
    const previousVersion = await this.findPreviousVersionFile(modpackId, fileType);
    
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
        } else if (prevFile.hash !== file.hash) {
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
    const [versionFile] = await db
      .insert(ModpackVersionFilesTable)
      .values({
        modpackVersionId: modpackVersionId,
        type: fileType,
        hash: fileHash,
        isDelta,
      })
      .returning({ id: ModpackVersionFilesTable.id });
    
    const versionFileId = versionFile.id;
    
    // Guardar archivos individuales en R2 y en la base de datos
    for (const file of newFiles) {
      // Extraer el archivo del ZIP
      const zip = await JSZip.loadAsync(fileBuffer);
      const fileContent = await zip.file(file.path)?.async('nodebuffer');
      
      if (fileContent) {
        // Guardar el archivo individual en R2
        const individualKey = `${modpackId}/${modpackVersionId}/${fileType}/individual/${file.hash}`;
        await this.s3Client.send(new PutObjectCommand({
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
      await db
        .insert(ModpackVersionIndividualFilesTable)
        .values({
          modpackVersionFileId: versionFileId,
          path: file.path,
          hash: file.hash,
          size: file.size,
        });
    }
    
    // Actualizar el manifiesto de la versión
    await this.updateVersionManifest(modpackId, modpackVersionId, fileType, fileHash);
    
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
  }
  
  /**
   * Actualiza o crea el manifiesto de una versión de modpack
   */
  private async updateVersionManifest(
    modpackId: string, 
    versionId: string, 
    fileType: FileType, 
    fileHash: string,
    isReused = false,
    reusedFromVersionId?: string
  ): Promise<void> {
    // Obtener información de la versión
    const version = await db
      .select()
      .from(ModpackVersionsTable)
      .where(eq(ModpackVersionsTable.id, versionId))
      .limit(1);
      
    if (version.length === 0) {
      throw new Error(`Versión no encontrada: ${versionId}`);
    }
    
    // Obtener información del modpack
    const modpack = await db
      .select()
      .from(ModpacksTable)
      .where(eq(ModpacksTable.id, modpackId))
      .limit(1);
      
    if (modpack.length === 0) {
      throw new Error(`Modpack no encontrado: ${modpackId}`);
    }
    
    // Intentar obtener el manifiesto existente
    let manifest: ModpackManifest;
    const manifestKey = `${modpackId}/${versionId}/manifest.json`;
    
    try {
      const existingManifest = await this.getFile(manifestKey);
      manifest = JSON.parse(existingManifest.toString('utf-8'));
    } catch (error) {
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
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: manifestKey,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: 'application/json'
    }));
  }
  
  /**
   * Obtiene el manifiesto de una versión
   */
  public async getVersionManifest(modpackId: string,

  /**
   * Reconstruye un archivo delta combinando con la versión anterior
   */
  public async reconstructDelta(modpackId: string, versionFileId: number): Promise<Buffer> {
    // Obtener información del archivo de versión
    const versionFile = await db
      .select()
      .from(ModpackVersionFilesTable)
      .where(eq(ModpackVersionFilesTable.id, versionFileId))
      .limit(1);

    if (versionFile.length === 0 || !versionFile[0].isDelta) {
      throw new Error(`Archivo de versión ${versionFileId} no encontrado o no es un delta`);
    }

    const currentVersionFile = versionFile[0];
    
    // Obtener la versión del modpack
    const modpackVersion = await db
      .select()
      .from(ModpackVersionsTable)
      .where(eq(ModpackVersionsTable.id, currentVersionFile.modpackVersionId))
      .limit(1);

    if (modpackVersion.length === 0) {
      throw new Error(`Versión del modpack no encontrada`);
    }
    
    // Buscar versiones anteriores para reconstruir el delta
    const previousVersions = await db
      .select()
      .from(ModpackVersionsTable)
      .where(
        and(
          eq(ModpackVersionsTable.modpackId, modpackId),
            lt(ModpackVersionsTable.releaseDate, modpackVersion[0].releaseDate),
        )
      )
      .orderBy(desc(ModpackVersionsTable.releaseDate))

    // Si no hay versiones anteriores, no podemos reconstruir
    if (previousVersions.length === 0) {
      throw new Error(`No hay versiones anteriores para reconstruir el delta`);
    }

    // Buscar el archivo de la misma categoría en la versión anterior
    const previousVersionFiles = await db
      .select()
      .from(ModpackVersionFilesTable)
      .where(
        and(
          eq(ModpackVersionFilesTable.modpackVersionId, previousVersions[0].id),
          eq(ModpackVersionFilesTable.type, currentVersionFile.type)
        )
      );

    if (previousVersionFiles.length === 0) {
      throw new Error(`No se encontró un archivo del mismo tipo en la versión anterior`);
    }
    
    const previousVersionFileId = previousVersionFiles[0].id;

    // Obtener archivos individuales de la versión actual
    const currentFiles = await db
      .select()
      .from(ModpackVersionIndividualFilesTable)
      .where(eq(ModpackVersionIndividualFilesTable.modpackVersionFileId, versionFileId));
    
    // Obtener archivos individuales de la versión anterior
    const previousFiles = await db
      .select()
      .from(ModpackVersionIndividualFilesTable)
      .where(eq(ModpackVersionIndividualFilesTable.modpackVersionFileId, previousVersionFileId));
    
    // Crear un mapa de los archivos previos para acceso rápido
    const prevFilesMap = new Map(previousFiles.map(f => [f.path, f]));
    
    // Crear un nuevo ZIP con los archivos combinados
    const zip = new JSZip();
    
    // Descargar y añadir archivos actuales desde R2
    for (const file of currentFiles) {
      try {
        // Construir la clave para R2 donde estaría el archivo individual
        const key = `${modpackId}/${modpackVersion[0].id}/${currentVersionFile.type}/individual/${file.hash}`;
        const content = await this.getFile(key);
        zip.file(file.path, content);
      } catch (err) {
        console.error(`Error al obtener el archivo individual:`, err);
        
        // Intentamos extraerlo del ZIP completo (opcional)
        try {
          const zipKey = `${modpackId}/${modpackVersion[0].id}/${currentVersionFile.type}/${currentVersionFile.hash}.zip`;
          const zipContent = await this.getFile(zipKey);
          const originalZip = await JSZip.loadAsync(zipContent);
          
          // Buscar el archivo por su ruta relativa
          const fileContent = await originalZip.file(file.path)?.async('nodebuffer');
          if (fileContent) {
            zip.file(file.path, fileContent);
          }
        } catch (zipErr) {
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
          const content = await this.getFile(key);
          zip.file(prevFile.path, content);
        } catch (err) {
          console.error(`Error al obtener archivo anterior:`, err);
          
          // Intentamos extraerlo del ZIP completo de la versión anterior
          try {
            const zipKey = `${modpackId}/${previousVersions[0].id}/${currentVersionFile.type}/${previousVersionFiles[0].hash}.zip`;
            const zipContent = await this.getFile(zipKey);
            const originalZip = await JSZip.loadAsync(zipContent);
            
            const fileContent = await originalZip.file(prevFile.path)?.async('nodebuffer');
            if (fileContent) {
              zip.file(prevFile.path, fileContent);
            }
          } catch (zipErr) {
            console.error(`Error al extraer del ZIP anterior:`, zipErr);
          }
        }
      }
    }
    
    // Generar el ZIP final
    return await zip.generateAsync({ type: 'nodebuffer' });
  }

  /**
   * Verifica si un usuario tiene permiso para subir archivos al modpack
   */
  public async checkUploadPermission(userId: string, modpackId: string): Promise<boolean> {
    // Esta función verificaría los permisos en las tablas PublisherMembersTable y ModpackPermissionsTable
    // Por simplicidad, retornamos true en este ejemplo
    return true;
  }
}

// Exportamos una instancia configurada del servicio
export const modpackFileService = new ModpackFileUploadService(process.env.STORAGE_PATH || './storage');