'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export function SignInForm({
  emailProviderId,
  devProviderId,
  callbackUrl,
  error,
}: {
  emailProviderId: string | null;
  devProviderId: string | null;
  callbackUrl: string;
  error: string | null;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const hasEmail = emailProviderId !== null;
  const hasDevLogin = devProviderId !== null;

  if (!hasEmail && !hasDevLogin) {
    return (
      <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        No sign-in method is configured. Set <code className="font-mono">EMAIL_SERVER</code> for
        magic-link sign-in, or <code className="font-mono">AUTH_DEV_LOGIN=true</code> in development.
      </p>
    );
  }

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        await signIn(hasEmail ? emailProviderId! : devProviderId!, { email, callbackUrl });
        setBusy(false);
      }}
    >
      {error ? (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          Sign-in failed ({error}). Try again.
        </p>
      ) : null}

      <label className="block">
        <span className="field-label">Email address</span>
        <input
          type="email"
          className="field-input"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.org"
        />
      </label>

      <button type="submit" className="btn-primary w-full" disabled={busy || !email}>
        {busy ? 'Sending…' : hasEmail ? 'Email me a sign-in link' : 'Sign in (development)'}
      </button>

      {hasDevLogin ? (
        <p className="text-xs text-stone-500">
          Development sign-in is enabled: any address signs in immediately, no email sent. Try{' '}
          <code className="font-mono">admin@example.org</code>.
        </p>
      ) : null}
    </form>
  );
}
