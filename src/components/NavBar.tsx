'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

type Props = {
  user: { name: string; role: string } | null;
};

const LINKS = [
  { href: '/dashboard', label: 'Map' },
  { href: '/add', label: 'Add a tree' },
  { href: '/my-trees', label: 'My trees' },
];

export function NavBar({ user }: Props) {
  const pathname = usePathname();
  const isStaff = user?.role === 'REVIEWER' || user?.role === 'ADMIN';

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-1 px-3 py-2">
        <Link href="/" className="mr-2 flex items-center gap-2 font-bold text-emerald-900">
          <span aria-hidden>🌳</span>
          <span className="hidden sm:inline">Cruncholino Trees</span>
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
            {link.label}
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
            Admin
          </Link>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-sm text-stone-500 sm:inline" title={user.role}>
                {user.name}
              </span>
              <button type="button" className="btn-ghost" onClick={() => signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <Link href="/signin" className="btn-ghost">
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
