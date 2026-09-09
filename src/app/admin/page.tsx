import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Role, TreeStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { atLeast, getSessionUser } from '@/lib/authz';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=/admin');
  if (!atLeast(user.role, Role.REVIEWER)) redirect('/dashboard');

  const [pending, flagged, failedGeocodes, species, trees] = await Promise.all([
    prisma.tree.count({ where: { deletedAt: null, status: TreeStatus.DRAFT } }),
    prisma.tree.count({ where: { deletedAt: null, status: TreeStatus.FLAGGED } }),
    prisma.tree.count({ where: { deletedAt: null, geocodeStatus: { in: ['FAILED', 'PENDING'] } } }),
    prisma.species.count(),
    prisma.tree.count({ where: { deletedAt: null } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold">Admin</h1>
      <p className="mt-1 text-stone-600">
        Signed in as {user.email} ({user.role.toLowerCase()}).
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Trees', value: trees },
          { label: 'Awaiting review', value: pending + flagged },
          { label: 'Species', value: species },
          { label: 'Address lookups to retry', value: failedGeocodes },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <dt className="text-sm text-stone-500">{stat.label}</dt>
            <dd className="text-2xl font-bold">{stat.value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/review" className="card block p-4 hover:border-emerald-600">
          <p className="font-semibold">Review queue</p>
          <p className="text-sm text-stone-600">
            Approve, reject or flag submissions waiting on a decision.
          </p>
        </Link>

        {user.role === Role.ADMIN ? (
          <Link href="/admin/species" className="card block p-4 hover:border-emerald-600">
            <p className="font-semibold">Species</p>
            <p className="text-sm text-stone-600">Add, rename, deactivate or merge duplicates.</p>
          </Link>
        ) : null}

        <a href="/api/export?format=csv" className="card block p-4 hover:border-emerald-600">
          <p className="font-semibold">Export CSV</p>
          <p className="text-sm text-stone-600">Every tree, with the dashboard’s filters applied.</p>
        </a>

        <a href="/api/export?format=geojson" className="card block p-4 hover:border-emerald-600">
          <p className="font-semibold">Export GeoJSON</p>
          <p className="text-sm text-stone-600">For QGIS and anything else that reads geometry.</p>
        </a>
      </div>
    </div>
  );
}
