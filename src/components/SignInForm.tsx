'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useT } from '@/i18n/client';

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
  const t = useT();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const hasEmail = emailProviderId !== null;
  const hasDevLogin = devProviderId !== null;

  if (!hasEmail && !hasDevLogin) {
    return (
      <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        {t('signin.noMethod')}
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
          {t('signin.failed', { error })}
        </p>
      ) : null}

      <label className="block">
        <span className="field-label">{t('signin.email')}</span>
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
        {busy ? t('signin.sending') : hasEmail ? t('signin.sendLink') : t('signin.devButton')}
      </button>

      {hasDevLogin ? (
        <p className="text-xs text-stone-500">{t('signin.devHint')}</p>
      ) : null}
    </form>
  );
}
