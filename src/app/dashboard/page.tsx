import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { env } from '@/env';
import { atLeast, getSessionUser } from '@/lib/authz';
import { DashboardView } from '@/components/DashboardView';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getSessionUser();

  // T7.3 — a login-gated deployment redirects rather than rendering an empty map.
  if (!user && !env.PUBLIC_READ) redirect('/signin?next=/dashboard');

  // The species list is small, stable and needed before the first paint, so it
  // is rendered in rather than fetched by the client.
  const species = await prisma.species.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { nameEn: 'asc' }],
    select: { id: true, slug: true, nameEn: true, nameHy: true, category: true, isActive: true },
  });

  return (
    <Suspense fallback={<p className="p-6 text-stone-500">Loading dashboard…</p>}>
      <DashboardView
        species={species.map((entry) => ({ ...entry, treeCount: 0 }))}
        photoBaseUrl={env.R2_PUBLIC_URL ?? ''}
        canExport={atLeast(user?.role, Role.REVIEWER)}
      />
    </Suspense>
  );
}
