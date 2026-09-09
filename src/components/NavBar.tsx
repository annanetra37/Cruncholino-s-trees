'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useT } from '@/i18n/client';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import type { MessageKey } from '@/i18n';

type Props = {
  user: { name: string; role: string } | null;
};

const LINKS: Array<{ href: string; labelKey: MessageKey }> = [
  { href: '/dashboard', labelKey: 'nav.map' },
  { href: '/add', labelKey: 'nav.add' },
  { href: '/my-trees', labelKey: 'nav.myTrees' },
];

export function NavBar({ user }: Props) {
  const pathname = usePathname();
  const t = useT();
  const isStaff = user?.role === 'REVIEWER' || user?.role === 'ADMIN';

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-1 px-3 py-2">
        <Link href="/" className="mr-2 flex items-center gap-2 font-bold text-emerald-900">
          <span aria-hidden>🌳</span>
          <span className="hidden sm:inline">{t('app.name')}</span>
        </Link>

        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname === link.href ? 'page' : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              pathname === link.href
                ? 'bg-emerald-50 text-emerald-900'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {t(link.labelKey)}
          </Link>
        ))}

        {isStaff ? (
          <Link
            href="/admin"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              pathname.startsWith('/admin')
                ? 'bg-emerald-50 text-emerald-900'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {t('nav.admin')}
          </Link>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          {user ? (
            <>
              <span className="hidden text-sm text-stone-500 sm:inline" title={user.role}>
                {user.name}
              </span>
              <button type="button" className="btn-ghost" onClick={() => signOut()}>
                {t('common.signOut')}
              </button>
            </>
          ) : (
            <Link href="/signin" className="btn-ghost">
              {t('common.signIn')}
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
