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
  existingHashes?: Set<string>; // Skip uploading files with these hashes
}

/**
 * Simple semaphore for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waitQueue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!;
      this.permits--;
      resolve();
    }
  }
}

/**
 * Process a ZIP file in streaming mode without writing to disk
 * Calculates hash and uploads to R2 simultaneously
 */
export class StreamingZipProcessor {
  private processedFiles: ProcessedFile[] = [];
  private options: StreamingZipProcessorOptions;
  private semaphore: Semaphore;

  constructor(options: StreamingZipProcessorOptions) {
    this.options = {
      concurrency: 3, // Process up to 3 files concurrently
      ...options,
    };
    this.semaphore = new Semaphore(this.options.concurrency!);
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
          
          // Process each file entry with concurrency control
          const processPromise = (async () => {
            await this.semaphore.acquire();
            try {
              await this.processFileEntry(entry, fileName);
              processedCount++;
              const percent = Math.floor((processedCount / fileCount) * 100);
              this.options.onProgress?.(
                `Procesado ${processedCount}/${fileCount} archivos`,
                Math.min(percent, 95) // Cap at 95% until fully complete
              );
            } catch (error) {
              console.error(`Error processing ${fileName}:`, error);
              throw error;
            } finally {
              this.semaphore.release();
            }
          })();

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
   * 
   * Note: Currently buffers file data due to S3 SDK requirements.
   * For truly streaming uploads without buffering, we would need to use
   * multipart uploads with unknown content length, which is more complex.
   */
  private async processFileEntry(
    entry: unzipper.Entry,
    fileName: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const hasher = crypto.createHash("sha1");
      const chunks: Buffer[] = [];
      let totalSize = 0;

      // Process data chunks as they arrive
      entry.on("data", (chunk: Buffer) => {
        // Update hash incrementally
        hasher.update(chunk);
        chunks.push(chunk);
        totalSize += chunk.length;
      });

      entry.on("end", async () => {
        try {
          const hash = hasher.digest("hex");
          const adjustedPath =
            this.options.fileType === "extras"
              ? fileName
              : `${this.options.fileType}/${fileName}`;

          // Combine chunks into a single buffer for upload
          const fileBuffer = Buffer.concat(chunks);

          // Upload to R2 only if file doesn't already exist
          const shouldUpload = !this.options.existingHashes?.has(hash);
          if (shouldUpload) {
            try {
              const key = path.posix.join(
                "resources",
                "files",
                hash.slice(0, 2),
                hash.slice(2, 4),
                hash
              );

              await uploadToR2(key, fileBuffer, "application/octet-stream");
            } catch (uploadError) {
              // Log upload errors but don't fail the entire process
              // The file might already exist in R2 but not in our DB
              console.warn(`Upload warning for ${fileName} (${hash}):`, uploadError);
            }
          }

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

      entry.on("error", (error) => {
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
