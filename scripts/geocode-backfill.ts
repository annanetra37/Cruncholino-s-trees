/**
 * T3.8 — retry the addresses that failed.
 *
 * A tree is created whether or not the geocoder answers; this job goes back
 * over the ones it did not and tries again. Runs as a Railway cron service
 * (T9.9), hourly.
 */
import { GeocodeStatus, PrismaClient } from '@prisma/client';
import { resolveAddress } from '../src/lib/geocode';
import { logger } from '../src/lib/logger';

const prisma = new PrismaClient();

const BATCH = Number.parseInt(process.env.GEOCODE_BACKFILL_BATCH ?? '100', 10);

async function main() {
  const trees = await prisma.tree.findMany({
    where: {
      deletedAt: null,
      geocodeStatus: { in: [GeocodeStatus.FAILED, GeocodeStatus.PENDING] },
    },
    // Oldest first: a tree that has been waiting three days should not be
    // permanently overtaken by a steady trickle of new failures.
    orderBy: { createdAt: 'asc' },
    take: BATCH,
    select: { id: true, latitude: true, longitude: true },
  });

  logger.info('geocode backfill starting', { candidates: trees.length, batch: BATCH });

  let resolved = 0;
  let stillFailing = 0;

  for (const tree of trees) {
    const result = await resolveAddress(tree.latitude, tree.longitude);

    if (result.status !== GeocodeStatus.OK) {
      stillFailing += 1;
      continue;
    }

    await prisma.tree.update({
      where: { id: tree.id },
      data: {
        addressLine: result.address.addressLine,
        city: result.address.city,
        district: result.address.district,
        region: result.address.region,
        country: result.address.country,
        countryCode: result.address.countryCode,
        postalCode: result.address.postalCode,
        geocodeRaw: result.raw,
        geocodeStatus: GeocodeStatus.OK,
      },
    });
    resolved += 1;
  }

  logger.info('geocode backfill finished', { resolved, stillFailing });
}

main()
  .catch((error) => {
    logger.error('geocode backfill failed', { error });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
