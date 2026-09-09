/**
 * T6.1 — Cloudflare R2.
 *
 * The app server issues presigned URLs and never touches image bytes. Proxying
 * a 3 MB upload through a Next.js route would tie up a server request for the
 * length of a phone's upload on field data, for no benefit.
 *
 * R2 rather than a Railway volume: volumes are single-instance block storage,
 * not a durable object store, and they do not survive a service being
 * recreated. Photos are user data; they belong somewhere with its own
 * durability guarantees and no egress bill.
 */
import { PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Config } from '@/env';
import { ApiError } from '@/lib/api';

let cached: S3Client | null = null;

export function r2Client(): S3Client {
  const config = r2Config();
  if (!config) {
    throw new ApiError(503, 'Photo storage is not configured on this deployment', 'storage_disabled');
  }

  cached ??= new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return cached;
}

export function storageEnabled(): boolean {
  return r2Config() !== null;
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Keys are namespaced by user and date so that an orphan sweep can reason about
 * age, and so one contributor's uploads can be found without a full listing.
 */
export function buildStorageKey(userId: string, contentType: string): string {
  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const day = new Date().toISOString().slice(0, 10);
  return `trees/${day}/${userId}/${crypto.randomUUID()}.${extension}`;
}

export async function presignUpload(params: {
  key: string;
  contentType: string;
  contentLength: number;
}): Promise<string> {
  const config = r2Config()!;
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: params.key,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
  });
  // Long enough for a slow rural upload, short enough that a leaked URL is not
  // an open write handle on the bucket.
  return getSignedUrl(r2Client(), command, { expiresIn: 600 });
}

export function publicUrlFor(key: string): string {
  const config = r2Config();
  if (!config?.publicUrl) return '';
  return `${config.publicUrl.replace(/\/$/, '')}/${key}`;
}

export async function deleteObject(key: string): Promise<void> {
  const config = r2Config()!;
  await r2Client().send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

export async function* listObjects(prefix = 'trees/') {
  const config = r2Config()!;
  let token: string | undefined;

  do {
    const response = await r2Client().send(
      new ListObjectsV2Command({ Bucket: config.bucket, Prefix: prefix, ContinuationToken: token }),
    );
    for (const object of response.Contents ?? []) {
      if (object.Key) yield { key: object.Key, lastModified: object.LastModified };
    }
    token = response.NextContinuationToken;
  } while (token);
}
