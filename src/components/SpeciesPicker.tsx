'use client';

/**
 * T4.2 — species selection.
 *
 * Search matches English and Armenian names regardless of interface language,
 * because the name someone reaches for is the one they know the tree by, not
 * the one the app is currently set to.
 */
import { useMemo, useState } from 'react';
import { CATEGORIES } from '@/lib/constants';
import { useLocale } from '@/i18n/client';
import { speciesName, speciesSecondaryName } from '@/lib/species-name';
import type { SpeciesOption } from '@/lib/client/types';

export function SpeciesPicker({
  species,
  value,
  onChange,
  error,
}: {
  species: SpeciesOption[];
  value: string | null;
  onChange: (id: string) => void;
  error?: string;
}) {
  const { t, locale } = useLocale();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? species.filter(
          (entry) =>
            entry.nameEn.toLowerCase().includes(needle) ||
            entry.slug.includes(needle) ||
            (entry.nameHy ?? '').toLowerCase().includes(needle),
        )
      : species;

    return CATEGORIES.map((category) => ({
      ...category,
      options: matches.filter((entry) => entry.category === category.value),
    })).filter((group) => group.options.length > 0);
  }, [query, species]);

  return (
    <div>
      <label className="field-label" htmlFor="species-search">
        {t('species.label')} <span className="text-red-600">*</span>
      </label>
      <input
        id="species-search"
        type="search"
        className="field-input mb-3"
        placeholder={t('species.searchPlaceholder')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
      />

      {error ? <p className="mb-2 text-sm text-red-700">{error}</p> : null}

      <div
        className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-stone-200 p-3"
        role="radiogroup"
        aria-label={t('species.label')}
      >
        {groups.map((group) => (
          <div key={group.value}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
              {t(group.labelKey)}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.options.map((option) => {
                const secondary = speciesSecondaryName(option, locale);
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={value === option.id}
                    className={`${
                      value === option.id ? 'chip-on' : 'chip-off'
                    } min-h-11 px-4 text-base`}
                    onClick={() => onChange(option.id)}
                  >
                    <span>{speciesName(option, locale)}</span>
                    {secondary ? <span className="opacity-70">{secondary}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {groups.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-500">
            {t('species.noMatch', { query })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
