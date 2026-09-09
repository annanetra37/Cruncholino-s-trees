'use client';

/** T8.2 — approve / reject / flag, one tree at a time. */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/client/api';
import { useLocale } from '@/i18n/client';

type Item = {
  id: string;
  species: string;
  status: string;
  condition: string;
  city: string | null;
  addressLine: string | null;
  latitude: number;
  longitude: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
};

export function ReviewQueue() {
  const { t, locale } = useLocale();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<{ items: Item[] }>('/api/admin/review')
      .then((response) => setItems(response.items))
      .catch((cause: Error) => setError(cause.message));
  }, []);

  useEffect(load, [load]);

  const decide = async (treeId: string, decision: 'approve' | 'reject' | 'flag') => {
    setBusy(treeId);
    try {
      await apiFetch('/api/admin/review', {
        method: 'POST',
        body: JSON.stringify({ treeId, decision }),
      });
      setItems((current) => current?.filter((item) => item.id !== treeId) ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('review.failed'));
    } finally {
      setBusy(null);
    }
  };

  if (error) return <p className="mt-6 text-sm text-red-700">{error}</p>;
  if (!items) return <p className="mt-6 text-stone-500">{t('common.loading')}</p>;
  if (items.length === 0) {
    return (
      <p className="mt-8 rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
        {t('review.empty')}
      </p>
    );
  }

  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li key={item.id} className="card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">
                {item.species}
                <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs uppercase text-stone-600">
                  {item.status}
                </span>
              </p>
              <p className="text-sm text-stone-600">
                {item.addressLine ?? `${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`}
                {item.city ? ` · ${item.city}` : ''}
              </p>
              <p className="text-xs text-stone-500">
                {item.createdBy ?? t('review.unknownContributor')} ·{' '}
                {new Date(item.createdAt).toLocaleString(locale === 'hy' ? 'hy-AM' : 'en-GB')}
              </p>
              {item.notes ? <p className="mt-2 text-sm">{item.notes}</p> : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href={`/dashboard?tree=${item.id}`} className="btn-ghost">
                {t('review.view')}
              </Link>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy === item.id}
                onClick={() => decide(item.id, 'flag')}
              >
                {t('review.flag')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy === item.id}
                onClick={() => decide(item.id, 'reject')}
              >
                {t('review.reject')}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy === item.id}
                onClick={() => decide(item.id, 'approve')}
              >
                {t('review.approve')}
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
