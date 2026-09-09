/**
 * T8.2 — the review queue: everything flagged or awaiting moderation.
 */
import { Role, TreeStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { json, notFound, readJson, route } from '@/lib/api';
import { requireRole } from '@/lib/authz';
import { revisionData } from '@/lib/trees/revisions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route('admin.review.list', async () => {
  await requireRole(Role.REVIEWER);

  const trees = await prisma.tree.findMany({
    where: { deletedAt: null, status: { in: [TreeStatus.FLAGGED, TreeStatus.DRAFT] } },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: {
      species: { select: { nameEn: true, nameHy: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });

  return json({
    items: trees.map((tree) => ({
      id: tree.id,
      species: tree.species.nameEn,
      status: tree.status,
      condition: tree.condition,
      city: tree.city,
      addressLine: tree.addressLine,
      latitude: tree.latitude,
      longitude: tree.longitude,
      notes: tree.notes,
      createdBy: tree.createdBy?.name ?? tree.createdBy?.email ?? null,
      createdAt: tree.createdAt.toISOString(),
    })),
  });
});

const decisionSchema = z.object({
  treeId: z.uuid(),
  decision: z.enum(['approve', 'reject', 'flag']),
});

export const POST = route('admin.review.decide', async (request) => {
  const user = await requireRole(Role.REVIEWER);
  const { treeId, decision } = decisionSchema.parse(await readJson(request));

  const tree = await prisma.tree.findFirst({ where: { id: treeId, deletedAt: null } });
  if (!tree) throw notFound('No such tree');

  const status =
    decision === 'approve'
      ? TreeStatus.PUBLISHED
      : decision === 'flag'
        ? TreeStatus.FLAGGED
        : TreeStatus.ARCHIVED;

  await prisma.$transaction(async (tx) => {
    await tx.tree.update({ where: { id: tree.id }, data: { status } });
    await tx.treeRevision.create({
      data: revisionData({
        treeId: tree.id,
        userId: user.id,
        action: 'update',
        diff: { status: { from: tree.status, to: status } },
      }),
    });
  });

  return json({ id: tree.id, status });
});
