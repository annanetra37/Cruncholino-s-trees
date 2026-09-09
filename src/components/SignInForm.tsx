'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useT } from '@/i18n/client';

export function SignInForm({
  emailProviderId,
  devProviderId,
  operatorProviderId,
  callbackUrl,
  error,
}: {
  emailProviderId: string | null;
  devProviderId: string | null;
  operatorProviderId: string | null;
  callbackUrl: string;
  error: string | null;
}) {
  const t = useT();
  // Each form owns its fields. They used to share one `email`, which meant the
  // password button stayed disabled until the *other* form's email box was
  // filled in — with nothing on screen saying so.
  const [linkEmail, setLinkEmail] = useState('');
  const [passwordEmail, setPasswordEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'link' | 'password' | null>(null);

  const hasEmail = emailProviderId !== null;
  const hasDevLogin = devProviderId !== null;
  const hasPassword = operatorProviderId !== null;

  if (!hasEmail && !hasDevLogin && !hasPassword) {
    return (
      <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        {t('signin.noMethod')}
      </p>
    );
  }

  const message =
    error === 'Configuration'
      ? t('signin.errorConfiguration')
      : error === 'Verification'
        ? t('signin.errorVerification')
        : error === 'AccessDenied'
          ? t('signin.errorAccessDenied')
          : error === 'CredentialsSignin'
            ? t('signin.errorCredentials')
            : error
              ? t('signin.failed', { error })
              : null;

  return (
    <div className="mt-6 space-y-6">
      {message ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
        >
          {message}
        </p>
      ) : null}

      {/* The magic link goes first when both are available: it gives each
          contributor their own account, which is what makes the "added by"
          on a tree mean anything. */}
      {hasEmail || hasDevLogin ? (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy('link');
            await signIn(hasEmail ? emailProviderId! : devProviderId!, {
              email: linkEmail,
              callbackUrl,
            });
            setBusy(null);
          }}
        >
          <label className="block">
            <span className="field-label">{t('signin.email')}</span>
            <input
              type="email"
              className="field-input"
              required
              autoComplete="email"
              value={linkEmail}
              onChange={(event) => setLinkEmail(event.target.value)}
              placeholder="you@example.org"
            />
          </label>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={busy !== null || !linkEmail}
          >
            {busy === 'link'
              ? t('signin.sending')
              : hasEmail
                ? t('signin.sendLink')
                : t('signin.devButton')}
          </button>

          {hasDevLogin ? <p className="text-xs text-stone-500">{t('signin.devHint')}</p> : null}
        </form>
      ) : null}

      {hasPassword && (hasEmail || hasDevLogin) ? (
        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-stone-400">
          <span className="h-px flex-1 bg-stone-200" />
          {t('signin.or')}
          <span className="h-px flex-1 bg-stone-200" />
        </div>
      ) : null}

      {hasPassword ? (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy('password');
            await signIn(operatorProviderId!, { email: passwordEmail, password, callbackUrl });
            setBusy(null);
          }}
        >
          <h2 className="text-sm font-semibold text-stone-700">{t('signin.passwordTitle')}</h2>

          <label className="block">
            <span className="field-label">{t('signin.email')}</span>
            <input
              type="email"
              className="field-input"
              required
              autoComplete="username"
              value={passwordEmail}
              onChange={(event) => setPasswordEmail(event.target.value)}
              placeholder="you@example.org"
            />
          </label>

          <label className="block">
            <span className="field-label">{t('signin.password')}</span>
            <input
              type="password"
              className="field-input"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <button
            type="submit"
            className={`${hasEmail || hasDevLogin ? 'btn-secondary' : 'btn-primary'} w-full`}
            disabled={busy !== null || !passwordEmail || !password}
          >
            {busy === 'password' ? t('signin.sending') : t('signin.passwordButton')}
          </button>
        </form>
      ) : null}
    </div>
  );
}
