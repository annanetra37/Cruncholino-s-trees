/**
 * One shape for a tree, everywhere: the list endpoint, the detail endpoint, the
 * map popup and the CSV export all describe the same object.
 */
import type { GeoJsonRow, TreeRow } from '@/lib/trees/query';
import { fuzzCoordinate } from '@/lib/policy';

export type TreeDto = ReturnType<typeof toTreeDto>;

export function toTreeDto(row: TreeRow, options: { fuzz?: boolean } = {}) {
  const latitude = options.fuzz ? fuzzCoordinate(row.latitude) : row.latitude;
  const longitude = options.fuzz ? fuzzCoordinate(row.longitude) : row.longitude;

  return {
    id: row.id,
    latitude,
    longitude,
    coordinatesApproximate: Boolean(options.fuzz),
    species: {
      id: row.species_id,
      slug: row.species_slug,
      nameEn: row.species_name_en,
      nameHy: row.species_name_hy,
      category: row.species_category,
    },
    ageBand: row.age_band,
    ageYearsEstimate: row.age_years_estimate,
    condition: row.condition,
    fruitQuality: row.fruit_quality,
    reachability: row.reachability,
    notes: row.notes,
    address: {
      line: row.address_line,
      city: row.city,
      district: row.district,
      region: row.region,
      country: row.country,
      countryCode: row.country_code,
      postalCode: row.postal_code,
      status: row.geocode_status,
    },
    location: {
      source: row.location_source,
      accuracyM: row.accuracy_m,
    },
    status: row.status,
    photoCount: row.photo_count,
    distanceM: row.distance_m,
    createdBy: row.created_by_id ? { id: row.created_by_id, name: row.created_by_name } : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export type TreeFeature = {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: Record<string, string | number | null>;
};

export function toFeature(row: GeoJsonRow, options: { fuzz?: boolean } = {}): TreeFeature {
  const latitude = options.fuzz ? fuzzCoordinate(row.latitude) : row.latitude;
  const longitude = options.fuzz ? fuzzCoordinate(row.longitude) : row.longitude;

  return {
    type: 'Feature',
    id: row.id,
    geometry: { type: 'Point', coordinates: [longitude, latitude] },
    properties: {
      id: row.id,
      species: row.species_name_en,
      speciesSlug: row.species_slug,
      category: row.species_category,
      condition: row.condition,
      ageBand: row.age_band,
      fruitQuality: row.fruit_quality,
      reachability: row.reachability,
      city: row.city,
    },
  };
}
