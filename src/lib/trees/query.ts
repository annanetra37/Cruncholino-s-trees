/**
 * T3.2 / T3.3 — server-side filtering.
 *
 * Everything is filtered, sorted and paginated in Postgres. "Fetch all trees
 * and filter in React" works at 200 trees and dies at 20,000, and the map is
 * the first thing to die.
 *
 * The query is raw SQL rather than Prisma's query builder because the spatial
 * predicates (`ST_DWithin`, bbox containment, distance ordering) have no
 * representation in the Prisma client, and mixing raw spatial filters with
 * builder-generated ones would mean maintaining two versions of every filter.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { TreeFilters } from '@/lib/trees/filters';

export type TreeRow = {
  id: string;
  latitude: number;
  longitude: number;
  species_id: string;
  species_slug: string;
  species_name_en: string;
  species_name_hy: string | null;
  species_category: string;
  age_band: string;
  age_years_estimate: number | null;
  condition: string;
  fruit_quality: string;
  notes: string | null;
  address_line: string | null;
  city: string | null;
  district: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  postal_code: string | null;
  geocode_status: string;
  location_source: string;
  accuracy_m: number | null;
  status: string;
  created_by_id: string | null;
  created_by_name: string | null;
  created_at: Date;
  updated_at: Date;
  photo_count: number;
  distance_m: number | null;
};

/**
 * Builds the WHERE clause shared by every read path. Returned as a
 * `Prisma.Sql` so values stay parameterised — no filter value is ever
 * concatenated into SQL text.
 */
export function buildTreeWhere(filters: Partial<TreeFilters>): Prisma.Sql {
  const clauses: Prisma.Sql[] = [
    // Soft-deleted rows are invisible to every read path, without exception.
    Prisma.sql`t.deleted_at IS NULL`,
  ];

  // Default visibility: published only. An explicit `status` filter (used by
  // the review queue and "my trees") overrides it.
  if (filters.status?.length) {
    clauses.push(Prisma.sql`t.status::text IN (${Prisma.join(filters.status)})`);
  } else {
    clauses.push(Prisma.sql`t.status = 'PUBLISHED'::"TreeStatus"`);
  }

  if (filters.species?.length) {
    // Accepts either a species id or its slug, so a shared dashboard URL stays
    // readable: ?species=apricot,walnut
    clauses.push(
      Prisma.sql`(s.slug IN (${Prisma.join(filters.species)}) OR t.species_id::text IN (${Prisma.join(
        filters.species,
      )}))`,
    );
  }

  if (filters.age_band?.length) {
    clauses.push(Prisma.sql`t.age_band::text IN (${Prisma.join(filters.age_band)})`);
  }
  if (filters.condition?.length) {
    clauses.push(Prisma.sql`t.condition::text IN (${Prisma.join(filters.condition)})`);
  }
  if (filters.fruit_quality?.length) {
    clauses.push(Prisma.sql`t.fruit_quality::text IN (${Prisma.join(filters.fruit_quality)})`);
  }
  if (filters.city) {
    clauses.push(Prisma.sql`t.city ILIKE ${filters.city}`);
  }
  if (filters.region) {
    clauses.push(Prisma.sql`t.region ILIKE ${filters.region}`);
  }
  if (filters.country_code) {
    clauses.push(Prisma.sql`t.country_code = ${filters.country_code.toUpperCase()}`);
  }
  if (filters.created_by) {
    clauses.push(Prisma.sql`t.created_by_id = ${filters.created_by}::uuid`);
  }

  if (filters.bbox) {
    const { minLng, minLat, maxLng, maxLat } = filters.bbox;
    // ST_MakeEnvelope on the geography index: this is the viewport load, and it
    // is the single most frequent query the app runs.
    clauses.push(
      Prisma.sql`ST_Intersects(
        t.geom,
        ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)::geography
      )`,
    );
  }

  if (filters.near && filters.radius_m) {
    clauses.push(
      Prisma.sql`ST_DWithin(
        t.geom,
        ST_SetSRID(ST_MakePoint(${filters.near.lng}, ${filters.near.lat}), 4326)::geography,
        ${filters.radius_m}
      )`,
    );
  }

  if (filters.q) {
    const pattern = `%${filters.q}%`;
    clauses.push(
      Prisma.sql`(t.notes ILIKE ${pattern} OR t.address_line ILIKE ${pattern} OR t.city ILIKE ${pattern})`,
    );
  }

  return Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`;
}

function buildOrderBy(filters: Partial<TreeFilters>): Prisma.Sql {
  switch (filters.sort) {
    case 'created_at:asc':
      return Prisma.sql`ORDER BY t.created_at ASC, t.id ASC`;
    case 'updated_at:desc':
      return Prisma.sql`ORDER BY t.updated_at DESC, t.id ASC`;
    case 'species:asc':
      return Prisma.sql`ORDER BY s.name_en ASC, t.created_at DESC`;
    case 'condition:asc':
      return Prisma.sql`ORDER BY t.condition ASC, t.created_at DESC`;
    case 'city:asc':
      return Prisma.sql`ORDER BY t.city ASC NULLS LAST, t.created_at DESC`;
    case 'distance:asc':
      return Prisma.sql`ORDER BY distance_m ASC NULLS LAST, t.id ASC`;
    default:
      // `t.id` breaks ties so that page 2 never repeats a row from page 1.
      return Prisma.sql`ORDER BY t.created_at DESC, t.id ASC`;
  }
}

function distanceColumn(filters: Partial<TreeFilters>): Prisma.Sql {
  if (!filters.near) return Prisma.sql`NULL::double precision AS distance_m`;
  return Prisma.sql`ST_Distance(
    t.geom,
    ST_SetSRID(ST_MakePoint(${filters.near.lng}, ${filters.near.lat}), 4326)::geography
  ) AS distance_m`;
}

const TREE_COLUMNS = Prisma.sql`
  t.id,
  t.latitude,
  t.longitude,
  t.species_id,
  s.slug AS species_slug,
  s.name_en AS species_name_en,
  s.name_hy AS species_name_hy,
  s.category::text AS species_category,
  t.age_band::text AS age_band,
  t.age_years_estimate,
  t.condition::text AS condition,
  t.fruit_quality::text AS fruit_quality,
  t.notes,
  t.address_line,
  t.city,
  t.district,
  t.region,
  t.country,
  t.country_code,
  t.postal_code,
  t.geocode_status::text AS geocode_status,
  t.location_source::text AS location_source,
  t.accuracy_m,
  t.status::text AS status,
  t.created_by_id,
  u.name AS created_by_name,
  t.created_at,
  t.updated_at,
  (SELECT COUNT(*)::int FROM tree_photos p WHERE p.tree_id = t.id) AS photo_count
`;

export async function findTrees(filters: TreeFilters): Promise<{ items: TreeRow[]; total: number }> {
  const where = buildTreeWhere(filters);
  const offset = (filters.page - 1) * filters.page_size;

  const [items, countRows] = await Promise.all([
    prisma.$queryRaw<TreeRow[]>`
      SELECT ${TREE_COLUMNS}, ${distanceColumn(filters)}
      FROM trees t
      JOIN species s ON s.id = t.species_id
      LEFT JOIN users u ON u.id = t.created_by_id
      ${where}
      ${buildOrderBy(filters)}
      LIMIT ${filters.page_size} OFFSET ${offset}
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM trees t
      JOIN species s ON s.id = t.species_id
      ${where}
    `,
  ]);

  return { items, total: Number(countRows[0]?.count ?? 0) };
}

export async function countTrees(filters: Partial<TreeFilters>): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM trees t
    JOIN species s ON s.id = t.species_id
    ${buildTreeWhere(filters)}
  `;
  return Number(rows[0]?.count ?? 0);
}

/**
 * T3.3 — the map layer. Selects the minimum a marker needs; the detail panel
 * fetches the rest by id when a marker is actually clicked.
 */
export type GeoJsonRow = {
  id: string;
  latitude: number;
  longitude: number;
  species_slug: string;
  species_name_en: string;
  species_category: string;
  condition: string;
  age_band: string;
  fruit_quality: string;
  city: string | null;
};

export async function findTreesForMap(
  filters: Partial<TreeFilters>,
  limit: number,
): Promise<GeoJsonRow[]> {
  return prisma.$queryRaw<GeoJsonRow[]>`
    SELECT
      t.id,
      t.latitude,
      t.longitude,
      s.slug AS species_slug,
      s.name_en AS species_name_en,
      s.category::text AS species_category,
      t.condition::text AS condition,
      t.age_band::text AS age_band,
      t.fruit_quality::text AS fruit_quality,
      t.city
    FROM trees t
    JOIN species s ON s.id = t.species_id
    ${buildTreeWhere(filters)}
    LIMIT ${limit}
  `;
}

/**
 * T5.3 — server-side clustering, used above the feature cap. Snapping points to
 * a grid in Postgres is far cheaper than shipping 50,000 features to a phone
 * and asking MapLibre to cluster them.
 */
export type ClusterRow = {
  longitude: number;
  latitude: number;
  count: number;
};

export async function clusterTrees(
  filters: Partial<TreeFilters>,
  gridDegrees: number,
): Promise<ClusterRow[]> {
  const size = Math.max(gridDegrees, 0.0001);
  return prisma.$queryRaw<ClusterRow[]>`
    SELECT
      AVG(t.longitude)::double precision AS longitude,
      AVG(t.latitude)::double precision AS latitude,
      COUNT(*)::int AS count
    FROM trees t
    JOIN species s ON s.id = t.species_id
    ${buildTreeWhere(filters)}
    GROUP BY FLOOR(t.longitude / ${size}), FLOOR(t.latitude / ${size})
  `;
}

/**
 * T5.7 — the summary bar. One round trip for both breakdowns; two separate
 * count queries over the same filtered set would double the cost of the
 * cheapest, highest-value thing on the dashboard.
 */
export type TreeStats = {
  total: number;
  byCondition: Array<{ key: string; count: number }>;
  bySpecies: Array<{ key: string; label: string; count: number }>;
};

export async function summariseTrees(filters: Partial<TreeFilters>): Promise<TreeStats> {
  const where = buildTreeWhere(filters);

  const [conditions, species] = await Promise.all([
    prisma.$queryRaw<Array<{ key: string; count: bigint }>>`
      SELECT t.condition::text AS key, COUNT(*)::bigint AS count
      FROM trees t
      JOIN species s ON s.id = t.species_id
      ${where}
      GROUP BY t.condition
      ORDER BY count DESC
    `,
    prisma.$queryRaw<Array<{ key: string; label: string; count: bigint }>>`
      SELECT s.slug AS key, s.name_en AS label, COUNT(*)::bigint AS count
      FROM trees t
      JOIN species s ON s.id = t.species_id
      ${where}
      GROUP BY s.slug, s.name_en
      ORDER BY count DESC
      LIMIT 20
    `,
  ]);

  const byCondition = conditions.map((row) => ({ key: row.key, count: Number(row.count) }));

  return {
    total: byCondition.reduce((sum, row) => sum + row.count, 0),
    byCondition,
    bySpecies: species.map((row) => ({
      key: row.key,
      label: row.label,
      count: Number(row.count),
    })),
  };
}
