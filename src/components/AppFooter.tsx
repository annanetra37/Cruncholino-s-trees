'use client';

import Link from 'next/link';
import { useT } from '@/i18n/client';

export function AppFooter() {
  const t = useT();

  return (
    <footer className="border-t border-stone-200 px-4 py-6 text-sm text-stone-500">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2">
        <span>{t('app.name')}</span>
        <Link className="hover:text-stone-800" href="/dashboard">
          {t('nav.dashboard')}
        </Link>
        <Link className="hover:text-stone-800" href="/add">
          {t('nav.add')}
        </Link>
        <a className="hover:text-stone-800" href="/api/health">
          {t('common.status')}
        </a>
      </div>
    </footer>
  );
}
