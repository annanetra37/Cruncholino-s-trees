/**
 * Provider responses are shaped differently and none of them agree on what an
 * administrative level is called. Normalising here keeps that mess out of the
 * database and out of the dashboard's filters.
 */
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

  return {
    addressLine: first(street, body.display_name),
    city: first(address.city, address.town, address.village, address.municipality, address.hamlet),
    district: first(address.city_district, address.suburb, address.district, address.county),
    // Armenia's marzer arrive as `state`; keeping the generic name here and
    // labelling it "region" in the UI avoids a country-specific model.
    region: first(address.state, address.region, address.province),
    country: first(address.country),
    countryCode: first(address.country_code)?.toUpperCase() ?? null,
    postalCode: first(address.postcode),
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

  return {
    addressLine: first(feature.place_name_en, feature.place_name, feature.text),
    city: first(byType('municipality'), byType('place'), byType('locality')),
    district: first(byType('municipal_district'), byType('neighbourhood'), byType('county')),
    region: first(byType('region'), byType('subregion')),
    country: first(byType('country')),
    countryCode: first(properties.country_code, byType('country_code'))?.toUpperCase() ?? null,
    postalCode: first(byType('postal_code')),
  };
}
