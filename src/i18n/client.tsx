'use client';

/**
 * The browser half of the translation setup.
 *
 * Both catalogues are bundled rather than streamed per locale: together they
 * are a few kilobytes, and it means switching language is instant and works
 * offline, which matters for an app whose capture flow is used with no signal.
 */
import { createContext, useCallback, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from '@/i18n/config';
import { translator, type Translate } from '@/i18n';

type LocaleContextValue = {
  locale: Locale;
  t: Translate;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const setLocale = useCallback((next: Locale) => {
    // A year, path-wide, lax: the switcher is a preference, not a session.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    // A full reload rather than router.refresh(): server components, metadata
    // and the <html lang> attribute all have to be re-rendered.
    window.location.reload();
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: translator(locale), setLocale }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  // Falling back keeps a component usable in isolation (a test, a Storybook
  // story) instead of throwing on a missing provider.
  if (!context) {
    return { locale: DEFAULT_LOCALE, t: translator(DEFAULT_LOCALE), setLocale: () => {} };
  }
  return context;
}

export function useT(): Translate {
  return useLocale().t;
}
