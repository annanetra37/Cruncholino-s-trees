import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { canEditTree, getSessionUser } from '@/lib/authz';
import { EditTreeForm } from '@/components/EditTreeForm';

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
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Not your tree</h1>
        <p className="mt-2 text-stone-600">
          You can only edit trees you added. Ask a reviewer if this one needs correcting.
        </p>
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
