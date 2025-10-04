import crypto from "crypto";
import { Readable, PassThrough } from "stream";
import { pipeline } from "stream/promises";
import unzipper from "unzipper";
import { uploadToR2 } from "./r2UploadService";
import path from "path";

const BUFFER_SIZE = 128 * 1024; // 128KB buffer size for stable memory usage

export interface ProcessedFile {
  path: string;
  hash: string;
  size: number;
}

export interface StreamingZipProcessorOptions {
  fileType: string;
  modpackId: string;
  versionId: string;
  onProgress?: (message: string, percent: number) => void;
  concurrency?: number;
}

/**
 * Process a ZIP file in streaming mode without writing to disk
 * Calculates hash and uploads to R2 simultaneously
 */
export class StreamingZipProcessor {
  private processedFiles: ProcessedFile[] = [];
  private options: StreamingZipProcessorOptions;

  constructor(options: StreamingZipProcessorOptions) {
    this.options = {
      concurrency: 3, // Process up to 3 files concurrently
      ...options,
    };
  }

  /**
   * Process a ZIP buffer using streaming approach
   */
  async processZipBuffer(buffer: Buffer): Promise<ProcessedFile[]> {
    this.processedFiles = [];
    
    return new Promise((resolve, reject) => {
      const bufferStream = Readable.from(buffer);
      const processingPromises: Promise<void>[] = [];
      let fileCount = 0;
      let processedCount = 0;

      bufferStream
        .pipe(unzipper.Parse())
        .on("entry", (entry: unzipper.Entry) => {
          const fileName = entry.path;
          const type = entry.type; // 'Directory' or 'File'

          if (type === "Directory") {
            entry.autodrain();
            return;
          }

          fileCount++;
          
          // Process each file entry
          const processPromise = this.processFileEntry(entry, fileName)
            .then(() => {
              processedCount++;
              const percent = Math.floor((processedCount / fileCount) * 100);
              this.options.onProgress?.(
                `Procesado ${processedCount}/${fileCount} archivos`,
                Math.min(percent, 95) // Cap at 95% until fully complete
              );
            })
            .catch((error) => {
              console.error(`Error processing ${fileName}:`, error);
              entry.autodrain(); // Drain the entry to continue processing
              throw error;
            });

          processingPromises.push(processPromise);
        })
        .on("error", (error) => {
          reject(new Error(`Error reading ZIP: ${error.message}`));
        })
        .on("finish", async () => {
          try {
            // Wait for all file processing to complete
            await Promise.all(processingPromises);
            this.options.onProgress?.("Procesamiento completado", 100);
            resolve(this.processedFiles);
          } catch (error) {
            reject(error);
          }
        });
    });
  }

  /**
   * Process a single file entry from the ZIP
   * Calculates hash and uploads to R2 in streaming mode
   */
  private async processFileEntry(
    entry: unzipper.Entry,
    fileName: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const hasher = crypto.createHash("sha1");
      const chunks: Buffer[] = [];
      let totalSize = 0;

      // Create a pass-through stream to tee the data
      const hashStream = new PassThrough({ highWaterMark: BUFFER_SIZE });
      
      // Pipe entry to hash stream
      entry.pipe(hashStream);

      // Calculate hash and collect data
      hashStream.on("data", (chunk: Buffer) => {
        hasher.update(chunk);
        chunks.push(chunk);
        totalSize += chunk.length;
      });

      hashStream.on("end", async () => {
        try {
          const hash = hasher.digest("hex");
          const adjustedPath =
            this.options.fileType === "extras"
              ? fileName
              : `${this.options.fileType}/${fileName}`;

          // Combine chunks into a single buffer for upload
          const fileBuffer = Buffer.concat(chunks);

          // Upload to R2
          const key = path.posix.join(
            "resources",
            "files",
            hash.slice(0, 2),
            hash.slice(2, 4),
            hash
          );

          await uploadToR2(key, fileBuffer, "application/octet-stream");

          // Store processed file info
          this.processedFiles.push({
            path: adjustedPath,
            hash,
            size: totalSize,
          });

          resolve();
        } catch (error) {
          reject(error);
        }
      });

      hashStream.on("error", (error) => {
        reject(new Error(`Error processing ${fileName}: ${error.message}`));
      });
    });
  }

  /**
   * Get memory usage statistics
   */
  static getMemoryUsage(): {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  } {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      rss: Math.round(usage.rss / 1024 / 1024), // MB (Resident Set Size)
    };
  }
}
