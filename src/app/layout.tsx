import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { SessionProvider } from 'next-auth/react';
import { auth } from '@/lib/auth';
import { NavBar } from '@/components/NavBar';
import { OfflineQueueBanner } from '@/components/OfflineQueueBanner';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cruncholino Trees',
  description: 'Map the fruit and nut trees around you.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Trees', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#1f4a2b',
  width: 'device-width',
  initialScale: 1,
  // The capture form is used one-handed outdoors; pinch-zoom must keep working.
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en">
      <body className="flex min-h-full flex-col">
        <SessionProvider session={session}>
          <NavBar
            user={
              session?.user
                ? {
                    name: session.user.name ?? session.user.email ?? 'Signed in',
                    role: session.user.role,
                  }
                : null
            }
          />
          <ServiceWorkerRegistration />
          <OfflineQueueBanner />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-stone-200 px-4 py-6 text-sm text-stone-500">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2">
              <span>Cruncholino Trees</span>
              <Link className="hover:text-stone-800" href="/dashboard">
                Dashboard
              </Link>
              <Link className="hover:text-stone-800" href="/add">
                Add a tree
              </Link>
              <a className="hover:text-stone-800" href="/api/health">
                Status
              </a>
            </div>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
