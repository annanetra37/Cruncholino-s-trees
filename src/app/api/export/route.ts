/**
 * T3.10 — CSV and GeoJSON export, honouring the same filters as the dashboard.
 *
 * The response is streamed. Building a 50,000-row export in memory first would
 * spike the container's memory ceiling and, on Railway, get the process killed
 * rather than merely slowed.
 */
import { Prisma, Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api';
import { requireRole } from '@/lib/authz';
import { parseTreeFilters } from '@/lib/trees/filters';
import { buildTreeWhere } from '@/lib/trees/query';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 1000;

const COLUMNS = [
  'id',
  'species_slug',
  'species_name_en',
  'species_name_hy',
  'latitude',
  'longitude',
  'age_band',
  'age_years_estimate',
  'condition',
  'fruit_quality',
  'reachability',
  'address_line',
  'city',
  'district',
  'region',
  'country',
  'country_code',
  'postal_code',
  'geocode_status',
  'location_source',
  'accuracy_m',
  'status',
  'notes',
  'created_at',
  'updated_at',
] as const;

type ExportRow = Record<(typeof COLUMNS)[number], unknown>;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  // Excel and Sheets both need this exact quoting to survive a comma or a
  // newline inside a free-text notes field.
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Keyset pagination: OFFSET on a 50k export makes the last pages quadratic. */
async function* readBatches(where: Prisma.Sql): AsyncGenerator<ExportRow[]> {
  let cursor: { createdAt: Date; id: string } | null = null;

  for (;;) {
    const keyset: Prisma.Sql = cursor
      ? Prisma.sql`AND (t.created_at, t.id) < (${cursor.createdAt}, ${cursor.id}::uuid)`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<Array<ExportRow & { created_at: Date; id: string }>>`
      SELECT
        t.id, s.slug AS species_slug, s.name_en AS species_name_en, s.name_hy AS species_name_hy,
        t.latitude, t.longitude, t.age_band::text AS age_band, t.age_years_estimate,
        t.condition::text AS condition, t.fruit_quality::text AS fruit_quality,
        t.reachability::text AS reachability,
        t.address_line, t.city, t.district, t.region, t.country, t.country_code, t.postal_code,
        t.geocode_status::text AS geocode_status, t.location_source::text AS location_source,
        t.accuracy_m, t.status::text AS status, t.notes, t.created_at, t.updated_at
      FROM trees t
      JOIN species s ON s.id = t.species_id
      ${where}
      ${keyset}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT ${BATCH_SIZE}
    `;

    if (rows.length === 0) return;
    yield rows;
    if (rows.length < BATCH_SIZE) return;

    const last = rows[rows.length - 1]!;
    cursor = { createdAt: last.created_at, id: last.id };
  }
}

export const GET = route('export', async (request) => {
  // Export hands over the whole filtered dataset, including exact coordinates.
  await requireRole(Role.REVIEWER);

  const url = new URL(request.url);
  const format = z
    .enum(['csv', 'geojson'])
    .default('csv')
    .parse(url.searchParams.get('format') ?? 'csv');
  const filters = parseTreeFilters(url.searchParams);
  const where = buildTreeWhere(filters);

  const encoder = new TextEncoder();
  const stamp = new Date().toISOString().slice(0, 10);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      try {
        if (format === 'csv') {
          send(`${COLUMNS.join(',')}\n`);
          for await (const batch of readBatches(where)) {
            send(
              batch.map((row) => COLUMNS.map((c) => csvCell(row[c])).join(',')).join('\n') + '\n',
            );
          }
        } else {
          send('{"type":"FeatureCollection","features":[');
          let first = true;
          for await (const batch of readBatches(where)) {
            for (const row of batch) {
              const feature = {
                type: 'Feature',
                id: row.id,
                geometry: { type: 'Point', coordinates: [row.longitude, row.latitude] },
                properties: Object.fromEntries(
                  COLUMNS.filter((c) => c !== 'latitude' && c !== 'longitude').map((c) => [
                    c,
                    row[c] instanceof Date ? (row[c] as Date).toISOString() : row[c],
                  ]),
                ),
              };
              send(`${first ? '' : ','}${JSON.stringify(feature)}`);
              first = false;
            }
          }
          send(']}');
        }
        controller.close();
      } catch (error) {
        // The status line is long gone by now, so the only honest thing left is
        // to log it and break the stream rather than emit a truncated file that
        // looks complete.
        logger.error('export stream failed', { error, format });
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/geo+json',
      'content-disposition': `attachment; filename="trees-${stamp}.${format}"`,
      'cache-control': 'no-store',
    },
  });
});
