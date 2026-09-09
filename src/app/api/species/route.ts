/**
 * T3.5 — the species picker's data source, and T8.1's create endpoint.
 */
import { Role, SpeciesCategory } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { json, readJson, route, badRequest } from '@/lib/api';
import { requireRole } from '@/lib/authz';

export const runtime = 'nodejs';
export const revalidate = 300;

export const GET = route('species.list', async (request) => {
  const includeInactive = new URL(request.url).searchParams.get('include_inactive') === 'true';

  const species = await prisma.species.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ category: 'asc' }, { nameEn: 'asc' }],
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameHy: true,
      category: true,
      isActive: true,
      _count: { select: { trees: true } },
    },
  });

  return json(
    {
      items: species.map((entry) => ({
        id: entry.id,
        slug: entry.slug,
        nameEn: entry.nameEn,
        nameHy: entry.nameHy,
        category: entry.category,
        isActive: entry.isActive,
        treeCount: entry._count.trees,
      })),
    },
    {
      headers: {
        // The species list changes a few times a year at most.
        'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      },
    },
  );
});

const createSpeciesSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Slug may contain lowercase letters, numbers and hyphens only'),
  nameEn: z.string().trim().min(1).max(120),
  nameHy: z.string().trim().max(120).optional().nullable(),
  category: z.enum(SpeciesCategory).default(SpeciesCategory.OTHER),
});

export const POST = route('species.create', async (request) => {
  await requireRole(Role.ADMIN);
  const input = createSpeciesSchema.parse(await readJson(request));

  const existing = await prisma.species.findUnique({ where: { slug: input.slug } });
  if (existing) throw badRequest(`A species with slug "${input.slug}" already exists`);

  const species = await prisma.species.create({ data: input });
  return json({ species }, { status: 201 });
});
