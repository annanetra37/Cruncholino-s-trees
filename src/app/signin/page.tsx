import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { authMethods } from '@/lib/auth';
import { getSessionUser } from '@/lib/authz';
import { SignInForm } from '@/components/SignInForm';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(next ?? '/dashboard');

  const { t } = await getT();

  // The page used to promise "no password to remember" while showing a
  // password field. Say what this deployment actually offers.
  const hasLink = authMethods.emailProviderId !== null || authMethods.devProviderId !== null;
  const hasPassword = authMethods.operatorProviderId !== null;
  const subtitleKey = hasPassword
    ? hasLink
      ? 'signin.subtitleBoth'
      : 'signin.subtitlePassword'
    : 'signin.subtitle';

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">{t('signin.title')}</h1>
      <p className="mt-2 text-stone-600">{t(subtitleKey)}</p>
      <Suspense>
        <SignInForm
          emailProviderId={authMethods.emailProviderId}
          devProviderId={authMethods.devProviderId}
          operatorProviderId={authMethods.operatorProviderId}
          callbackUrl={next ?? '/dashboard'}
          error={error ?? null}
        />
      </Suspense>
    </div>
  );
}
