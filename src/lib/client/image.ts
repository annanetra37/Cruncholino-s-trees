/**
 * T6.2 — downscale before upload.
 *
 * A modern phone camera produces 4–6 MB per photo. Uploading that raw over a
 * rural data connection is hostile to the person doing the survey, and the
 * dashboard never displays anything larger than about 1600 px anyway.
 *
 * Re-encoding through a canvas also drops every EXIF tag, which is the desired
 * behaviour once `readExifLocation` has taken the two fields that matter: the
 * photo stops carrying the contributor's camera serial number and original
 * GPS trace into a public bucket.
 */
export const MAX_DIMENSION = 1600;
export const TARGET_TYPE = 'image/jpeg';

export type ResizedImage = {
  blob: Blob;
  width: number;
  height: number;
  previewUrl: string;
};

export async function resizeImage(file: File, maxDimension = MAX_DIMENSION): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot process images');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, TARGET_TYPE, 0.82),
  );
  if (!blob) throw new Error('Could not compress that photo');

  return { blob, width, height, previewUrl: URL.createObjectURL(blob) };
}
