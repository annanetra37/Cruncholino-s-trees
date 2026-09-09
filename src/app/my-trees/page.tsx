/** T4.6 — the contributor's own submissions, including drafts. */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/authz';
import { getT } from '@/i18n/server';
import { speciesName, speciesSecondaryName } from '@/lib/species-name';
import { CONDITIONS, FRUIT_QUALITIES, conditionColor, labelKeyFor } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function MyTreesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=/my-trees');

  const { t, locale } = await getT();

  const trees = await prisma.tree.findMany({
    where: { createdById: user.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { species: { select: { nameEn: true, nameHy: true } } },
  });

  const label = (list: Parameters<typeof labelKeyFor>[0], value: string) => {
    const key = labelKeyFor(list, value);
    return key ? t(key) : value;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('myTrees.title')}</h1>
        <Link href="/add" className="btn-primary">
          {t('nav.add')}
        </Link>
      </div>

      {trees.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
          {t('myTrees.empty')}
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {trees.map((tree) => {
            const secondary = speciesSecondaryName(tree.species, locale);
            return (
              <li key={tree.id} className="card flex flex-wrap items-center gap-3 p-3">
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full ring-1 ring-black/20"
                  style={{ backgroundColor: conditionColor(tree.condition) }}
                />
                <div className="min-w-40 flex-1">
                  <p className="font-semibold">
                    {speciesName(tree.species, locale)}
                    {secondary ? (
                      <span className="ml-1 font-normal text-stone-400">{secondary}</span>
                    ) : null}
                  </p>
                  <p className="text-sm text-stone-500">
                    {tree.addressLine ??
                      `${tree.latitude.toFixed(4)}, ${tree.longitude.toFixed(4)}`}
                  </p>
                </div>

                <p className="text-sm text-stone-600">
                  {label(CONDITIONS, tree.condition)} ·{' '}
                  {label(FRUIT_QUALITIES, tree.fruitQuality)}
                </p>

                {tree.status !== 'PUBLISHED' ? (
                  <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium uppercase text-stone-600">
                    {tree.status}
                  </span>
                ) : null}

                <div className="flex gap-2">
                  <Link href={`/trees/${tree.id}/edit`} className="btn-ghost">
                    {t('common.edit')}
                  </Link>
                  <Link href={`/dashboard?tree=${tree.id}`} className="btn-ghost">
                    {t('nav.map')}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
