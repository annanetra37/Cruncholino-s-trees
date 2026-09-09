/**
 * Translation lookup, shared by the server and the browser.
 */
import { DEFAULT_LOCALE, type Locale } from '@/i18n/config';
import { en, type MessageKey, type Messages } from '@/i18n/messages/en';
import { hy } from '@/i18n/messages/hy';

export type { MessageKey, Messages };

export const CATALOGUES: Record<Locale, Messages> = { en, hy };

export type TranslateVars = Record<string, string | number>;

export function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export type Translate = (key: MessageKey, vars?: TranslateVars) => string;

/**
 * Falls back to English for a key the catalogue is missing, and to the key
 * itself if even that is absent. A half-translated page is bad; a page that
 * renders `undefined` where a button label should be is worse.
 */
export function translator(locale: Locale): Translate {
  const catalogue = CATALOGUES[locale] ?? CATALOGUES[DEFAULT_LOCALE];
  return (key, vars) => interpolate(catalogue[key] ?? en[key] ?? key, vars);
}
