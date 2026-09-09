'use client';

/**
 * T5.2 — the legend, always visible.
 *
 * Three encodings need explaining, and a map whose legend is behind a toggle is
 * a map most people read wrong.
 */
import { useState } from 'react';
import { AGE_BANDS, CATEGORIES, CONDITIONS } from '@/lib/constants';
import { renderMarker } from '@/lib/client/markers';

function ShapeSwatch({ shape, color }: { shape: string; color: string }) {
  const [dataUrl] = useState(() => {
    if (typeof document === 'undefined') return '';
    const image = renderMarker(shape as never, color);
    if (!image) return '';
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d')?.putImageData(image, 0, 0);
    return canvas.toDataURL();
  });

  return dataUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dataUrl} alt="" aria-hidden className="size-5" />
  ) : (
    <span className="size-3 rounded-full" style={{ backgroundColor: color }} />
  );
}

export function MapLegend() {
  const [open, setOpen] = useState(true);

  return (
    <div className="pointer-events-auto max-w-64 rounded-lg border border-stone-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur">
      <button
        type="button"
        className="mb-2 flex w-full items-center justify-between font-semibold"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        Legend
        <span aria-hidden>{open ? '−' : '+'}</span>
      </button>

      {open ? (
        <div className="space-y-3">
          <div>
            <p className="mb-1 font-semibold text-stone-500">Colour — condition</p>
            <ul className="space-y-1">
              {CONDITIONS.map((entry) => (
                <li key={entry.value} className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full ring-1 ring-black/20"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.label}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1 font-semibold text-stone-500">Shape — category</p>
            <ul className="space-y-1">
              {CATEGORIES.map((entry) => (
                <li key={entry.value} className="flex items-center gap-2">
                  <ShapeSwatch shape={entry.shape} color="#6b7280" />
                  {entry.label}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1 font-semibold text-stone-500">Size — age</p>
            <ul className="flex items-end gap-3">
              {AGE_BANDS.filter((entry) => entry.value !== 'UNKNOWN').map((entry) => (
                <li key={entry.value} className="flex flex-col items-center gap-1">
                  <span
                    className="rounded-full bg-stone-400 ring-1 ring-black/20"
                    style={{ width: entry.radius * 2, height: entry.radius * 2 }}
                  />
                  {entry.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
