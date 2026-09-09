/** Q4 — the bilingual interface. */
import { describe, expect, it } from 'vitest';
import { CATALOGUES, interpolate, translator } from '@/i18n';
import { en } from '@/i18n/messages/en';
import { hy } from '@/i18n/messages/hy';
import { LOCALES, isLocale, localeFromAcceptLanguage } from '@/i18n/config';
import {
  AGE_BANDS,
  CATEGORIES,
  CONDITIONS,
  FRUIT_QUALITIES,
  SORT_OPTIONS,
  TREE_STATUSES,
} from '@/lib/constants';
import { speciesName, speciesSecondaryName } from '@/lib/species-name';

describe('catalogues', () => {
  it('covers exactly the same keys in both languages', () => {
    // The type system already enforces this; the test states it as a fact so
    // the failure is readable if the types are ever loosened.
    expect(Object.keys(hy).sort()).toEqual(Object.keys(en).sort());
  });

  it('leaves no Armenian string empty where English has text', () => {
    const missing = Object.entries(en)
      .filter(([key, value]) => value !== '' && !hy[key as keyof typeof hy])
      .map(([key]) => key);
    expect(missing).toEqual([]);
  });

  it('keeps the placeholders of a message identical across languages', () => {
    // A translation that drops {count} renders a sentence with a hole in it.
    const placeholders = (value: string) => (value.match(/\{(\w+)\}/g) ?? []).sort();
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(placeholders(hy[key]), `placeholders differ for ${key}`).toEqual(
        placeholders(en[key]),
      );
    }
  });

  it('translates every enum label a component can ask for', () => {
    const t = translator('hy');
    const lists = [CONDITIONS, AGE_BANDS, FRUIT_QUALITIES, CATEGORIES, TREE_STATUSES, SORT_OPTIONS];
    for (const list of lists) {
      for (const entry of list) {
        const translated = t(entry.labelKey);
        expect(translated).toBeTruthy();
        // Untranslated keys fall through as the key itself.
        expect(translated).not.toBe(entry.labelKey);
      }
    }
  });
});

describe('translator', () => {
  it('substitutes placeholders', () => {
    expect(translator('en')('stats.trees', { count: 42 })).toBe('42 trees');
    expect(translator('hy')('stats.trees', { count: 42 })).toBe('42 ծառ');
  });

  it('leaves an unknown placeholder in place rather than printing undefined', () => {
    expect(interpolate('{a} and {b}', { a: 'x' })).toBe('x and {b}');
  });

  it('falls back to the key for a message that does not exist', () => {
    const t = translator('en');
    expect(t('nope.not.a.key' as never)).toBe('nope.not.a.key');
  });

  it('has a catalogue for every declared locale', () => {
    for (const locale of LOCALES) expect(CATALOGUES[locale]).toBeTruthy();
  });
});

describe('localeFromAcceptLanguage', () => {
  it('picks Armenian for an Armenian browser', () => {
    expect(localeFromAcceptLanguage('hy-AM,hy;q=0.9,en;q=0.8')).toBe('hy');
  });

  it('picks English when Armenian is not offered', () => {
    expect(localeFromAcceptLanguage('en-GB,en;q=0.9')).toBe('en');
  });

  it('respects the order the browser gave', () => {
    expect(localeFromAcceptLanguage('ru-RU,ru;q=0.9,hy;q=0.8,en;q=0.7')).toBe('hy');
  });

  it('returns null when nothing matches, so the caller can default', () => {
    expect(localeFromAcceptLanguage('ru-RU,ka;q=0.9')).toBeNull();
    expect(localeFromAcceptLanguage(null)).toBeNull();
    expect(localeFromAcceptLanguage('')).toBeNull();
  });

  it('validates locale strings', () => {
    expect(isLocale('hy')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('speciesName', () => {
  const apricot = { nameEn: 'Apricot', nameHy: 'Ծիրան' };
  const oak = { nameEn: 'Oak', nameHy: null };

  it('leads with the reader’s language and keeps the other alongside', () => {
    expect(speciesName(apricot, 'hy')).toBe('Ծիրան');
    expect(speciesSecondaryName(apricot, 'hy')).toBe('Apricot');
    expect(speciesName(apricot, 'en')).toBe('Apricot');
    expect(speciesSecondaryName(apricot, 'en')).toBe('Ծիրան');
  });

  it('falls back to English when a species has no Armenian name yet', () => {
    expect(speciesName(oak, 'hy')).toBe('Oak');
    expect(speciesSecondaryName(oak, 'hy')).toBeNull();
  });
});
