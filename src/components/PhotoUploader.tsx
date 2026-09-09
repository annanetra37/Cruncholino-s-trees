'use client';

/**
 * T6.1 / T6.2 — photos.
 *
 * The browser resizes, then uploads straight to R2 with a presigned URL. GPS
 * and timestamp are read out of the original file first (T4.1 fallback 2) and
 * handed back to the form; everything else in the EXIF block is discarded by
 * the canvas re-encode, so camera serial numbers and original GPS traces do not
 * end up in a public bucket.
 */
import { useCallback, useRef, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { readExifLocation } from '@/lib/client/exif';
import { resizeImage } from '@/lib/client/image';

export type UploadedPhoto = {
  storageKey: string;
  width: number;
  height: number;
  bytes: number;
  takenAt: string | null;
  previewUrl: string;
};

type Props = {
  photos: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  onExifLocation?: (location: { latitude: number; longitude: number }) => void;
  disabled?: boolean;
};

export function PhotoUploader({ photos, onChange, onExifLocation, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setBusy(true);
      setError(null);

      const accepted: UploadedPhoto[] = [];

      try {
        for (const file of Array.from(files).slice(0, 5)) {
          // Read EXIF from the original — resizing destroys it.
          const exif = await readExifLocation(file);
          if (exif && onExifLocation) {
            onExifLocation({ latitude: exif.latitude, longitude: exif.longitude });
          }

          const resized = await resizeImage(file);

          const ticket = await apiFetch<{ key: string; uploadUrl: string }>(
            '/api/photos/upload-url',
            {
              method: 'POST',
              body: JSON.stringify({
                contentType: 'image/jpeg',
                contentLength: resized.blob.size,
              }),
            },
          );

          const response = await fetch(ticket.uploadUrl, {
            method: 'PUT',
            body: resized.blob,
            headers: { 'content-type': 'image/jpeg' },
          });
          if (!response.ok) throw new Error(`Upload failed (${response.status})`);

          accepted.push({
            storageKey: ticket.key,
            width: resized.width,
            height: resized.height,
            bytes: resized.blob.size,
            takenAt: exif?.takenAt?.toISOString() ?? null,
            previewUrl: resized.previewUrl,
          });
        }

        onChange([...photos, ...accepted]);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Upload failed';
        // Storage being unconfigured is a deployment fact, not a user error.
        if (message.includes('not configured')) setUnavailable(true);
        setError(message);
      } finally {
        setBusy(false);
        if (input.current) input.current.value = '';
      }
    },
    [onChange, onExifLocation, photos],
  );

  if (unavailable) {
    return (
      <p className="rounded-lg border border-stone-300 bg-stone-50 p-3 text-sm text-stone-600">
        Photo upload is not configured on this deployment. Everything else still works.
      </p>
    );
  }

  return (
    <div>
      <span className="field-label">Photos</span>

      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => (
          <div key={photo.storageKey} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.previewUrl}
              alt="Uploaded tree"
              className="size-20 rounded-lg object-cover"
            />
            <button
              type="button"
              aria-label="Remove photo"
              className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-stone-800 text-xs text-white"
              onClick={() => onChange(photos.filter((entry) => entry !== photo))}
            >
              ✕
            </button>
          </div>
        ))}

        <button
          type="button"
          className="flex size-20 flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-300 text-sm text-stone-500 hover:border-stone-400 disabled:opacity-50"
          onClick={() => input.current?.click()}
          disabled={disabled || busy}
        >
          {busy ? '…' : '+ Photo'}
        </button>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        // `capture` opens the camera directly on a phone, which is what someone
        // standing in front of the tree actually wants.
        capture="environment"
        multiple
        className="sr-only"
        onChange={(event) => handleFiles(event.target.files)}
      />

      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      <p className="mt-1 text-xs text-stone-500">
        Photos are resized to 1600 px in your browser before upload.
      </p>
    </div>
  );
}
