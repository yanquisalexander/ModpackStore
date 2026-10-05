import { log } from "@/lib/logger.ts";
import { getWorkerProfile } from "@/lib/auto-tune.ts";

// ============================================================================
// Helpers puros (strings) – NO usan aws-sdk. Importa desde aquí si solo
// necesitas generatePresignedUploadUrl u otras funciones relacionadas con S3.
// ============================================================================

export {
    getTempZipKey,
    getFileKey,
    getPublicUrl,
    getModpackImageKey,
    getModpackImageUrl,
    getModpackImageResizedKey,
    getModpackImageResizedUrl,
    getCreatorImageKey,
    getCreatorImageUrl,
    getCreatorAssetKey,
    getCreatorAssetUrl,
    getUserSkinKey,
    getUserSkinUrl,
    getUserCapeKey,
    getUserCapeUrl,
} from "@/lib/r2-keys.ts";

// Config lazy – no bloquear importación.
function getEnv(): { accountId: string; bucket: string; publicDomain: string } {
    const accountId = Deno.env.get("R2_ACCOUNT_ID") ?? "";
    const bucket = Deno.env.get("R2_BUCKET") ?? "";
    const publicDomain = Deno.env.get("R2_PUBLIC_DOMAIN") ?? "";
    if (!accountId || !bucket) {
        throw new Error("R2 missing in environment");
    }
    return { accountId, bucket, publicDomain };
}

let _s3Client: any = null;

async function getS3Client() {
    if (!_s3Client) {
        const { accountId, bucket, publicDomain } = getEnv();
        // Lazy imports solo cuando realmente se necesita.
        const { S3Client } = await import("@aws-sdk/client-s3");
        const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
        const { FetchHttpHandler: SmithyFetchHttpHandler } = await import("@smithy/fetch-http-handler");
        _s3Client = new S3Client({
            region: "auto",
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            forcePathStyle: true,
            credentials: {
                accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
                secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
            },
            requestHandler: new SmithyFetchHttpHandler({}),
            requestChecksumCalculation: "WHEN_REQUIRED",
            responseChecksumValidation: "WHEN_REQUIRED",
        });
    }
    return _s3Client;
}

export async function generatePresignedUploadUrl(key: string, expiresIn = 3600): Promise<string> {
    const { bucket } = getEnv();
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await getS3Client();
    const command = new PutObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(client, command, { expiresIn });
}

export async function downloadObject(key: string): Promise<Uint8Array> {
    const { bucket } = getEnv();
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await client.send(command);
    return response.Body!.transformToByteArray();
}

export async function uploadObject(key: string, body: Uint8Array, contentType?: string) {
    const { bucket } = getEnv();
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
    });
    await client.send(command);
}

export async function deleteObject(key: string) {
    const { bucket } = getEnv();
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();
    const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
    try {
        await client.send(command);
    } catch (err: any) {
        if (err?.name === "InternalError" || err?.message?.includes("stream")) {
            log(`[R2] deleteObject stream error (non-fatal) for key: ${key}`);
            return;
        }
        throw err;
    }
}

export async function fileExists(key: string): Promise<boolean> {
    const { bucket } = getEnv();
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();
    const command = new HeadObjectCommand({ Bucket: bucket, Key: key });
    try {
        await client.send(command);
        return true;
    } catch (err: any) {
        if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) return false;
        throw err;
    }
}

export async function getObjectMeta(key: string): Promise<{ size: number; contentType?: string } | null> {
    const { bucket } = getEnv();
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();
    const command = new HeadObjectCommand({ Bucket: bucket, Key: key });
    try {
        const res = await client.send(command);
        const size = Number(res.ContentLength ?? 0);
        if (!Number.isFinite(size)) return null;
        return { size, contentType: res.ContentType };
    } catch (err: any) {
        if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) return null;
        throw err;
    }
}

export async function cleanupOldTempZips(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const { bucket } = getEnv();
    const { ListObjectsV2Command, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();
    const prefix = "temp-zips/";
    const cutoff = new Date(Date.now() - maxAgeMs);
    let deleted = 0;
    let continuationToken: string | undefined;

    do {
        const listCmd = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
        });
        const listed = await client.send(listCmd);

        for (const obj of listed.Contents ?? []) {
            if (obj.LastModified && obj.LastModified < cutoff) {
                try {
                    const delCmd = new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key! });
                    await client.send(delCmd);
                    deleted++;
                } catch {
                    // Best effort
                }
            }
        }

        continuationToken = listed.NextContinuationToken;
    } while (continuationToken);

    return deleted;
}

export async function downloadObjectToFile(key: string, destinationPath: string): Promise<void> {
    const { bucket } = getEnv();
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await client.send(command);

    if (!response.Body) throw new Error(`Empty body returned from R2 for key: ${key}`);

    const body = response.Body as unknown as {
        pipeTo?: (dest: WritableStream) => Promise<void>;
        transformToByteArray: () => Promise<Uint8Array>;
    };
    if (body.pipeTo) {
        const destFile = await Deno.open(destinationPath, { write: true, create: true, truncate: true });
        try {
            await body.pipeTo(destFile.writable);
        } finally {
            try { destFile.close(); } catch { /* pipeTo already closed it */ }
        }
    } else {
        const bytes = await body.transformToByteArray();
        const destFile = await Deno.open(destinationPath, { write: true, create: true, truncate: true });
        try {
            await destFile.write(bytes);
        } finally {
            destFile.close();
        }
    }
}

// NOTA: no usar Body como ReadableStream con el S3Client en Deno.
// El signer genera firma con payload chunked (STREAMING-AWS4-...) que R2
// rechaza con "signature does not match" (ver commits 386a15a / 7615ef6).
// Por eso uploadFileFromPath bufferiza. Se mantiene por compatibilidad,
// pero su uso directo contra R2 falla.
export async function uploadStreamObject(key: string, stream: ReadableStream, contentType?: string, _contentLength?: number): Promise<void> {
    const { bucket } = getEnv();
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: stream,
        ContentType: contentType,
    });
    await client.send(command);
}

// Sube un archivo local a R2. Bufferiza en RAM (firma SigV4 correcta).
// Solo archivos enormes (>100 MB, rarísimos como entries de mod) van por
// PUT presignado + fetch, que no firma el payload y admite streaming.
const HUGE_FILE_BYTES = 100 * 1024 * 1024;

export async function uploadFileFromPath(key: string, filePath: string, contentType?: string): Promise<void> {
    const stat = await Deno.stat(filePath);

    if (stat.size > HUGE_FILE_BYTES) {
        const uploadUrl = await generatePresignedUploadUrl(key, 3600);
        const file = await Deno.open(filePath, { read: true });
        try {
            const res = await fetch(uploadUrl, { method: "PUT", body: file.readable });
            if (!res.ok) {
                throw new Error(`Presigned PUT failed: ${res.status} ${res.statusText}`);
            }
            await res.arrayBuffer(); // drenar
        } finally {
            try { file.close(); } catch { /* el stream ya lo cerró */ }
        }
        return;
    }

    const body = await Deno.readFile(filePath);
    await uploadObject(key, body, contentType);
}

export async function batchUploadFromPaths(
    uploadList: Array<{ key: string; filePath: string; contentType?: string }>,
    concurrency?: number,
): Promise<{ uploaded: number; skipped: number }> {
    const limit = concurrency ?? getWorkerProfile().uploadConcurrency;
    let uploaded = 0;
    let skipped = 0;

    for (let i = 0; i < uploadList.length; i += limit) {
        const batch = uploadList.slice(i, i + limit);

        await Promise.all(batch.map(async (upload) => {
            try {
                await uploadFileFromPath(upload.key, upload.filePath, upload.contentType);
                uploaded++;
            } catch (err) {
                log(`  [ERROR] Failed to upload ${upload.key}: ${err instanceof Error ? err.message : String(err)}`);
                skipped++;
            }
        }));
    }

    return { uploaded, skipped };
}
