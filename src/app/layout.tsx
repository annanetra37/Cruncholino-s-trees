import type { Metadata, Viewport } from 'next';
import { SessionProvider } from 'next-auth/react';
import { auth } from '@/lib/auth';
import { getT } from '@/i18n/server';
import { LocaleProvider } from '@/i18n/client';
import { NavBar } from '@/components/NavBar';
import { AppFooter } from '@/components/AppFooter';
import { OfflineQueueBanner } from '@/components/OfflineQueueBanner';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t('app.name'),
    description: t('app.description'),
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: 'Trees', statusBarStyle: 'default' },
  };
}

export const viewport: Viewport = {
  themeColor: '#1f4a2b',
  width: 'device-width',
  initialScale: 1,
  // The capture form is used one-handed outdoors; pinch-zoom must keep working.
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, { locale }] = await Promise.all([auth(), getT()]);

  return (
    // `lang` matters beyond correctness here: it is what tells a screen reader
    // to pronounce Armenian as Armenian.
    <html lang={locale}>
      <body className="flex min-h-full flex-col">
        <SessionProvider session={session}>
          <LocaleProvider locale={locale}>
            <NavBar
              user={
                session?.user
                  ? {
                      name: session.user.name ?? session.user.email ?? '',
                      role: session.user.role,
                    }
                  : null
              }
            />
            <ServiceWorkerRegistration />
            <OfflineQueueBanner />
            <main className="flex-1">{children}</main>
            <AppFooter />
          </LocaleProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
