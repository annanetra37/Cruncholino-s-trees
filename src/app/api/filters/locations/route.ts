/**
 * T3.6 — distinct cities and regions present in the data, for the filter
 * dropdowns. Counts come along for free from the same GROUP BY and let the UI
 * order the list by how much data each place actually has.
 */
import { prisma } from '@/lib/prisma';
import { json, route } from '@/lib/api';
import { requireReadAccess } from '@/lib/authz';

export const runtime = 'nodejs';
export const revalidate = 300;

type Row = { value: string; count: bigint };

export const GET = route('filters.locations', async () => {
  await requireReadAccess();

  const [cities, regions, countries] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT city AS value, COUNT(*)::bigint AS count
      FROM trees
      WHERE deleted_at IS NULL AND status = 'PUBLISHED' AND city IS NOT NULL AND city <> ''
      GROUP BY city ORDER BY count DESC, city ASC LIMIT 500
    `,
    prisma.$queryRaw<Row[]>`
      SELECT region AS value, COUNT(*)::bigint AS count
      FROM trees
      WHERE deleted_at IS NULL AND status = 'PUBLISHED' AND region IS NOT NULL AND region <> ''
      GROUP BY region ORDER BY count DESC, region ASC LIMIT 500
    `,
    prisma.$queryRaw<Row[]>`
      SELECT country AS value, COUNT(*)::bigint AS count
      FROM trees
      WHERE deleted_at IS NULL AND status = 'PUBLISHED' AND country IS NOT NULL AND country <> ''
      GROUP BY country ORDER BY count DESC, country ASC LIMIT 200
    `,
  ]);

  const shape = (rows: Row[]) => rows.map((row) => ({ value: row.value, count: Number(row.count) }));

  return json(
    { cities: shape(cities), regions: shape(regions), countries: shape(countries) },
    {
      headers: { 'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' },
    },
  );
});
