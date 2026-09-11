/**
 * Provider responses are shaped differently and none of them agree on what an
 * administrative level is called. Normalising here keeps that mess out of the
 * database and out of the dashboard's filters.
 */
import { canonicalRegion } from '@/lib/geocode/armenia';
export type NormalisedAddress = {
  addressLine: string | null;
  city: string | null;
  district: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  postalCode: string | null;
};

export const EMPTY_ADDRESS: NormalisedAddress = {
  addressLine: null,
  city: null,
  district: null,
  region: null,
  country: null,
  countryCode: null,
  postalCode: null,
};

function first(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Nominatim's `address` object. Note the fallback chain for `city`: a village
 * in Armenia comes back as `village`, a Yerevan address as `city`, and a
 * suburb-level result as `town` — treating only `city` as the city would leave
 * most rural trees unfilterable.
 */
export function normaliseNominatim(payload: unknown): NormalisedAddress {
  if (!payload || typeof payload !== 'object') return EMPTY_ADDRESS;
  const body = payload as Record<string, unknown>;
  const address = (body.address ?? {}) as Record<string, unknown>;

  const houseNumber = first(address.house_number);
  const road = first(address.road, address.pedestrian, address.footway);
  const street = [road, houseNumber].filter(Boolean).join(' ') || null;

  const countryCode = first(address.country_code)?.toUpperCase() ?? null;

  return {
    addressLine: first(street, body.display_name),
    city: first(address.city, address.town, address.village, address.municipality, address.hamlet),
    district: first(address.city_district, address.suburb, address.district, address.county),
    // Armenia's marzer arrive as `state`. The column stays generic; the value
    // is canonicalised so one province cannot appear under four spellings.
    region: canonicalRegion(first(address.state, address.region, address.province), countryCode),
    country: first(address.country),
    countryCode,
    postalCode: first(address.postcode),
  };
}

/**
 * Photon (Komoot's OSM geocoder). Free, needs no API key and no account, which
 * is why it is the fallback when Nominatim rate-limits — see
 * `src/lib/geocode/provider.ts`.
 */
export function normalisePhoton(payload: unknown): NormalisedAddress {
  if (!payload || typeof payload !== 'object') return EMPTY_ADDRESS;
  const body = payload as Record<string, unknown>;
  const features = Array.isArray(body.features) ? body.features : [];
  const feature = features[0] as Record<string, unknown> | undefined;
  if (!feature) return EMPTY_ADDRESS;

  const properties = (feature.properties ?? {}) as Record<string, unknown>;

  const street = [first(properties.street, properties.name), first(properties.housenumber)]
    .filter(Boolean)
    .join(' ');

  const countryCode = first(properties.countrycode)?.toUpperCase() ?? null;

  return {
    addressLine: street || first(properties.name),
    city: first(properties.city, properties.town, properties.village, properties.locality),
    district: first(properties.district, properties.county),
    region: canonicalRegion(first(properties.state), countryCode),
    country: first(properties.country),
    countryCode,
    postalCode: first(properties.postcode),
  };
}

/** MapTiler's geocoding response (GeoJSON with a `context` array). */
export function normaliseMapTiler(payload: unknown): NormalisedAddress {
  if (!payload || typeof payload !== 'object') return EMPTY_ADDRESS;
  const body = payload as Record<string, unknown>;
  const features = Array.isArray(body.features) ? body.features : [];
  const feature = features[0] as Record<string, unknown> | undefined;
  if (!feature) return EMPTY_ADDRESS;

  const context = Array.isArray(feature.context) ? feature.context : [];
  const byType = (type: string): string | null => {
    for (const entry of context) {
      if (!entry || typeof entry !== 'object') continue;
      const item = entry as Record<string, unknown>;
      const id = typeof item.id === 'string' ? item.id : '';
      if (id.startsWith(`${type}.`)) return first(item.text);
    }
    return null;
  };

  const properties = (feature.properties ?? {}) as Record<string, unknown>;

  const countryCode = first(properties.country_code, byType('country_code'))?.toUpperCase() ?? null;

  return {
    addressLine: first(feature.place_name_en, feature.place_name, feature.text),
    city: first(byType('municipality'), byType('place'), byType('locality')),
    district: first(byType('municipal_district'), byType('neighbourhood'), byType('county')),
    region: canonicalRegion(first(byType('region'), byType('subregion')), countryCode),
    country: first(byType('country')),
    countryCode,
    postalCode: first(byType('postal_code')),
  };
}

/** A candidate place from a text search, with the coordinates to move a pin to. */
export type PlaceMatch = {
  label: string;
  latitude: number;
  longitude: number;
  address: NormalisedAddress;
};

function coord(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Search results, per provider.
 *
 * Each provider is reduced to the same three things — a label, a point, and the
 * normalised address — by reusing the reverse-geocoding normalisers on a single
 * result. A search result and a reverse lookup carry the same address shape;
 * only the envelope around them differs.
 */
export function normaliseNominatimSearch(payload: unknown): PlaceMatch[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    const latitude = coord(item.lat);
    const longitude = coord(item.lon);
    if (latitude === null || longitude === null) return [];
    const address = normaliseNominatim(item);
    return [
      {
        label: first(item.display_name, address.addressLine) ?? `${latitude}, ${longitude}`,
        latitude,
        longitude,
        address,
      },
    ];
  });
}

/** Photon and MapTiler both answer with GeoJSON features. */
export function normaliseFeatureSearch(
  payload: unknown,
  kind: 'photon' | 'maptiler',
): PlaceMatch[] {
  if (!payload || typeof payload !== 'object') return [];
  const features = (payload as Record<string, unknown>).features;
  if (!Array.isArray(features)) return [];

  return features.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const feature = entry as Record<string, unknown>;
    const geometry = (feature.geometry ?? {}) as Record<string, unknown>;
    const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const longitude = coord(coordinates[0]);
    const latitude = coord(coordinates[1]);
    if (latitude === null || longitude === null) return [];

    // The normalisers read the first feature of a collection, so hand each
    // result over as a collection of one.
    const single = { features: [feature] };
    const address = kind === 'photon' ? normalisePhoton(single) : normaliseMapTiler(single);
    const properties = (feature.properties ?? {}) as Record<string, unknown>;

    return [
      {
        label:
          first(properties.place_name, properties.name, address.addressLine) ??
          `${latitude}, ${longitude}`,
        latitude,
        longitude,
        address,
      },
    ];
  });
}
