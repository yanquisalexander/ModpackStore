import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = Deno.env.get("R2_ACCOUNT_ID") ?? "";
const bucket = Deno.env.get("R2_BUCKET") ?? "";
const publicDomain = Deno.env.get("R2_PUBLIC_DOMAIN") ?? "";

if (!accountId || !bucket) {
    throw new Error("Missing R2 configuration: R2_ACCOUNT_ID and R2_BUCKET must be set");
}

let client: S3Client | null = null;

function getS3Client(): S3Client {
    if (!client) {
        client = new S3Client({
            region: "auto",
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
                secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
            },
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
