/**
 * Locale resolution for server components and route handlers.
 *
 * Order: the cookie the language switcher sets, then the browser's
 * Accept-Language, then English. Someone in Armenia who has never touched the
 * switcher gets Armenian; someone who has chosen a language keeps it.
 */
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, localeFromAcceptLanguage, type Locale } from '@/i18n/config';
import { translator, type Translate } from '@/i18n';

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const chosen = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  const headerList = await headers();
  return localeFromAcceptLanguage(headerList.get('accept-language')) ?? DEFAULT_LOCALE;
}

export async function getT(): Promise<{ t: Translate; locale: Locale }> {
  const locale = await getLocale();
  return { t: translator(locale), locale };
}
