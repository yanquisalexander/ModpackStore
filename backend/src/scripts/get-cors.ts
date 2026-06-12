import { S3Client, GetBucketCorsCommand } from "@aws-sdk/client-s3";

const accountId = Deno.env.get("R2_ACCOUNT_ID")!;
const bucket = Deno.env.get("R2_BUCKET")!;
const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")!;
const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY")!;

const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
});

try {
    const result = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    console.log(JSON.stringify(result.CORSRules, null, 2));
} catch (e: any) {
    if (e.name === "NoSuchCORSConfiguration") {
        console.log("No CORS configuration exists on this bucket.");
    } else {
        console.error("Error:", e.name, e.message);
    }
}
