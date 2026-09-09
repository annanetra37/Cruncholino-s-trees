import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [trees, species, cities] = await Promise.all([
    prisma.tree.count({ where: { deletedAt: null, status: 'PUBLISHED' } }),
    prisma.species.count({ where: { isActive: true } }),
    prisma.tree
      .findMany({
        where: { deletedAt: null, status: 'PUBLISHED', city: { not: null } },
        distinct: ['city'],
        select: { city: true },
        take: 100,
      })
      .then((rows) => rows.length),
  ]).catch(() => [0, 0, 0] as const);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-emerald-900 sm:text-4xl">
        Map the fruit and nut trees around you
      </h1>
      <p className="mt-3 text-lg text-stone-600">
        Record a tree in under a minute: where it is, what it is, and how it’s doing. Everything
        recorded shows up on a shared map.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/add" className="btn-primary text-lg">
          🌳 Add a tree
        </Link>
        <Link href="/dashboard" className="btn-secondary text-lg">
          Open the map
        </Link>
      </div>

      <dl className="mt-10 grid grid-cols-3 gap-4">
        {[
          { label: 'Trees recorded', value: trees },
          { label: 'Species', value: species },
          { label: 'Places', value: cities },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <dt className="text-sm text-stone-500">{stat.label}</dt>
            <dd className="text-2xl font-bold">{stat.value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
