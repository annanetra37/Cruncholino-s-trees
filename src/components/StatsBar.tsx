'use client';

/** T5.7 — count of trees in the current filter, split by condition and species. */
import { conditionColor, conditionLabel } from '@/lib/constants';
import type { TreeStats } from '@/lib/client/types';

export function StatsBar({ stats, loading }: { stats: TreeStats | null; loading: boolean }) {
  if (loading && !stats) {
    return (
      <div className="border-b border-stone-200 bg-white px-4 py-2 text-sm text-stone-500">
        Counting trees…
      </div>
    );
  }
  if (!stats) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-stone-200 bg-white px-4 py-2 text-sm">
      <span className="font-semibold">
        {stats.total.toLocaleString()} tree{stats.total === 1 ? '' : 's'}
      </span>

      <div className="flex flex-wrap items-center gap-3">
        {stats.byCondition.map((entry) => (
          <span key={entry.key} className="flex items-center gap-1.5 text-stone-600">
            <span
              aria-hidden
              className="size-2.5 rounded-full ring-1 ring-black/20"
              style={{ backgroundColor: conditionColor(entry.key) }}
            />
            {conditionLabel(entry.key)} {entry.count.toLocaleString()}
          </span>
        ))}
      </div>

      {stats.bySpecies.length ? (
        <div className="hidden flex-wrap items-center gap-3 text-stone-500 lg:flex">
          <span className="text-stone-400">|</span>
          {stats.bySpecies.slice(0, 5).map((entry) => (
            <span key={entry.key}>
              {entry.label} {entry.count.toLocaleString()}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
