'use client';

/**
 * T4.2 — species selection.
 *
 * A searchable list grouped by category, matching on both English and Armenian
 * names. Typing is optional: the whole list is reachable by tapping, because
 * getting a keyboard up on a phone in bright sunlight while holding a branch
 * out of the way is the slowest part of the flow.
 */
import { useMemo, useState } from 'react';
import { CATEGORIES } from '@/lib/constants';
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
        Species <span className="text-red-600">*</span>
      </label>
      <input
        id="species-search"
        type="search"
        className="field-input mb-3"
        placeholder="Search — apricot, ծիրան…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
      />

      {error ? <p className="mb-2 text-sm text-red-700">{error}</p> : null}

      <div
        className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-stone-200 p-3"
        role="radiogroup"
        aria-label="Species"
      >
        {groups.map((group) => (
          <div key={group.value}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.options.map((option) => (
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
                  <span>{option.nameEn}</span>
                  {option.nameHy ? <span className="opacity-70">{option.nameHy}</span> : null}
                </button>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-500">
            No species matches “{query}”. Ask an admin to add it.
          </p>
        ) : null}
      </div>
    </div>
  );
}
