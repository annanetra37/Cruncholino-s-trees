import type { Locale } from '@/i18n/config';

type NamedSpecies = { nameEn: string; nameHy?: string | null };

/**
 * Which name leads, and which follows in muted text.
 *
 * Both are always shown. A contributor who knows the tree as ծիրան and a
 * reviewer who knows it as an apricot have to be able to find each other's
 * records, and the search in the species picker matches on both regardless of
 * interface language.
 */
export function speciesName(species: NamedSpecies, locale: Locale): string {
  if (locale === 'hy' && species.nameHy) return species.nameHy;
  return species.nameEn;
}

export function speciesSecondaryName(species: NamedSpecies, locale: Locale): string | null {
  if (locale === 'hy') return species.nameHy ? species.nameEn : null;
  return species.nameHy ?? null;
}
