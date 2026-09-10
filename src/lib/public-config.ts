/**
 * Client-safe configuration.
 *
 * `src/env.ts` is server-only — it reads secrets and calls `process.exit` on a
 * bad value, neither of which belongs in a browser bundle. Anything a client
 * component needs comes from here, and only `NEXT_PUBLIC_*` variables are ever
 * referenced, statically, so Next can inline them at build time.
 */
import type { StyleSpecification } from 'maplibre-gl';

function parseCenter(raw: string | undefined): [number, number] {
  const parts = (raw ?? '').split(',').map((p) => Number.parseFloat(p.trim()));
  const lng = parts[0];
  const lat = parts[1];
  if (parts.length !== 2 || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    return [44.5152, 40.1872]; // Yerevan
  }
  return [lng as number, lat as number];
}

/**
 * The default basemap: OpenStreetMap's own raster tiles.
 *
 * Defined here as a style object rather than fetched from a provider, which
 * means the map has no API key, no account, no quota and no build-time
 * variable to get wrong. Every one of those has been a way for the map to end
 * up blank, and a blank basemap makes the capture flow unusable — you cannot
 * drag a pin onto a tree you cannot see.
 *
 * OSM's tile usage policy covers modest use like this and requires the
 * attribution below, which MapLibre renders from the source definition. If
 * this ever outgrows that policy, set NEXT_PUBLIC_MAP_STYLE_URL to a
 * commercial vector style and it takes over — see below.
 */
export const builtInMapStyle: StyleSpecification = {
  version: 8,
  // Raster styles carry no fonts of their own, and the map's cluster labels are
  // a symbol layer. Without this they fail to render — harmlessly, but the
  // counts vanish.
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

/**
 * Styles that are not usable basemaps, however well they load.
 *
 * MapLibre's demo style is a globe with country outlines and nothing above
 * about zoom 5. Point a city map at it and every tile request succeeds, no
 * error is raised, and the map paints a uniform pale fill — indistinguishable
 * from a broken map, and not something an error handler can catch. It shipped
 * as this app's own default and in `.env.example`, so it is very likely to be
 * sitting in a deployment's variables; treat it as unset rather than as a
 * choice anyone made.
 */
const UNUSABLE_STYLES = ['demotiles.maplibre.org'];

const configuredStyle = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();
const styleUrl =
  configuredStyle && !UNUSABLE_STYLES.some((host) => configuredStyle.includes(host))
    ? configuredStyle
    : undefined;
const tilesKey = process.env.NEXT_PUBLIC_MAP_TILES_KEY?.trim();

/**
 * A provider style is used only when one is explicitly configured. Unset the
 * variable and the map falls back to OSM and simply works — which is the
 * behaviour worth having as the default, since a misconfigured key fails
 * silently and looks like a broken app rather than a missing setting.
 */
function resolveStyle(): StyleSpecification | string {
  if (!styleUrl) return builtInMapStyle;
  if (!tilesKey || styleUrl.includes('key=')) return styleUrl;
  return `${styleUrl}${styleUrl.includes('?') ? '&' : '?'}key=${tilesKey}`;
}

export const publicConfig = {
  mapStyle: resolveStyle(),
  /** True when the basemap is the built-in one, i.e. nothing can be misconfigured. */
  mapUsesBuiltInStyle: !styleUrl,
  mapDefaultCenter: parseCenter(process.env.NEXT_PUBLIC_MAP_DEFAULT_CENTER),
  mapDefaultZoom: Number.parseFloat(process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM ?? '11') || 11,
} as const;
