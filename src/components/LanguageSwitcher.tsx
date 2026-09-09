'use client';

import { LOCALES, LOCALE_NAMES } from '@/i18n/config';
import { useLocale } from '@/i18n/client';

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className="flex rounded-lg border border-stone-300 p-0.5"
      role="group"
      aria-label={t('language.label')}
    >
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={locale === option}
          onClick={() => setLocale(option)}
          className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
            locale === option ? 'bg-stone-800 text-white' : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          {option === 'en' ? 'EN' : 'ՀԱՅ'}
          <span className="sr-only"> — {LOCALE_NAMES[option]}</span>
        </button>
      ))}
    </div>
  );
}
