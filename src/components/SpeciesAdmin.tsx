'use client';

/** T8.1 — add, rename, deactivate and merge species. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES } from '@/lib/constants';
import { useT } from '@/i18n/client';
import { apiFetch } from '@/lib/client/api';
import type { SpeciesOption } from '@/lib/client/types';

export function SpeciesAdmin({ initial }: { initial: SpeciesOption[] }) {
  const router = useRouter();
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ slug: '', nameEn: '', nameHy: '', category: 'FRUIT' });
  const [mergeFrom, setMergeFrom] = useState<string | null>(null);

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('speciesAdmin.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 space-y-8">
      <form
        className="card grid gap-3 p-4 sm:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await apiFetch('/api/species', { method: 'POST', body: JSON.stringify(draft) });
            setDraft({ slug: '', nameEn: '', nameHy: '', category: 'FRUIT' });
          });
        }}
      >
        <label className="block">
          <span className="field-label">{t('speciesAdmin.slug')}</span>
          <input
            className="field-input"
            required
            pattern="[a-z0-9\-]+"
            value={draft.slug}
            onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
            placeholder="medlar"
          />
        </label>
        <label className="block">
          <span className="field-label">{t('speciesAdmin.english')}</span>
          <input
            className="field-input"
            required
            value={draft.nameEn}
            onChange={(event) => setDraft({ ...draft, nameEn: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="field-label">{t('speciesAdmin.armenian')}</span>
          <input
            className="field-input"
            value={draft.nameHy}
            onChange={(event) => setDraft({ ...draft, nameHy: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="field-label">{t('speciesAdmin.category')}</span>
          <select
            className="field-input"
            value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
          >
            {CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {t(category.labelKey)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-primary self-end" disabled={busy}>
          {t('speciesAdmin.add')}
        </button>
      </form>

      {error ? (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      ) : null}

      <table className="w-full text-sm">
        <thead className="bg-stone-100 text-left">
          <tr>
            <th className="px-3 py-2">{t('speciesAdmin.species')}</th>
            <th className="px-3 py-2">{t('speciesAdmin.category')}</th>
            <th className="px-3 py-2">{t('speciesAdmin.trees')}</th>
            <th className="px-3 py-2">{t('speciesAdmin.active')}</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {initial.map((entry) => (
            <tr key={entry.id} className="border-b border-stone-100">
              <td className="px-3 py-2">
                <span className="font-medium">{entry.nameEn}</span>
                {entry.nameHy ? <span className="ml-2 text-stone-400">{entry.nameHy}</span> : null}
                <span className="ml-2 font-mono text-xs text-stone-400">{entry.slug}</span>
              </td>
              <td className="px-3 py-2">{entry.category}</td>
              <td className="px-3 py-2">{entry.treeCount}</td>
              <td className="px-3 py-2">
                {entry.isActive ? t('speciesAdmin.yes') : t('speciesAdmin.no')}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      apiFetch(`/api/species/${entry.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ isActive: !entry.isActive }),
                      }),
                    )
                  }
                >
                  {entry.isActive ? t('speciesAdmin.deactivate') : t('speciesAdmin.reactivate')}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => setMergeFrom(mergeFrom === entry.id ? null : entry.id)}
                >
                  {t('speciesAdmin.merge')}
                </button>

                {mergeFrom === entry.id ? (
                  <select
                    className="ml-2 rounded-lg border border-stone-300 px-2 py-1"
                    defaultValue=""
                    onChange={(event) => {
                      const target = event.target.value;
                      if (!target) return;
                      if (
                        !confirm(
                          t('speciesAdmin.confirmMerge', {
                            count: entry.treeCount,
                            species: entry.nameEn,
                            slug: entry.slug,
                          }),
                        )
                      )
                        return;
                      void run(() =>
                        apiFetch(`/api/species/${entry.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ mergeIntoId: target }),
                        }),
                      ).then(() => setMergeFrom(null));
                    }}
                  >
                    <option value="">{t('speciesAdmin.mergeInto')}</option>
                    {initial
                      .filter((option) => option.id !== entry.id)
                      .map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.nameEn}
                        </option>
                      ))}
                  </select>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
