import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { canEditTree, getSessionUser } from '@/lib/authz';
import { EditTreeForm } from '@/components/EditTreeForm';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function EditTreePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/signin?next=/trees/${id}/edit`);

  const tree = await prisma.tree.findFirst({
    where: { id, deletedAt: null },
    include: { species: true },
  });
  if (!tree) notFound();

  if (!canEditTree(user, tree)) {
    const { t } = await getT();
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">{t('edit.notYours')}</h1>
        <p className="mt-2 text-stone-600">{t('edit.notYoursBody')}</p>
      </div>
    );
  }

  const species = await prisma.species.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { nameEn: 'asc' }],
    select: { id: true, slug: true, nameEn: true, nameHy: true, category: true, isActive: true },
  });

  return (
    <EditTreeForm
      species={species.map((entry) => ({ ...entry, treeCount: 0 }))}
      canModerate={user.role !== 'CONTRIBUTOR'}
      tree={{
        id: tree.id,
        speciesId: tree.speciesId,
        latitude: tree.latitude,
        longitude: tree.longitude,
        condition: tree.condition,
        ageBand: tree.ageBand,
        fruitQuality: tree.fruitQuality,
        notes: tree.notes,
        status: tree.status,
        city: tree.city,
        region: tree.region,
        addressLine: tree.addressLine,
      }}
    />
  );
}
