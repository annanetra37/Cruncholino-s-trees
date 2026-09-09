'use client';

/** T5.5 — everything known about one tree, plus an edit link if permitted. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/client/api';
import { AGE_BANDS, CONDITIONS, FRUIT_QUALITIES, conditionColor, labelFor } from '@/lib/constants';
import type { TreeDetail } from '@/lib/client/types';

type Response = {
  tree: TreeDetail;
  permissions: { canEdit: boolean; canModerate: boolean };
};

export function TreeDetailPanel({
  treeId,
  photoBaseUrl,
  onClose,
}: {
  treeId: string;
  photoBaseUrl: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);

    apiFetch<Response>(`/api/trees/${treeId}`)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });

    return () => {
      cancelled = true;
    };
  }, [treeId]);

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto border-l border-stone-200 bg-white">
      <div className="flex items-start justify-between gap-2 border-b border-stone-200 p-4">
        <div>
          <h2 className="text-lg font-bold">{data?.tree.species.nameEn ?? 'Tree'}</h2>
          {data?.tree.species.nameHy ? (
            <p className="text-sm text-stone-500">{data.tree.species.nameHy}</p>
          ) : null}
        </div>
        <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close details">
          ✕
        </button>
      </div>

      {error ? <p className="p-4 text-sm text-red-700">{error}</p> : null}
      {!data && !error ? <p className="p-4 text-sm text-stone-500">Loading…</p> : null}

      {data ? (
        <div className="space-y-5 p-4">
          {data.tree.photos.length && photoBaseUrl ? (
            <div className="grid grid-cols-2 gap-2">
              {data.tree.photos.map((photo) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={photo.id}
                  src={`${photoBaseUrl.replace(/\/$/, '')}/${photo.storageKey}`}
                  alt={`${data.tree.species.nameEn} photo`}
                  loading="lazy"
                  className="aspect-square w-full rounded-lg object-cover"
                />
              ))}
            </div>
          ) : null}

          <dl className="space-y-2 text-sm">
            <Row label="Condition">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2.5 rounded-full ring-1 ring-black/20"
                  style={{ backgroundColor: conditionColor(data.tree.condition) }}
                />
                {labelFor(CONDITIONS, data.tree.condition)}
              </span>
            </Row>
            <Row label="Fruit">{labelFor(FRUIT_QUALITIES, data.tree.fruitQuality)}</Row>
            <Row label="Age">
              {labelFor(AGE_BANDS, data.tree.ageBand)}
              {data.tree.ageYearsEstimate ? ` (~${data.tree.ageYearsEstimate} years)` : ''}
            </Row>
            <Row label="Address">
              {data.tree.address.line ?? '—'}
              {data.tree.address.status === 'FAILED' ? (
                <span className="ml-1 text-amber-700">(lookup failed)</span>
              ) : null}
              {data.tree.address.status === 'MANUAL' ? (
                <span className="ml-1 text-stone-400">(entered by hand)</span>
              ) : null}
            </Row>
            <Row label="City">{data.tree.address.city ?? '—'}</Row>
            <Row label="Region">{data.tree.address.region ?? '—'}</Row>
            <Row label="Coordinates">
              <span className="font-mono text-xs">
                {data.tree.latitude.toFixed(5)}, {data.tree.longitude.toFixed(5)}
              </span>
              {data.tree.coordinatesApproximate ? (
                <span className="ml-1 text-stone-400">(approximate)</span>
              ) : null}
              {data.tree.location.accuracyM ? (
                <span className="ml-1 text-stone-400">±{Math.round(data.tree.location.accuracyM)} m</span>
              ) : null}
            </Row>
            <Row label="Added by">{data.tree.createdBy?.name ?? 'Anonymous'}</Row>
            <Row label="Recorded">{new Date(data.tree.createdAt).toLocaleDateString()}</Row>
            {data.tree.status !== 'PUBLISHED' ? <Row label="Status">{data.tree.status}</Row> : null}
          </dl>

          {data.tree.notes ? (
            <div>
              <h3 className="field-label">Notes</h3>
              <p className="whitespace-pre-wrap rounded-lg bg-stone-50 p-3 text-sm">
                {data.tree.notes}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {data.permissions.canEdit ? (
              <Link href={`/trees/${data.tree.id}/edit`} className="btn-secondary">
                Edit
              </Link>
            ) : null}
            <a
              className="btn-secondary"
              href={`https://www.google.com/maps/dir/?api=1&destination=${data.tree.latitude},${data.tree.longitude}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Directions
            </a>
          </div>

          {data.tree.revisions.length ? (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold">
                History ({data.tree.revisions.length})
              </summary>
              <ol className="mt-2 space-y-2 border-l border-stone-200 pl-3">
                {data.tree.revisions.map((revision) => (
                  <li key={revision.id}>
                    <p className="text-xs text-stone-500">
                      {new Date(revision.changedAt).toLocaleString()} — {revision.action}
                      {revision.by ? ` by ${revision.by}` : ''}
                    </p>
                    <ul className="text-xs text-stone-600">
                      {Object.entries(revision.diff)
                        .slice(0, 8)
                        .map(([field, change]) => (
                          <li key={field}>
                            <span className="font-medium">{field}</span>: {String(change.from ?? '—')}{' '}
                            → {String(change.to ?? '—')}
                          </li>
                        ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-stone-500">{label}</dt>
      <dd className="flex-1">{children}</dd>
    </div>
  );
}
