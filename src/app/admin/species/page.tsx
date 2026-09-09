import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/authz';
import { SpeciesAdmin } from '@/components/SpeciesAdmin';

export const dynamic = 'force-dynamic';

export default async function SpeciesAdminPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=/admin/species');
  if (user.role !== Role.ADMIN) redirect('/admin');

  const species = await prisma.species.findMany({
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold">Species</h1>
      <p className="mt-1 text-stone-600">
        Species is a table, not an enum — adding one takes effect immediately, with no deploy.
      </p>
      <SpeciesAdmin
        initial={species.map((entry) => ({
          id: entry.id,
          slug: entry.slug,
          nameEn: entry.nameEn,
          nameHy: entry.nameHy,
          category: entry.category,
          isActive: entry.isActive,
          treeCount: entry._count.trees,
        }))}
      />
    </div>
  );
}
