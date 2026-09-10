'use client';

/**
 * Basemap resolution with a fallback.
 *
 * `NEXT_PUBLIC_MAP_STYLE_URL` is baked into the bundle at build time, so a URL
 * that is wrong, points at a dead provider, or carries a rejected key cannot be
 * corrected without a rebuild — and until it is, MapLibre draws an empty
 * background and the whole app looks broken. A blank basemap is not a cosmetic
 * problem here: you cannot drag a pin onto a tree you cannot see.
 *
 * So a configured provider style is fetched once before the map is built, and
 * if it does not come back the built-in OpenStreetMap style takes over. The
 * default path — no variable set — resolves synchronously and never probes, so
 * the common case pays nothing.
 */
import type { StyleSpecification } from 'maplibre-gl';
import { builtInMapStyle, publicConfig } from '@/lib/public-config';

export type MapStyle = StyleSpecification | string;

/**
 * The style to build the map with, or `null` when a configured provider style
 * still has to be probed. Callers hold off on constructing the map until this
 * resolves, which is at most one round trip and only when a URL is configured.
 */
export function initialMapStyle(): MapStyle | null {
  return typeof publicConfig.mapStyle === 'string' ? null : publicConfig.mapStyle;
}

let probe: Promise<MapStyle> | null = null;

/** Memoised so the dashboard's map and the capture map share one probe. */
export function resolveMapStyle(): Promise<MapStyle> {
  if (probe) return probe;
  const configured = publicConfig.mapStyle;
  if (typeof configured !== 'string') {
    probe = Promise.resolve(configured);
    return probe;
  }
  probe = fetch(configured, { mode: 'cors' })
    .then((response) => (response.ok ? configured : builtInMapStyle))
    // A network error, a CORS rejection or a DNS failure all land here, and
    // every one of them means the same thing: this style will not render.
    .catch(() => builtInMapStyle);
  return probe;
}
