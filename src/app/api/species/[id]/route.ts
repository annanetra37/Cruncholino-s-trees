/**
 * T8.1 — species management: rename, deactivate, or merge duplicates.
 *
 * Deactivating rather than deleting is the default: a species with trees
 * attached cannot be deleted without either orphaning or silently rewriting
 * field observations. Merging is the honest way to fix a duplicate, and it is
 * recorded on every affected tree.
 */
import { Role, SpeciesCategory } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { badRequest, json, notFound, readJson, route } from '@/lib/api';
import { requireRole } from '@/lib/authz';
import { revisionData } from '@/lib/trees/revisions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  nameEn: z.string().trim().min(1).max(120).optional(),
  nameHy: z.string().trim().max(120).nullable().optional(),
  category: z.enum(SpeciesCategory).optional(),
  isActive: z.boolean().optional(),
  /** Move every tree of this species onto another, then deactivate this one. */
  mergeIntoId: z.uuid().optional(),
});

export const PATCH = route('species.update', async (request, context) => {
  const user = await requireRole(Role.ADMIN);
  const { id } = await context.params;

  const species = await prisma.species.findUnique({ where: { id } });
  if (!species) throw notFound('No such species');

  const input = patchSchema.parse(await readJson(request));

  if (input.mergeIntoId) {
    if (input.mergeIntoId === species.id) throw badRequest('Cannot merge a species into itself');

    const target = await prisma.species.findUnique({ where: { id: input.mergeIntoId } });
    if (!target) throw badRequest('The species to merge into does not exist');

    const moved = await prisma.$transaction(async (tx) => {
      const trees = await tx.tree.findMany({
        where: { speciesId: species.id },
        select: { id: true },
      });

      await tx.tree.updateMany({
        where: { speciesId: species.id },
        data: { speciesId: target.id },
      });

      // Reclassifying someone's observation is a real change to their record;
      // it belongs in the audit trail like any other edit.
      if (trees.length) {
        await tx.treeRevision.createMany({
          data: trees.map((tree) =>
            revisionData({
              treeId: tree.id,
              userId: user.id,
              action: 'update',
              diff: { speciesId: { from: species.slug, to: target.slug } },
            }),
          ),
        });
      }

      await tx.species.update({ where: { id: species.id }, data: { isActive: false } });
      return trees.length;
    });

    return json({ merged: true, movedTrees: moved, into: target.slug });
  }

  const updated = await prisma.species.update({
    where: { id: species.id },
    data: {
      nameEn: input.nameEn,
      nameHy: input.nameHy,
      category: input.category,
      isActive: input.isActive,
    },
  });

  return json({ species: updated });
});
