/**
 * T6.1 — issues a presigned PUT so the browser uploads straight to R2.
 */
import { z } from 'zod';
import { json, readJson, route } from '@/lib/api';
import { requireUser } from '@/lib/authz';
import { enforceWriteLimit } from '@/lib/rate-limit';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  buildStorageKey,
  presignUpload,
  publicUrlFor,
  storageEnabled,
} from '@/lib/storage/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  contentType: z.enum(ALLOWED_IMAGE_TYPES),
  // Checked here and again in the presigned command: the signature pins
  // ContentLength, so an oversized body is rejected by R2 as well.
  contentLength: z.coerce.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export const GET = route('photos.upload-url.status', async () =>
  json({ enabled: storageEnabled() }),
);

export const POST = route('photos.upload-url', async (request) => {
  const user = await requireUser();
  enforceWriteLimit(request, user.id, 'photos.upload');

  const input = schema.parse(await readJson(request));
  const key = buildStorageKey(user.id, input.contentType);
  const uploadUrl = await presignUpload({
    key,
    contentType: input.contentType,
    contentLength: input.contentLength,
  });

  return json({ key, uploadUrl, publicUrl: publicUrlFor(key), expiresInSeconds: 600 });
});
