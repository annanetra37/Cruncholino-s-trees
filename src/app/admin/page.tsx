import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Role, TreeStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { atLeast, getSessionUser } from '@/lib/authz';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=/admin');
  if (!atLeast(user.role, Role.REVIEWER)) redirect('/dashboard');

  const { t } = await getT();

  const [pending, flagged, failedGeocodes, species, trees] = await Promise.all([
    prisma.tree.count({ where: { deletedAt: null, status: TreeStatus.DRAFT } }),
    prisma.tree.count({ where: { deletedAt: null, status: TreeStatus.FLAGGED } }),
    prisma.tree.count({ where: { deletedAt: null, geocodeStatus: { in: ['FAILED', 'PENDING'] } } }),
    prisma.species.count(),
    prisma.tree.count({ where: { deletedAt: null } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold">{t('admin.title')}</h1>
      <p className="mt-1 text-stone-600">
        {t('admin.signedInAs', { email: user.email, role: user.role.toLowerCase() })}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: t('admin.statTrees'), value: trees },
          { label: t('admin.statAwaiting'), value: pending + flagged },
          { label: t('admin.statSpecies'), value: species },
          { label: t('admin.statGeocodes'), value: failedGeocodes },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <dt className="text-sm text-stone-500">{stat.label}</dt>
            <dd className="text-2xl font-bold">{stat.value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/review" className="card block p-4 hover:border-emerald-600">
          <p className="font-semibold">{t('admin.reviewTitle')}</p>
          <p className="text-sm text-stone-600">{t('admin.reviewBody')}</p>
        </Link>

        {user.role === Role.ADMIN ? (
          <Link href="/admin/species" className="card block p-4 hover:border-emerald-600">
            <p className="font-semibold">{t('admin.speciesTitle')}</p>
            <p className="text-sm text-stone-600">{t('admin.speciesBody')}</p>
          </Link>
        ) : null}

        <a href="/api/export?format=csv" className="card block p-4 hover:border-emerald-600">
          <p className="font-semibold">{t('admin.exportCsvTitle')}</p>
          <p className="text-sm text-stone-600">{t('admin.exportCsvBody')}</p>
        </a>

        <a href="/api/export?format=geojson" className="card block p-4 hover:border-emerald-600">
          <p className="font-semibold">{t('admin.exportGeojsonTitle')}</p>
          <p className="text-sm text-stone-600">{t('admin.exportGeojsonBody')}</p>
        </a>
      </div>
    </div>
  );
}
