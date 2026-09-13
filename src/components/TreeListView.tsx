'use client';

/**
 * T5.6 — the same filtered data as a sortable table.
 *
 * "Which streets have the most dead trees" is a question a table answers in
 * seconds and a map answers badly.
 */
import {
  AGE_BANDS,
  CONDITIONS,
  FRUIT_QUALITIES,
  REACHABILITIES,
  SORT_OPTIONS,
  conditionColor,
  labelKeyFor,
} from '@/lib/constants';
import { useLocale } from '@/i18n/client';
import { speciesName, speciesSecondaryName } from '@/lib/species-name';
import type { TreeListResponse } from '@/lib/client/types';

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
  const { t, locale } = useLocale();
  const label = (list: Parameters<typeof labelKeyFor>[0], value: string) => {
    const key = labelKeyFor(list, value);
    return key ? t(key) : value;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-stone-500">{t('list.sort')}</span>
          <select
            className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
            value={sort}
            onChange={(event) => onSortChange(event.target.value)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-stone-500">
          {data
            ? t('list.results', { count: data.total.toLocaleString() })
            : loading
              ? t('common.loading')
              : ''}
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-stone-100 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">{t('field.species')}</th>
              <th className="px-3 py-2 font-semibold">{t('detail.condition')}</th>
              <th className="px-3 py-2 font-semibold">{t('detail.fruit')}</th>
              <th className="px-3 py-2 font-semibold">{t('detail.reach')}</th>
              <th className="px-3 py-2 font-semibold">{t('detail.age')}</th>
              <th className="px-3 py-2 font-semibold">{t('field.city')}</th>
              <th className="px-3 py-2 font-semibold">{t('list.address')}</th>
              <th className="px-3 py-2 font-semibold">{t('list.recorded')}</th>
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
                  {speciesName(tree.species, locale)}
                  {speciesSecondaryName(tree.species, locale) ? (
                    <span className="ml-1 text-stone-400">
                      {speciesSecondaryName(tree.species, locale)}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full ring-1 ring-black/20"
                      style={{ backgroundColor: conditionColor(tree.condition) }}
                    />
                    {label(CONDITIONS, tree.condition)}
                  </span>
                </td>
                <td className="px-3 py-2">{label(FRUIT_QUALITIES, tree.fruitQuality)}</td>
                <td className="px-3 py-2">{label(REACHABILITIES, tree.reachability)}</td>
                <td className="px-3 py-2">{label(AGE_BANDS, tree.ageBand)}</td>
                <td className="px-3 py-2">{tree.address.city ?? t('common.none')}</td>
                <td className="max-w-64 truncate px-3 py-2 text-stone-600">
                  {tree.address.line ?? t('common.none')}
                </td>
                <td className="px-3 py-2 text-stone-500">
                  {new Date(tree.createdAt).toLocaleDateString(locale === 'hy' ? 'hy-AM' : 'en-GB')}
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-stone-500">
                  {t('list.empty')}
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
            {t('list.previous')}
          </button>
          <span className="text-stone-500">
            {t('list.page', { page: data.page, pages: data.pages })}
          </span>
          <button
            type="button"
            className="btn-ghost"
            disabled={page >= data.pages}
            onClick={() => onPageChange(page + 1)}
          >
            {t('list.next')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
