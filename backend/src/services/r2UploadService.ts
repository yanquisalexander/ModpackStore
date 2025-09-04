import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

interface UploadReturn {
    url: string;
    cdnUrl?: string;
}

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_CDN_URL = process.env.R2_CDN_URL || "";

if (!R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
    throw new Error("Missing R2 configuration in environment variables");
}

export const DOWNLOAD_PREFIX_URL = R2_CDN_URL ? new URL('resources/files/', R2_CDN_URL).toString() : new URL('resources/files/', R2_ENDPOINT).toString();

const s3Client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});

export async function uploadToR2(
    key: string,
    body: Buffer | Readable,
    contentType: string
): Promise<UploadReturn> {
    try {
        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            Body: body,
            ContentType: contentType,
        });

        await s3Client.send(command);

        return {
            cdnUrl: R2_CDN_URL ? new URL(key, R2_CDN_URL).toString() : "",
            url: new URL(key, R2_ENDPOINT).toString(),
        };
    } catch (error) {
        console.error("Error uploading to R2:", error);
        throw new Error("Failed to upload file to R2");
    }
}

export async function batchUploadToR2(
    uploads: { key: string; body: Buffer | Readable; contentType: string }[],
    concurrency = 5
): Promise<UploadReturn[]> {
    const results: UploadReturn[] = [];
    const semaphore = new Semaphore(concurrency);

    const promises = uploads.map(async (upload) => {
        await semaphore.acquire();
        try {
            const result = await uploadToR2(upload.key, upload.body, upload.contentType);
            results.push(result);
        } finally {
            semaphore.release();
        }
    });

    await Promise.all(promises);
    return results;
}

// Simple semaphore for concurrency control
class Semaphore {
    private permits: number;
    private waitQueue: (() => void)[] = [];

    constructor(permits: number) {
        this.permits = permits;
    }

    async acquire() {
        if (this.permits > 0) {
            this.permits--;
            return;
        }
        return new Promise<void>((resolve) => {
            this.waitQueue.push(resolve);
        });
    }

    release() {
        this.permits++;
        if (this.waitQueue.length > 0) {
            const resolve = this.waitQueue.shift()!;
            this.permits--;
            resolve();
        }
    }
}

export async function deleteFromR2(key: string): Promise<void> {
    try {
        const command = new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
        });

        await s3Client.send(command);
    } catch (error) {
        console.error("Error deleting from R2:", error);
        throw new Error("Failed to delete file from R2");
    }
}

export async function batchDeleteFromR2(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    try {
        // R2 supports deleting up to 1000 objects at once
        const chunks = [];
        for (let i = 0; i < keys.length; i += 1000) {
            chunks.push(keys.slice(i, i + 1000));
        }

        for (const chunk of chunks) {
            const command = new DeleteObjectsCommand({
                Bucket: R2_BUCKET_NAME,
                Delete: {
                    Objects: chunk.map(key => ({ Key: key })),
                    Quiet: true
                }
            });

            await s3Client.send(command);
        }
    } catch (error) {
        console.error("Error batch deleting from R2:", error);
        throw new Error("Failed to batch delete files from R2");
    }
}
