'use client';

/**
 * T4.2 / T4.3 / T4.4 — the capture flow.
 *
 * Design constraints, in order of importance:
 *  - Never lose an entry. A failed submit retries, then falls back to the
 *    offline queue; the form is only cleared once the record is safe somewhere.
 *  - No keyboard input required beyond optional notes.
 *  - Everything reachable one-handed with big targets, because this is used
 *    outdoors while holding a phone in one hand and a branch in the other.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocationStep, type PickedLocation } from '@/components/LocationStep';
import { SpeciesPicker } from '@/components/SpeciesPicker';
import { ChoiceGroup } from '@/components/ChoiceGroup';
import { PhotoUploader, type UploadedPhoto } from '@/components/PhotoUploader';
import { AGE_BANDS, CONDITIONS, FRUIT_QUALITIES, REACHABILITIES } from '@/lib/constants';
import { useT } from '@/i18n/client';
import { ApiClientError, apiFetch } from '@/lib/client/api';
import { enqueue, sync } from '@/lib/client/offline-queue';
import type { SpeciesOption } from '@/lib/client/types';

type CreatedTree = {
  tree: {
    id: string;
    address: { line: string | null; city: string | null; region: string | null; status: string };
  };
  warnings: Array<{
    code: string;
    message: string;
    nearby: Array<{ id: string; distanceM: number }>;
  }>;
};

const DRAFT_KEY = 'cruncholino:add-tree-draft';

export function AddTreeForm({ species }: { species: SpeciesOption[] }) {
  const router = useRouter();
  const t = useT();

  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [speciesId, setSpeciesId] = useState<string | null>(null);
  const [condition, setCondition] = useState('UNKNOWN');
  const [ageBand, setAgeBand] = useState('UNKNOWN');
  const [fruitQuality, setFruitQuality] = useState('UNKNOWN');
  const [reachability, setReachability] = useState('UNKNOWN');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreatedTree | null>(null);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [addressEdit, setAddressEdit] = useState<{ city: string; region: string } | null>(null);

  // T4.4 — an in-progress entry survives a reload or an accidental back swipe.
  useEffect(() => {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      setSpeciesId(draft.speciesId ?? null);
      setCondition(draft.condition ?? 'UNKNOWN');
      setAgeBand(draft.ageBand ?? 'UNKNOWN');
      setFruitQuality(draft.fruitQuality ?? 'UNKNOWN');
      setReachability(draft.reachability ?? 'UNKNOWN');
      setNotes(draft.notes ?? '');
    } catch {
      sessionStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ speciesId, condition, ageBand, fruitQuality, reachability, notes }),
    );
  }, [speciesId, condition, ageBand, fruitQuality, reachability, notes]);

  const reset = useCallback(() => {
    setSpeciesId(null);
    setCondition('UNKNOWN');
    setAgeBand('UNKNOWN');
    setFruitQuality('UNKNOWN');
    setNotes('');
    setPhotos([]);
    setResult(null);
    setQueued(false);
    setError(null);
    setAddressEdit(null);
    sessionStorage.removeItem(DRAFT_KEY);
  }, []);

  const buildPayload = useCallback(
    () => ({
      speciesId,
      latitude: location?.latitude,
      longitude: location?.longitude,
      locationSource: location?.source ?? 'MANUAL',
      accuracyM: location?.accuracyM ?? undefined,
      condition,
      ageBand,
      fruitQuality,
      reachability,
      notes: notes.trim() || undefined,
      photos: photos.map((photo) => ({
        storageKey: photo.storageKey,
        width: photo.width,
        height: photo.height,
        bytes: photo.bytes,
        takenAt: photo.takenAt,
      })),
      clientRef: crypto.randomUUID(),
    }),
    [ageBand, condition, fruitQuality, location, notes, photos, reachability, speciesId],
  );

  const submit = useCallback(async () => {
    setError(null);
    setFieldErrors({});

    if (!speciesId) {
      setFieldErrors({ speciesId: [t('add.needSpecies')] });
      return;
    }
    if (!location) {
      setError(t('add.needPosition'));
      return;
    }

    setSubmitting(true);
    const payload = buildPayload();

    // One immediate retry covers the common case: a request sent while the
    // phone was switching between cell towers.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await apiFetch<CreatedTree>('/api/trees', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        setResult(response);
        setAddressEdit({
          city: response.tree.address.city ?? '',
          region: response.tree.address.region ?? '',
        });
        sessionStorage.removeItem(DRAFT_KEY);
        setSubmitting(false);
        return;
      } catch (cause) {
        const failure = cause as ApiClientError;

        if (failure.status === 422 || failure.status === 400) {
          setFieldErrors(failure.fields);
          setError(failure.message);
          setSubmitting(false);
          return;
        }
        if (failure.status === 401) {
          setError(t('add.sessionExpired'));
          await enqueue(payload);
          setQueued(true);
          setSubmitting(false);
          return;
        }
        if (!failure.retryable || attempt === 1) {
          // T4.4 — the entry is never lost: it goes to the offline queue and
          // syncs when the connection comes back.
          await enqueue(payload);
          setQueued(true);
          setSubmitting(false);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
  }, [buildPayload, location, speciesId, t]);

  const saveAddressCorrection = useCallback(async () => {
    if (!result || !addressEdit) return;
    try {
      await apiFetch(`/api/trees/${result.tree.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          addressOverride: { city: addressEdit.city || null, region: addressEdit.region || null },
        }),
      });
      setResult({
        ...result,
        tree: { ...result.tree, address: { ...result.tree.address, status: 'MANUAL' } },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('add.correctionFailed'));
    }
  }, [addressEdit, result, t]);

  if (queued) {
    return (
      <div className="card mx-auto max-w-lg space-y-4 p-6 text-center">
        <p className="text-4xl" aria-hidden>
          📥
        </p>
        <h2 className="text-xl font-bold">{t('add.queuedTitle')}</h2>
        <p className="text-stone-600">{t('add.queuedBody')}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primary" onClick={reset}>
            {t('add.addAnother')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => sync().then(() => router.refresh())}
          >
            {t('add.trySync')}
          </button>
        </div>
      </div>
    );
  }

  if (result) {
    const duplicate = result.warnings.find((warning) => warning.code === 'possible_duplicate');
    return (
      <div className="card mx-auto max-w-lg space-y-4 p-6">
        <div className="text-center">
          <p className="text-4xl" aria-hidden>
            🌳
          </p>
          <h2 className="text-xl font-bold">{t('add.recorded')}</h2>
        </div>

        {/* T4.3 — confirm the reverse-geocoded address, and let it be corrected. */}
        <div className="rounded-lg border border-stone-200 p-3">
          <p className="text-sm text-stone-500">{t('add.addressFound')}</p>
          <p className="font-medium">{result.tree.address.line ?? t('add.noAddress')}</p>
          {result.tree.address.status === 'FAILED' ? (
            <p className="mt-1 text-sm text-amber-700">{t('add.lookupFailed')}</p>
          ) : null}

          {addressEdit ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">{t('field.city')}</span>
                <input
                  className="field-input"
                  value={addressEdit.city}
                  onChange={(event) => setAddressEdit({ ...addressEdit, city: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="field-label">{t('field.region')}</span>
                <input
                  className="field-input"
                  value={addressEdit.region}
                  onChange={(event) =>
                    setAddressEdit({ ...addressEdit, region: event.target.value })
                  }
                />
              </label>
              <button
                type="button"
                className="btn-secondary sm:col-span-2"
                onClick={saveAddressCorrection}
              >
                {t('add.saveCorrection')}
              </button>
            </div>
          ) : null}
        </div>

        {duplicate ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {duplicate.message} {t('add.duplicateHint')}
          </p>
        ) : null}

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primary" onClick={reset}>
            {t('add.addAnother')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push(`/dashboard?tree=${result.tree.id}`)}
          >
            {t('add.seeOnMap')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="mx-auto max-w-2xl space-y-6 p-4 pb-28"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <section className="card p-4">
        <h2 className="mb-3 text-lg font-bold">{t('add.step1')}</h2>
        <LocationStep value={location} onChange={setLocation} />
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-lg font-bold">{t('add.step2')}</h2>
        <SpeciesPicker
          species={species}
          value={speciesId}
          onChange={setSpeciesId}
          error={fieldErrors.speciesId?.[0]}
        />
      </section>

      <section className="card space-y-5 p-4">
        <h2 className="text-lg font-bold">{t('add.step3')}</h2>
        <ChoiceGroup
          legendKey="field.condition"
          options={CONDITIONS}
          value={condition}
          onChange={setCondition}
        />
        {/* Deliberately separate from condition: a healthy tree can bear bad
            fruit, and a half-dead one can bear well. */}
        <ChoiceGroup
          legendKey="field.fruitQuality"
          options={FRUIT_QUALITIES}
          value={fruitQuality}
          onChange={setFruitQuality}
        />
        {/* Reachability, not condition or crop: the fruit can be perfect and
            still ten metres up, which for anyone planning a route is the
            difference between a stop and a detour. */}
        <ChoiceGroup
          legendKey="field.reachability"
          options={REACHABILITIES}
          value={reachability}
          onChange={setReachability}
        />
        <ChoiceGroup
          legendKey="field.age"
          options={AGE_BANDS}
          value={ageBand}
          onChange={setAgeBand}
        />
      </section>

      <section className="card space-y-4 p-4">
        <h2 className="text-lg font-bold">{t('add.step4')}</h2>
        <PhotoUploader
          photos={photos}
          onChange={setPhotos}
          onExifLocation={(coords) => {
            // EXIF is only a fallback: never overwrite a live GPS fix with it.
            if (!location || location.source === 'MANUAL') {
              setLocation({ ...coords, accuracyM: null, source: 'EXIF' });
            }
          }}
        />
        <label className="block">
          <span className="field-label">{t('field.notes')}</span>
          <textarea
            className="field-input min-h-24"
            value={notes}
            maxLength={2000}
            placeholder={t('add.notesPlaceholder')}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
      </section>

      {error ? (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button
            type="submit"
            className="btn-primary flex-1 text-lg"
            disabled={submitting || !speciesId || !location}
          >
            {submitting ? t('common.saving') : t('add.save')}
          </button>
        </div>
      </div>
    </form>
  );
}
