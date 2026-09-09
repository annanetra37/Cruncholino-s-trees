/**
 * T10.2 — integration tests against a real Postgres + PostGIS.
 *
 * These exist because the spatial half of this app cannot be tested against a
 * mock: `ST_DWithin` on a geography column, a generated column, and the index
 * that makes it fast are all database behaviour. A mock would only assert that
 * the SQL string looks the way it looked when it was written.
 *
 * Skipped automatically when there is no database, so `pnpm test` still works
 * on a laptop with nothing running. Run with:
 *   pnpm db:up && TEST_DATABASE_URL=... pnpm test
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildTreeWhere } from '@/lib/trees/query';

const prisma = new PrismaClient();

let available = false;
let speciesId = '';
let otherSpeciesId = '';

const YEREVAN = { lat: 40.1872, lng: 44.5152 };

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT PostGIS_Version()`;
    available = true;
  } catch {
    console.warn('skipping integration tests: no PostGIS database reachable');
    return;
  }

  await prisma.tree.deleteMany({ where: { notes: { startsWith: '[itest]' } } });

  const apricot = await prisma.species.upsert({
    where: { slug: 'itest-apricot' },
    update: {},
    create: { slug: 'itest-apricot', nameEn: 'Test apricot', category: 'FRUIT' },
  });
  const walnut = await prisma.species.upsert({
    where: { slug: 'itest-walnut' },
    update: {},
    create: { slug: 'itest-walnut', nameEn: 'Test walnut', category: 'NUT' },
  });
  speciesId = apricot.id;
  otherSpeciesId = walnut.id;

  // Three apricots: at the centre, ~11 m north, ~1.1 km north.
  await prisma.tree.createMany({
    data: [
      { speciesId, latitude: YEREVAN.lat, longitude: YEREVAN.lng, notes: '[itest] centre', condition: 'GOOD' },
      { speciesId, latitude: YEREVAN.lat + 0.0001, longitude: YEREVAN.lng, notes: '[itest] near', condition: 'POOR' },
      { speciesId, latitude: YEREVAN.lat + 0.01, longitude: YEREVAN.lng, notes: '[itest] far', condition: 'GOOD' },
      { speciesId: walnut.id, latitude: YEREVAN.lat, longitude: YEREVAN.lng, notes: '[itest] other species', condition: 'GOOD' },
    ],
  });
});

afterAll(async () => {
  if (available) await prisma.tree.deleteMany({ where: { notes: { startsWith: '[itest]' } } });
  await prisma.$disconnect();
});

describe.runIf(process.env.RUN_INTEGRATION !== '0')('PostGIS behaviour', () => {
  it('derives geom from latitude and longitude automatically', async () => {
    if (!available) return;
    const rows = await prisma.$queryRaw<Array<{ lat: number; lng: number }>>`
      SELECT ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
      FROM trees WHERE notes = '[itest] centre'
    `;
    // The application never writes geom; the generated column does.
    expect(rows[0]?.lat).toBeCloseTo(YEREVAN.lat, 6);
    expect(rows[0]?.lng).toBeCloseTo(YEREVAN.lng, 6);
  });

  it('keeps geom in step when the coordinates are updated', async () => {
    if (!available) return;
    const tree = await prisma.tree.findFirst({ where: { notes: '[itest] centre' } });
    await prisma.tree.update({ where: { id: tree!.id }, data: { latitude: 41 } });

    const rows = await prisma.$queryRaw<Array<{ lat: number }>>`
      SELECT ST_Y(geom::geometry) AS lat FROM trees WHERE id = ${tree!.id}::uuid
    `;
    expect(rows[0]?.lat).toBeCloseTo(41, 6);

    await prisma.tree.update({ where: { id: tree!.id }, data: { latitude: YEREVAN.lat } });
  });

  it('refuses an impossible coordinate at the storage layer', async () => {
    if (!available) return;
    // A swapped lat/lng pair is the classic mapping bug; the CHECK constraint
    // is the last line of defence behind Zod validation.
    await expect(
      prisma.tree.create({
        data: { speciesId, latitude: 44.5, longitude: 400, notes: '[itest] invalid' },
      }),
    ).rejects.toThrow();
  });

  it('finds trees within a radius and not beyond it (ST_DWithin)', async () => {
    if (!available) return;
    const within = await prisma.$queryRaw<Array<{ notes: string }>>`
      SELECT notes FROM trees
      WHERE notes LIKE '[itest]%'
        AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint(${YEREVAN.lng}, ${YEREVAN.lat}), 4326)::geography, 50)
      ORDER BY notes
    `;
    const found = within.map((row) => row.notes);
    expect(found).toContain('[itest] centre');
    expect(found).toContain('[itest] near'); // ~11 m
    expect(found).not.toContain('[itest] far'); // ~1.1 km
  });

  it('measures distance in metres', async () => {
    if (!available) return;
    const rows = await prisma.$queryRaw<Array<{ d: number }>>`
      SELECT ST_Distance(geom, ST_SetSRID(ST_MakePoint(${YEREVAN.lng}, ${YEREVAN.lat}), 4326)::geography) AS d
      FROM trees WHERE notes = '[itest] near'
    `;
    // 0.0001° of latitude is ~11.1 m anywhere on Earth.
    expect(rows[0]!.d).toBeGreaterThan(9);
    expect(rows[0]!.d).toBeLessThan(13);
  });

  it('applies the filter builder’s SQL against the real schema', async () => {
    if (!available) return;
    const where = buildTreeWhere({
      condition: ['GOOD'],
      near: { lat: YEREVAN.lat, lng: YEREVAN.lng },
      radius_m: 50,
      q: '[itest]',
    });

    const rows = await prisma.$queryRaw<Array<{ notes: string }>>`
      SELECT t.notes FROM trees t JOIN species s ON s.id = t.species_id ${where}
    `;
    const notes = rows.map((row) => row.notes);
    // GOOD + within 50 m: the centre apricot and the walnut. Not the POOR one,
    // not the far one.
    expect(notes).toContain('[itest] centre');
    expect(notes).toContain('[itest] other species');
    expect(notes).not.toContain('[itest] near');
    expect(notes).not.toContain('[itest] far');
  });

  it('filters by species without touching another species’ trees', async () => {
    if (!available) return;
    const where = buildTreeWhere({ species: ['itest-walnut'], q: '[itest]' });
    const rows = await prisma.$queryRaw<Array<{ species_id: string }>>`
      SELECT t.species_id FROM trees t JOIN species s ON s.id = t.species_id ${where}
    `;
    expect(rows.every((row) => row.species_id === otherSpeciesId)).toBe(true);
    expect(rows.length).toBe(1);
  });

  it('hides soft-deleted trees from every read path', async () => {
    if (!available) return;
    const tree = await prisma.tree.findFirst({ where: { notes: '[itest] far' } });
    await prisma.tree.update({ where: { id: tree!.id }, data: { deletedAt: new Date() } });

    const where = buildTreeWhere({ q: '[itest]' });
    const rows = await prisma.$queryRaw<Array<{ notes: string }>>`
      SELECT t.notes FROM trees t JOIN species s ON s.id = t.species_id ${where}
    `;
    expect(rows.map((row) => row.notes)).not.toContain('[itest] far');

    await prisma.tree.update({ where: { id: tree!.id }, data: { deletedAt: null } });
  });

  it('has the indexes the dashboard depends on', async () => {
    if (!available) return;
    // Guards T2.3: a future migration that drops one of these would turn the
    // viewport query into a sequential scan, which only shows up in production
    // once the table is large. The planner's *choice* is size-dependent and so
    // belongs in the load check (scripts/load-check.ts), not here — but the
    // index existing is not.
    const rows = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'trees'
    `;
    const names = rows.map((row) => row.indexname);

    expect(names).toContain('trees_geom_idx');
    expect(names).toContain('trees_live_geom_idx');
    expect(names).toContain('trees_species_id_idx');
    expect(names).toContain('trees_city_idx');
    expect(names).toContain('trees_status_deleted_at_species_id_condition_idx');

    // The spatial ones must be GiST: a B-tree on a geography column would be
    // accepted by Postgres and useless for ST_DWithin.
    const geomIndex = rows.find((row) => row.indexname === 'trees_geom_idx');
    expect(geomIndex?.indexdef).toContain('gist');
  });

  it('serves free-text search from a trigram index', async () => {
    if (!available) return;
    const rows = await prisma.$queryRaw<Array<{ indexdef: string }>>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'trees' AND indexname = 'trees_notes_trgm_idx'
    `;
    expect(rows[0]?.indexdef).toContain('gin');
  });
});
