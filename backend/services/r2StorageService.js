import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

let client = null;

function requiredEnvironmentValue(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required for Cloudflare R2 storage.`);
  return value;
}

function r2Config() {
  return {
    accountId: requiredEnvironmentValue("R2_ACCOUNT_ID"),
    accessKeyId: requiredEnvironmentValue("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnvironmentValue("R2_SECRET_ACCESS_KEY"),
    bucketName: requiredEnvironmentValue("R2_BUCKET_NAME"),
  };
}

function r2Client() {
  if (client) return client;
  const config = r2Config();
  client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return client;
}

export async function uploadDatasetObject({
  storageKey,
  buffer,
  mimeType,
  contentHash,
}) {
  if (!storageKey || !Buffer.isBuffer(buffer)) {
    throw new TypeError("A storage key and file buffer are required for R2 upload.");
  }
  const { bucketName } = r2Config();
  await r2Client().send(new PutObjectCommand({
    Bucket: bucketName,
    Key: storageKey,
    Body: buffer,
    ContentLength: buffer.length,
    ContentType: mimeType || "application/octet-stream",
    Metadata: contentHash ? { sha256: contentHash } : undefined,
  }));
}

export async function getDatasetObject(storageKey) {
  if (!storageKey) throw new TypeError("A storage key is required for R2 download.");
  const { bucketName } = r2Config();
  return r2Client().send(new GetObjectCommand({
    Bucket: bucketName,
    Key: storageKey,
  }));
}

export async function deleteDatasetObject(storageKey) {
  if (!storageKey) return;
  const { bucketName } = r2Config();
  await r2Client().send(new DeleteObjectCommand({
    Bucket: bucketName,
    Key: storageKey,
  }));
}
