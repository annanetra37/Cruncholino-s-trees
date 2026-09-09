/**
 * Client-safe configuration.
 *
 * `src/env.ts` is server-only — it reads secrets and calls `process.exit` on a
 * bad value, neither of which belongs in a browser bundle. Anything a client
 * component needs comes from here, and only `NEXT_PUBLIC_*` variables are ever
 * referenced, statically, so Next can inline them at build time.
 */
function parseCenter(raw: string | undefined): [number, number] {
  const parts = (raw ?? '').split(',').map((p) => Number.parseFloat(p.trim()));
  const lng = parts[0];
  const lat = parts[1];
  if (parts.length !== 2 || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    return [44.5152, 40.1872]; // Yerevan
  }
  return [lng as number, lat as number];
}

const styleUrl =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL || 'https://demotiles.maplibre.org/style.json';
const tilesKey = process.env.NEXT_PUBLIC_MAP_TILES_KEY;

export const publicConfig = {
  /** Map style URL, with the tile key appended when the provider needs one. */
  mapStyleUrl:
    tilesKey && !styleUrl.includes('key=')
      ? `${styleUrl}${styleUrl.includes('?') ? '&' : '?'}key=${tilesKey}`
      : styleUrl,
  mapDefaultCenter: parseCenter(process.env.NEXT_PUBLIC_MAP_DEFAULT_CENTER),
  mapDefaultZoom: Number.parseFloat(process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM ?? '11') || 11,
} as const;
