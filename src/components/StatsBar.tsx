'use client';

/** T5.7 — count of trees in the current filter, split by condition and species. */
import { CONDITIONS, conditionColor, labelKeyFor } from '@/lib/constants';
import { useLocale } from '@/i18n/client';
import type { TreeStats } from '@/lib/client/types';

export function StatsBar({ stats, loading }: { stats: TreeStats | null; loading: boolean }) {
  const { t, locale } = useLocale();
  const number = (value: number) => value.toLocaleString(locale === 'hy' ? 'hy-AM' : 'en-GB');

  if (loading && !stats) {
    return (
      <div className="border-b border-stone-200 bg-white px-4 py-2 text-sm text-stone-500">
        {t('stats.counting')}
      </div>
    );
  }
  if (!stats) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-stone-200 bg-white px-4 py-2 text-sm">
      <span className="font-semibold">{t('stats.trees', { count: number(stats.total) })}</span>

      <div className="flex flex-wrap items-center gap-3">
        {stats.byCondition.map((entry) => {
          const key = labelKeyFor(CONDITIONS, entry.key);
          return (
            <span key={entry.key} className="flex items-center gap-1.5 text-stone-600">
              <span
                aria-hidden
                className="size-2.5 rounded-full ring-1 ring-black/20"
                style={{ backgroundColor: conditionColor(entry.key) }}
              />
              {key ? t(key) : entry.key} {number(entry.count)}
            </span>
          );
        })}
      </div>

      {stats.bySpecies.length ? (
        <div className="hidden flex-wrap items-center gap-3 text-stone-500 lg:flex">
          <span className="text-stone-400">|</span>
          {stats.bySpecies.slice(0, 5).map((entry) => (
            <span key={entry.key}>
              {entry.label} {number(entry.count)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
