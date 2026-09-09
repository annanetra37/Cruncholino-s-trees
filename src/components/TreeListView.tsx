'use client';

/**
 * T5.6 — the same filtered data as a sortable table.
 *
 * "Which streets have the most dead trees" is a question a table answers in
 * seconds and a map answers badly.
 */
import { AGE_BANDS, CONDITIONS, FRUIT_QUALITIES, conditionColor, labelFor } from '@/lib/constants';
import type { TreeListResponse } from '@/lib/client/types';

const SORTS = [
  { value: 'created_at:desc', label: 'Newest first' },
  { value: 'created_at:asc', label: 'Oldest first' },
  { value: 'species:asc', label: 'Species A–Z' },
  { value: 'condition:asc', label: 'Condition' },
  { value: 'city:asc', label: 'City A–Z' },
] as const;

export function TreeListView({
  data,
  loading,
  sort,
  page,
  onSortChange,
  onPageChange,
  onSelect,
}: {
  data: TreeListResponse | null;
  loading: boolean;
  sort: string;
  page: number;
  onSortChange: (sort: string) => void;
  onPageChange: (page: number) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-stone-500">Sort</span>
          <select
            className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
            value={sort}
            onChange={(event) => onSortChange(event.target.value)}
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-stone-500">
          {data ? `${data.total.toLocaleString()} results` : loading ? 'Loading…' : ''}
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-stone-100 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">Species</th>
              <th className="px-3 py-2 font-semibold">Condition</th>
              <th className="px-3 py-2 font-semibold">Fruit</th>
              <th className="px-3 py-2 font-semibold">Age</th>
              <th className="px-3 py-2 font-semibold">City</th>
              <th className="px-3 py-2 font-semibold">Address</th>
              <th className="px-3 py-2 font-semibold">Recorded</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((tree) => (
              <tr
                key={tree.id}
                tabIndex={0}
                role="button"
                onClick={() => onSelect(tree.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(tree.id);
                  }
                }}
                className="cursor-pointer border-b border-stone-100 hover:bg-emerald-50/60 focus:bg-emerald-50 focus:outline-2 focus:outline-emerald-600"
              >
                <td className="px-3 py-2">
                  {tree.species.nameEn}
                  {tree.species.nameHy ? (
                    <span className="ml-1 text-stone-400">{tree.species.nameHy}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full ring-1 ring-black/20"
                      style={{ backgroundColor: conditionColor(tree.condition) }}
                    />
                    {labelFor(CONDITIONS, tree.condition)}
                  </span>
                </td>
                <td className="px-3 py-2">{labelFor(FRUIT_QUALITIES, tree.fruitQuality)}</td>
                <td className="px-3 py-2">{labelFor(AGE_BANDS, tree.ageBand)}</td>
                <td className="px-3 py-2">{tree.address.city ?? '—'}</td>
                <td className="max-w-64 truncate px-3 py-2 text-stone-600">
                  {tree.address.line ?? '—'}
                </td>
                <td className="px-3 py-2 text-stone-500">
                  {new Date(tree.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-stone-500">
                  No trees match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 ? (
        <div className="flex items-center justify-between gap-3 border-t border-stone-200 bg-white px-4 py-2 text-sm">
          <button
            type="button"
            className="btn-ghost"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            ← Previous
          </button>
          <span className="text-stone-500">
            Page {data.page} of {data.pages}
          </span>
          <button
            type="button"
            className="btn-ghost"
            disabled={page >= data.pages}
            onClick={() => onPageChange(page + 1)}
          >
            Next →
          </button>
        </div>
      ) : null}
    </div>
  );
}
