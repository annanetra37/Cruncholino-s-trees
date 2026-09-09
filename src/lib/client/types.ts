/** Shapes returned by the API, shared across the client components. */
export type SpeciesOption = {
  id: string;
  slug: string;
  nameEn: string;
  nameHy: string | null;
  category: string;
  isActive: boolean;
  treeCount: number;
};

export type TreeSummary = {
  id: string;
  latitude: number;
  longitude: number;
  coordinatesApproximate: boolean;
  species: { id: string; slug: string; nameEn: string; nameHy: string | null; category: string };
  ageBand: string;
  ageYearsEstimate: number | null;
  condition: string;
  fruitQuality: string;
  notes: string | null;
  address: {
    line: string | null;
    city: string | null;
    district: string | null;
    region: string | null;
    country: string | null;
    countryCode: string | null;
    postalCode: string | null;
    status: string;
  };
  location: { source: string; accuracyM: number | null };
  status: string;
  photoCount: number;
  distanceM: number | null;
  createdBy: { id: string; name: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

export type TreeListResponse = {
  items: TreeSummary[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export type TreeFeatureCollection = {
  type: 'FeatureCollection';
  clustered: boolean;
  total: number;
  features: Array<{
    type: 'Feature';
    id: string;
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: Record<string, string | number | boolean | null>;
  }>;
};

export type TreeStats = {
  total: number;
  byCondition: Array<{ key: string; count: number }>;
  bySpecies: Array<{ key: string; label: string; count: number }>;
};

export type LocationFilters = {
  cities: Array<{ value: string; count: number }>;
  regions: Array<{ value: string; count: number }>;
  countries: Array<{ value: string; count: number }>;
};

export type TreeDetail = TreeSummary & {
  photos: Array<{
    id: string;
    storageKey: string;
    width: number | null;
    height: number | null;
    takenAt: string | null;
  }>;
  revisions: Array<{
    id: string;
    action: string;
    changedAt: string;
    by: string | null;
    diff: Record<string, { from: unknown; to: unknown }>;
  }>;
};
