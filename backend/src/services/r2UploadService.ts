import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
            cdnUrl: R2_CDN_URL ? `${R2_CDN_URL}/${key}` : "",
            url: `${R2_ENDPOINT}/${key}`,
        };
    } catch (error) {
        console.error("Error uploading to R2:", error);
        throw new Error("Failed to upload file to R2");
    }
}
