'use client';

/**
 * T5.4 — the filter panel.
 *
 * Filters live in the URL query string, so a filtered view is shareable and
 * bookmarkable, survives a reload, and can be pasted into a bug report.
 */
import { useMemo } from 'react';
import { AGE_BANDS, CATEGORIES, CONDITIONS, FRUIT_QUALITIES } from '@/lib/constants';
import { useLocale } from '@/i18n/client';
import { speciesName, speciesSecondaryName } from '@/lib/species-name';
import { regionNameHy } from '@/lib/geocode/armenia';
import type { MessageKey } from '@/i18n';
import type { LocationFilters, SpeciesOption } from '@/lib/client/types';

export type Filters = {
  species: string[];
  age_band: string[];
  condition: string[];
  fruit_quality: string[];
  city: string;
  region: string;
  q: string;
};

export const EMPTY_FILTERS: Filters = {
  species: [],
  age_band: [],
  condition: [],
  fruit_quality: [],
  city: '',
  region: '',
  q: '',
};

type Props = {
  filters: Filters;
  species: SpeciesOption[];
  locations: LocationFilters | null;
  resultCount: number | null;
  onChange: (next: Filters) => void;
};

export function FilterPanel({ filters, species, locations, resultCount, onChange }: Props) {
  const { t, locale } = useLocale();

  const grouped = useMemo(() => {
    return CATEGORIES.map((category) => ({
      ...category,
      options: species.filter((entry) => entry.category === category.value),
    })).filter((group) => group.options.length > 0);
  }, [species]);

  const activeCount =
    filters.species.length +
    filters.age_band.length +
    filters.condition.length +
    filters.fruit_quality.length +
    (filters.city ? 1 : 0) +
    (filters.region ? 1 : 0) +
    (filters.q ? 1 : 0);

  const toggle = (key: keyof Filters, value: string) => {
    const current = filters[key] as string[];
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next });
  };

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">{t('filters.title')}</h2>
          <p className="text-sm text-stone-500" aria-live="polite">
            {resultCount === null
              ? t('filters.counting')
              : t('filters.matchCount', { count: resultCount.toLocaleString() })}
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          disabled={activeCount === 0}
          onClick={() => onChange(EMPTY_FILTERS)}
        >
          {activeCount ? t('filters.resetWithCount', { count: activeCount }) : t('common.reset')}
        </button>
      </div>

      <label className="block">
        <span className="field-label">{t('filters.searchLabel')}</span>
        <input
          type="search"
          className="field-input"
          value={filters.q}
          placeholder={t('filters.searchPlaceholder')}
          onChange={(event) => onChange({ ...filters, q: event.target.value })}
        />
      </label>

      <fieldset>
        <legend className="field-label">{t('field.species')}</legend>
        <div className="space-y-3">
          {grouped.map((group) => (
            <div key={group.value}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                {t(group.labelKey)}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.options.map((option) => {
                  const secondary = speciesSecondaryName(option, locale);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={filters.species.includes(option.slug)}
                      className={filters.species.includes(option.slug) ? 'chip-on' : 'chip-off'}
                      onClick={() => toggle('species', option.slug)}
                    >
                      {speciesName(option, locale)}
                      {secondary ? <span className="opacity-70">{secondary}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <ChipGroup
        legendKey="detail.condition"
        options={CONDITIONS}
        selected={filters.condition}
        onToggle={(value) => toggle('condition', value)}
      />
      <ChipGroup
        legendKey="detail.age"
        options={AGE_BANDS}
        selected={filters.age_band}
        onToggle={(value) => toggle('age_band', value)}
      />
      <ChipGroup
        legendKey="field.fruitQuality"
        options={FRUIT_QUALITIES}
        selected={filters.fruit_quality}
        onToggle={(value) => toggle('fruit_quality', value)}
      />

      <label className="block">
        <span className="field-label">{t('field.city')}</span>
        <select
          className="field-input"
          value={filters.city}
          onChange={(event) => onChange({ ...filters, city: event.target.value })}
        >
          <option value="">{t('filters.anyCity')}</option>
          {locations?.cities.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.value} ({entry.count})
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="field-label">{t('field.region')}</span>
        <select
          className="field-input"
          value={filters.region}
          onChange={(event) => onChange({ ...filters, region: event.target.value })}
        >
          <option value="">{t('filters.anyRegion')}</option>
          {locations?.regions.map((entry) => {
            // Regions are stored canonically in English (see
            // lib/geocode/armenia.ts) and shown in Armenian when there is an
            // Armenian name for the marz. The value sent to the API is always
            // the stored one, so a shared URL means the same thing either way.
            const armenian = locale === 'hy' ? regionNameHy(entry.value) : null;
            return (
              <option key={entry.value} value={entry.value}>
                {armenian ?? entry.value} ({entry.count})
              </option>
            );
          })}
        </select>
      </label>
    </div>
  );
}

function ChipGroup({
  legendKey,
  options,
  selected,
  onToggle,
}: {
  legendKey: MessageKey;
  options: ReadonlyArray<{ value: string; labelKey: MessageKey; color?: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const { t } = useLocale();

  return (
    <fieldset>
      <legend className="field-label">{t(legendKey)}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected.includes(option.value)}
            className={selected.includes(option.value) ? 'chip-on' : 'chip-off'}
            onClick={() => onToggle(option.value)}
          >
            {option.color ? (
              <span
                aria-hidden
                className="size-2.5 rounded-full ring-1 ring-black/20"
                style={{ backgroundColor: option.color }}
              />
            ) : null}
            {t(option.labelKey)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
