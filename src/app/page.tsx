import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { env } from '@/env';
import { getSessionUser } from '@/lib/authz';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [{ t, locale }, user] = await Promise.all([getT(), getSessionUser()]);

  // Aggregate counts only. With the dashboard login-gated (Q1), no individual
  // tree — and no coordinate — is reachable from this page.
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

  const gated = !env.PUBLIC_READ && !user;
  const number = (value: number) => value.toLocaleString(locale === 'hy' ? 'hy-AM' : 'en-GB');

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-emerald-900 sm:text-4xl">{t('home.title')}</h1>
      <p className="mt-3 text-lg text-stone-600">{t('home.subtitle')}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={user ? '/add' : '/signin?next=/add'} className="btn-primary text-lg">
          🌳 {t('home.addTree')}
        </Link>
        <Link
          href={gated ? '/signin?next=/dashboard' : '/dashboard'}
          className="btn-secondary text-lg"
        >
          {gated ? t('home.signInToOpen') : t('home.openMap')}
        </Link>
      </div>

      {gated ? <p className="mt-4 text-sm text-stone-500">{t('home.private')}</p> : null}

      <dl className="mt-10 grid grid-cols-3 gap-4">
        {[
          { label: t('home.statTrees'), value: trees },
          { label: t('home.statSpecies'), value: species },
          { label: t('home.statPlaces'), value: cities },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <dt className="text-sm text-stone-500">{stat.label}</dt>
            <dd className="text-2xl font-bold">{number(stat.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
