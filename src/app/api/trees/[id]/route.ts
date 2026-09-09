/**
 * T3.4 — read, update and soft-delete a single tree.
 *
 * PATCH and DELETE are restricted to the tree's creator or a REVIEWER/ADMIN,
 * and every successful PATCH appends a revision.
 */
import { GeocodeStatus, Prisma, Role, TreeStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { json, notFound, readJson, route, badRequest, forbidden } from '@/lib/api';
import {
  assertCanEditTree,
  atLeast,
  requireReadAccess,
  requireUser,
  shouldFuzzCoordinates,
} from '@/lib/authz';
import { enforceWriteLimit } from '@/lib/rate-limit';
import { updateTreeSchema } from '@/lib/trees/schema';
import { diffTree, revisionData } from '@/lib/trees/revisions';
import { resolveAddress } from '@/lib/geocode';
import { fuzzCoordinate } from '@/lib/authz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.uuid('Not a valid tree id');

async function loadTree(idParam: string) {
  const id = idSchema.parse(idParam);
  const tree = await prisma.tree.findFirst({
    where: { id, deletedAt: null },
    include: {
      species: true,
      photos: { orderBy: { sortOrder: 'asc' } },
      createdBy: { select: { id: true, name: true } },
      revisions: { orderBy: { changedAt: 'desc' }, take: 50, include: { user: { select: { name: true } } } },
    },
  });
  if (!tree) throw notFound('That tree does not exist, or has been removed');
  return tree;
}

export const GET = route('trees.get', async (request, context) => {
  const user = await requireReadAccess();
  const { id } = await context.params;
  const tree = await loadTree(id!);

  const fuzz = shouldFuzzCoordinates(user);
  const canSeeHistory = atLeast(user?.role, Role.REVIEWER) || tree.createdById === user?.id;

  return json({
    tree: {
      id: tree.id,
      latitude: fuzz ? fuzzCoordinate(tree.latitude) : tree.latitude,
      longitude: fuzz ? fuzzCoordinate(tree.longitude) : tree.longitude,
      coordinatesApproximate: fuzz,
      species: {
        id: tree.species.id,
        slug: tree.species.slug,
        nameEn: tree.species.nameEn,
        nameHy: tree.species.nameHy,
        category: tree.species.category,
      },
      ageBand: tree.ageBand,
      ageYearsEstimate: tree.ageYearsEstimate,
      condition: tree.condition,
      fruitQuality: tree.fruitQuality,
      notes: tree.notes,
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
      location: { source: tree.locationSource, accuracyM: tree.accuracyM },
      status: tree.status,
      photos: tree.photos.map((photo) => ({
        id: photo.id,
        storageKey: photo.storageKey,
        width: photo.width,
        height: photo.height,
        takenAt: photo.takenAt?.toISOString() ?? null,
      })),
      createdBy: tree.createdBy,
      createdAt: tree.createdAt.toISOString(),
      updatedAt: tree.updatedAt.toISOString(),
      // T8.5 — the change log, shown to the people entitled to see it.
      revisions: canSeeHistory
        ? tree.revisions.map((revision) => ({
            id: revision.id,
            action: revision.action,
            changedAt: revision.changedAt.toISOString(),
            by: revision.user?.name ?? null,
            diff: revision.diff,
          }))
        : [],
    },
    permissions: {
      canEdit: Boolean(
        user && (atLeast(user.role, Role.REVIEWER) || tree.createdById === user.id),
      ),
      canModerate: atLeast(user?.role, Role.REVIEWER),
    },
  });
});

export const PATCH = route('trees.update', async (request, context) => {
  const user = await requireUser();
  enforceWriteLimit(request, user.id, 'trees.update');

  const { id } = await context.params;
  const tree = await loadTree(id!);
  assertCanEditTree(user, tree);

  const input = updateTreeSchema.parse(await readJson(request));

  // Only a reviewer decides what is published, flagged or archived.
  if (input.status && !atLeast(user.role, Role.REVIEWER)) {
    throw forbidden('Only a reviewer can change a tree’s status');
  }

  if (input.speciesId) {
    const species = await prisma.species.findUnique({ where: { id: input.speciesId } });
    if (!species) throw badRequest('Unknown species', { field: 'speciesId' });
  }

  const data: Prisma.TreeUpdateInput = {};
  if (input.speciesId) data.species = { connect: { id: input.speciesId } };
  if (input.ageBand) data.ageBand = input.ageBand;
  if (input.ageYearsEstimate !== undefined) data.ageYearsEstimate = input.ageYearsEstimate ?? null;
  if (input.condition) data.condition = input.condition;
  if (input.fruitQuality) data.fruitQuality = input.fruitQuality;
  if (input.notes !== undefined) data.notes = input.notes ?? null;
  if (input.locationSource) data.locationSource = input.locationSource;
  if (input.accuracyM !== undefined) data.accuracyM = input.accuracyM;
  if (input.status) data.status = input.status as TreeStatus;

  const moved =
    (input.latitude !== undefined && input.latitude !== tree.latitude) ||
    (input.longitude !== undefined && input.longitude !== tree.longitude);

  if (input.latitude !== undefined) data.latitude = input.latitude;
  if (input.longitude !== undefined) data.longitude = input.longitude;

  // A manual address correction wins over anything the geocoder said (T4.3).
  if (input.addressOverride) {
    Object.assign(data, {
      addressLine: input.addressOverride.addressLine ?? null,
      city: input.addressOverride.city ?? null,
      district: input.addressOverride.district ?? null,
      region: input.addressOverride.region ?? null,
      country: input.addressOverride.country ?? null,
      countryCode: input.addressOverride.countryCode ?? null,
      postalCode: input.addressOverride.postalCode ?? null,
      geocodeStatus: GeocodeStatus.MANUAL,
    });
  } else if (moved) {
    // The pin moved, so the stored address describes the wrong place.
    const geocode = await resolveAddress(
      input.latitude ?? tree.latitude,
      input.longitude ?? tree.longitude,
    ).catch(() => null);

    if (geocode?.status === GeocodeStatus.OK) {
      Object.assign(data, {
        addressLine: geocode.address.addressLine,
        city: geocode.address.city,
        district: geocode.address.district,
        region: geocode.address.region,
        country: geocode.address.country,
        countryCode: geocode.address.countryCode,
        postalCode: geocode.address.postalCode,
        geocodeRaw: geocode.raw ?? Prisma.JsonNull,
        geocodeStatus: GeocodeStatus.OK,
      });
    } else {
      data.geocodeStatus = GeocodeStatus.PENDING;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.tree.update({ where: { id: tree.id }, data });
    const diff = diffTree(tree, next);

    if (Object.keys(diff).length > 0) {
      await tx.treeRevision.create({
        data: revisionData({ treeId: tree.id, userId: user.id, action: 'update', diff }),
      });
    }

    return next;
  });

  return json({ tree: { id: updated.id, updatedAt: updated.updatedAt.toISOString() } });
});

export const DELETE = route('trees.delete', async (request, context) => {
  const user = await requireUser();
  enforceWriteLimit(request, user.id, 'trees.delete');

  const { id } = await context.params;
  const tree = await loadTree(id!);
  assertCanEditTree(user, tree);

  await prisma.$transaction(async (tx) => {
    // Soft delete: field observations are expensive to collect and a mistaken
    // deletion should be recoverable.
    await tx.tree.update({
      where: { id: tree.id },
      data: { deletedAt: new Date(), status: TreeStatus.ARCHIVED },
    });
    await tx.treeRevision.create({
      data: revisionData({
        treeId: tree.id,
        userId: user.id,
        action: 'delete',
        diff: { deletedAt: { from: null, to: new Date().toISOString() } },
      }),
    });
  });

  return json({ deleted: true, id: tree.id });
});
