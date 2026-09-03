import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FetchHttpHandler } from "@smithy/fetch-http-handler";

const accountId = Deno.env.get("R2_ACCOUNT_ID") ?? "";
const bucket = Deno.env.get("R2_BUCKET") ?? "";
const publicDomain = Deno.env.get("R2_PUBLIC_DOMAIN") ?? "";

if (!accountId || !bucket) {
    throw new Error("Missing R2 configuration: R2_ACCOUNT_ID and R2_BUCKET must be set");
}

let client: S3Client | null = null;

export function getS3Client(): S3Client {
    if (!client) {
        client = new S3Client({
            region: "auto",
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
                secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
            },
            requestHandler: new FetchHttpHandler({}),
        });
    }
    return client;
}

export function getTempZipKey(modpackId: string, versionId: string, fileType: string): string {
    return `temp-zips/${modpackId}/${versionId}/${fileType}`;
}

export function getFileKey(hash: string): string {
    return `resources/files/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}`;
}

export function getPublicUrl(hash: string): string {
    if (publicDomain) {
        return `${publicDomain}/${getFileKey(hash)}`;
    }
    return getFileKey(hash);
}

export function getModpackImageKey(modpackId: string, type: 'icon' | 'banner'): string {
    return `modpack-images/${modpackId}/${type}`;
}

export function getModpackImageUrl(modpackId: string, type: 'icon' | 'banner'): string {
    const key = getModpackImageKey(modpackId, type);
    const ts = Date.now();
    return publicDomain ? `${publicDomain}/${key}?t=${ts}` : `${key}?t=${ts}`;
}

export function getCreatorImageKey(creatorId: string, type: 'logo' | 'banner'): string {
    return `creator-images/${creatorId}/${type}`;
}

export function getCreatorImageUrl(creatorId: string, type: 'logo' | 'banner'): string {
    const key = getCreatorImageKey(creatorId, type);
    const ts = Date.now();
    return publicDomain ? `${publicDomain}/${key}?t=${ts}` : `${key}?t=${ts}`;
}

export async function generatePresignedUploadUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
    });
    return getSignedUrl(getS3Client(), command, { expiresIn });
}

export async function downloadObject(key: string): Promise<Uint8Array> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await getS3Client().send(command);
    return response.Body!.transformToByteArray();
}

export async function uploadObject(key: string, body: Uint8Array, contentType?: string) {
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
    });
    await getS3Client().send(command);
}

export async function deleteObject(key: string) {
    const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
    await getS3Client().send(command);
}

export async function cleanupOldTempZips(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
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
        const listed = await getS3Client().send(listCmd);

        for (const obj of listed.Contents ?? []) {
            if (obj.LastModified && obj.LastModified < cutoff) {
                try {
                    await deleteObject(obj.Key!);
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
