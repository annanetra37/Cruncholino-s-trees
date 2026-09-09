import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/authz';
import { AddTreeForm } from '@/components/AddTreeForm';

export const dynamic = 'force-dynamic';

export default async function AddTreePage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=/add');

  const species = await prisma.species.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { nameEn: 'asc' }],
    select: { id: true, slug: true, nameEn: true, nameHy: true, category: true, isActive: true },
  });

  return (
    <div>
      <h1 className="px-4 pt-4 text-2xl font-bold">Add a tree</h1>
      <AddTreeForm species={species.map((entry) => ({ ...entry, treeCount: 0 }))} />
    </div>
  );
}
