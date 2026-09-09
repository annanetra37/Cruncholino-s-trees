/**
 * T3.1 (POST) and T3.2 (GET) — the two endpoints the whole app is built on.
 */
import { GeocodeStatus, Prisma, TreeStatus, type Tree } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { env } from '@/env';
import { json, readJson, route, badRequest } from '@/lib/api';
import { requireReadAccess, requireUser, shouldFuzzCoordinates } from '@/lib/authz';
import { enforceWriteLimit } from '@/lib/rate-limit';
import { parseTreeFilters } from '@/lib/trees/filters';
import { findTrees } from '@/lib/trees/query';
import { toTreeDto } from '@/lib/trees/serialise';
import { createTreeSchema } from '@/lib/trees/schema';
import { resolveAddress } from '@/lib/geocode';
import { findNearbyDuplicates } from '@/lib/trees/duplicates';
import { diffTree, revisionData } from '@/lib/trees/revisions';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The subset of a freshly created tree the capture flow needs back. */
function serialiseCreated(tree: Tree) {
  return {
    id: tree.id,
    latitude: tree.latitude,
    longitude: tree.longitude,
    status: tree.status,
    address: {
      line: tree.addressLine,
      city: tree.city,
      district: tree.district,
      region: tree.region,
      country: tree.country,
      countryCode: tree.countryCode,
      postalCode: tree.postalCode,
      status: tree.geocodeStatus,
    },
    createdAt: tree.createdAt.toISOString(),
  };
}

export const GET = route('trees.list', async (request) => {
  const user = await requireReadAccess();
  const filters = parseTreeFilters(new URL(request.url).searchParams);

  const { items, total } = await findTrees(filters);
  const fuzz = shouldFuzzCoordinates(user);

  return json({
    items: items.map((row) => toTreeDto(row, { fuzz })),
    total,
    page: filters.page,
    page_size: filters.page_size,
    pages: Math.max(1, Math.ceil(total / filters.page_size)),
  });
});

export const POST = route('trees.create', async (request) => {
  const user = await requireUser();
  // Creating a tree can trigger an outbound geocode call, so this is also the
  // limit that protects the geocoding budget (T3.11).
  enforceWriteLimit(request, user.id, 'trees.create');

  const input = createTreeSchema.parse(await readJson(request));

  // T4.5: the offline queue retries anything whose response it never saw. If
  // the original request did land, return the tree it created rather than a
  // second copy of the same observation.
  if (input.clientRef) {
    const existing = await prisma.tree.findUnique({ where: { clientRef: input.clientRef } });
    if (existing) {
      return json(
        { tree: serialiseCreated(existing), warnings: [], idempotent: true },
        { status: 200 },
      );
    }
  }

  const species = await prisma.species.findUnique({ where: { id: input.speciesId } });
  if (!species) throw badRequest('Unknown species', { field: 'speciesId' });
  if (!species.isActive) throw badRequest('That species is no longer available', { field: 'speciesId' });

  // The address is a convenience; a geocoder outage must not cost a
  // contributor the observation they walked out to record (T3.7).
  const geocode = input.addressOverride
    ? null
    : await resolveAddress(input.latitude, input.longitude).catch((error) => {
        logger.error('geocode threw unexpectedly', { error });
        return null;
      });

  const address = input.addressOverride ?? geocode?.address ?? {};
  const geocodeStatus = input.addressOverride
    ? GeocodeStatus.MANUAL
    : (geocode?.status ?? GeocodeStatus.FAILED);

  const status = env.MODERATION_ENABLED ? TreeStatus.DRAFT : TreeStatus.PUBLISHED;

  const tree = await prisma.$transaction(async (tx) => {
    const created = await tx.tree.create({
      data: {
        speciesId: input.speciesId,
        latitude: input.latitude,
        longitude: input.longitude,
        locationSource: input.locationSource,
        accuracyM: input.accuracyM,
        ageBand: input.ageBand,
        ageYearsEstimate: input.ageYearsEstimate ?? null,
        condition: input.condition,
        fruitQuality: input.fruitQuality,
        notes: input.notes ?? null,
        addressLine: address.addressLine ?? null,
        city: address.city ?? null,
        district: address.district ?? null,
        region: address.region ?? null,
        country: address.country ?? null,
        countryCode: address.countryCode ?? null,
        postalCode: address.postalCode ?? null,
        geocodeRaw: (geocode?.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        geocodeStatus,
        status,
        clientRef: input.clientRef ?? null,
        createdById: user.id,
        photos: input.photos?.length
          ? {
              create: input.photos.map((photo, index) => ({
                storageKey: photo.storageKey,
                width: photo.width,
                height: photo.height,
                bytes: photo.bytes,
                takenAt: photo.takenAt ?? null,
                sortOrder: index,
              })),
            }
          : undefined,
      },
    });

    await tx.treeRevision.create({
      data: revisionData({
        treeId: created.id,
        userId: user.id,
        action: 'create',
        diff: diffTree({}, created),
      }),
    });

    return created;
  });

  // Advisory only, and computed after the write: a contributor standing in an
  // orchard is not wrong just because the trees are four metres apart (T3.9).
  const nearby = await findNearbyDuplicates({
    latitude: input.latitude,
    longitude: input.longitude,
    speciesId: input.speciesId,
    excludeTreeId: tree.id,
  }).catch(() => []);

  return json(
    {
      tree: serialiseCreated(tree),
      warnings: nearby.length
        ? [
            {
              code: 'possible_duplicate',
              message: `There ${nearby.length === 1 ? 'is' : 'are'} already ${nearby.length} ${
                species.nameEn
              } tree${nearby.length === 1 ? '' : 's'} within ${env.DUPLICATE_RADIUS_M} m.`,
              nearby: nearby.map((entry) => ({
                id: entry.id,
                distanceM: Math.round(entry.distance_m * 10) / 10,
                species: entry.species_name_en,
              })),
            },
          ]
        : [],
    },
    { status: 201 },
  );
});
