import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { authMethods } from '@/lib/auth';
import { getSessionUser } from '@/lib/authz';
import { SignInForm } from '@/components/SignInForm';

export const dynamic = 'force-dynamic';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(next ?? '/dashboard');

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-2 text-stone-600">
        We’ll email you a link — there’s no password to remember or lose.
      </p>
      <Suspense>
        <SignInForm
          emailProviderId={authMethods.emailProviderId}
          devProviderId={authMethods.devProviderId}
          callbackUrl={next ?? '/dashboard'}
          error={error ?? null}
        />
      </Suspense>
    </div>
  );
}
