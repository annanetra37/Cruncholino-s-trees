/**
 * T10.7 — the load check.
 *
 * Seeds 50,000 trees and times the queries the dashboard actually makes, then
 * prints the query plan for the viewport load. The plan is the useful part: a
 * timing tells you it is slow today, the plan tells you it will be slow at
 * 500,000.
 *
 *   SEED_TREES=50000 pnpm db:seed && pnpm exec tsx scripts/load-check.ts
 */
import { PrismaClient } from '@prisma/client';
import { buildTreeWhere } from '../src/lib/trees/query';

const prisma = new PrismaClient();

const BUDGET_MS = Number.parseInt(process.env.LOAD_BUDGET_MS ?? '500', 10);

async function time<T>(label: string, run: () => Promise<T>): Promise<number> {
  // Run twice and keep the second: the first pays for a cold cache, which is
  // not what a user experiences on a warm service.
  await run();
  const started = performance.now();
  await run();
  const elapsed = performance.now() - started;
  const verdict = elapsed <= BUDGET_MS ? 'ok  ' : 'SLOW';
  console.log(`  ${verdict} ${label.padEnd(42)} ${elapsed.toFixed(1)} ms`);
  return elapsed;
}

async function main() {
  const total = await prisma.tree.count({ where: { deletedAt: null } });
  console.log(`\nDataset: ${total.toLocaleString()} trees. Budget: ${BUDGET_MS} ms.\n`);
  if (total < 10_000) {
    console.log('  (Seed more first: SEED_TREES=50000 pnpm db:seed)\n');
  }

  const viewport = buildTreeWhere({ bbox: { minLng: 44.4, minLat: 40.1, maxLng: 44.7, maxLat: 40.3 } });
  const filtered = buildTreeWhere({
    bbox: { minLng: 44.4, minLat: 40.1, maxLng: 44.7, maxLat: 40.3 },
    condition: ['GOOD', 'FAIR'],
    species: ['apricot', 'walnut'],
  });

  const timings: number[] = [];

  timings.push(
    await time('viewport load (bbox)', () =>
      prisma.$queryRaw`SELECT t.id, t.latitude, t.longitude FROM trees t
        JOIN species s ON s.id = t.species_id ${viewport} LIMIT 5000`),
  );

  timings.push(
    await time('viewport + species + condition', () =>
      prisma.$queryRaw`SELECT t.id FROM trees t JOIN species s ON s.id = t.species_id ${filtered} LIMIT 5000`),
  );

  timings.push(
    await time('summary counts', () =>
      prisma.$queryRaw`SELECT t.condition, COUNT(*) FROM trees t
        JOIN species s ON s.id = t.species_id ${viewport} GROUP BY t.condition`),
  );

  timings.push(
    await time('radius search (ST_DWithin 1 km)', () =>
      prisma.$queryRaw`SELECT t.id FROM trees t JOIN species s ON s.id = t.species_id
        ${buildTreeWhere({ near: { lat: 40.1872, lng: 44.5152 }, radius_m: 1000 })} LIMIT 5000`),
  );

  timings.push(
    await time('free-text search', () =>
      prisma.$queryRaw`SELECT t.id FROM trees t JOIN species s ON s.id = t.species_id
        ${buildTreeWhere({ q: 'demo street' })} LIMIT 200`),
  );

  console.log('\nQuery plan for the viewport load:\n');
  const plan = await prisma.$queryRaw<Array<Record<string, string>>>`
    EXPLAIN ANALYZE SELECT t.id, t.latitude, t.longitude FROM trees t
    JOIN species s ON s.id = t.species_id ${viewport} LIMIT 5000
  `;
  for (const row of plan) console.log(`  ${Object.values(row).join(' ')}`);

  const worst = Math.max(...timings);
  console.log(`\nSlowest: ${worst.toFixed(1)} ms (budget ${BUDGET_MS} ms)\n`);
  if (worst > BUDGET_MS) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
