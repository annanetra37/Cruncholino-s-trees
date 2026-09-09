/**
 * Q4, decided: the interface ships in English and Armenian, both at launch.
 *
 * The locale is a cookie, not a URL segment. Two reasons: every route in this
 * app would otherwise need duplicating under /en and /hy, and a contributor
 * who shares a filtered dashboard link should not accidentally force the
 * recipient into their own language.
 */
export const LOCALES = ['en', 'hy'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_COOKIE = 'locale';

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  hy: 'Հայերեն',
};

export function isLocale(value: string | undefined | null): value is Locale {
  return LOCALES.includes(value as Locale);
}

/**
 * Picks a locale from an Accept-Language header. Deliberately simple: it looks
 * for a supported language tag in preference order and ignores quality values
 * beyond the ordering the header already gives.
 */
export function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;

  const tags = header
    .split(',')
    .map((part) => part.split(';')[0]?.trim().toLowerCase() ?? '')
    .filter(Boolean);

  for (const tag of tags) {
    const base = tag.split('-')[0];
    if (isLocale(base)) return base;
  }

  return null;
}
