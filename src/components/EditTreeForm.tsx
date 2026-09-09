'use client';

/** T3.4 / T4.6 — correcting a record after the fact. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChoiceGroup } from '@/components/ChoiceGroup';
import { SpeciesPicker } from '@/components/SpeciesPicker';
import { LocationStep, type PickedLocation } from '@/components/LocationStep';
import { AGE_BANDS, CONDITIONS, FRUIT_QUALITIES, TREE_STATUSES } from '@/lib/constants';
import { ApiClientError, apiFetch } from '@/lib/client/api';
import type { SpeciesOption } from '@/lib/client/types';

type EditableTree = {
  id: string;
  speciesId: string;
  latitude: number;
  longitude: number;
  condition: string;
  ageBand: string;
  fruitQuality: string;
  notes: string | null;
  status: string;
  city: string | null;
  region: string | null;
  addressLine: string | null;
};

export function EditTreeForm({
  tree,
  species,
  canModerate,
}: {
  tree: EditableTree;
  species: SpeciesOption[];
  canModerate: boolean;
}) {
  const router = useRouter();

  const [speciesId, setSpeciesId] = useState(tree.speciesId);
  const [condition, setCondition] = useState(tree.condition);
  const [ageBand, setAgeBand] = useState(tree.ageBand);
  const [fruitQuality, setFruitQuality] = useState(tree.fruitQuality);
  const [notes, setNotes] = useState(tree.notes ?? '');
  const [status, setStatus] = useState(tree.status);
  const [city, setCity] = useState(tree.city ?? '');
  const [region, setRegion] = useState(tree.region ?? '');
  const [location, setLocation] = useState<PickedLocation | null>({
    latitude: tree.latitude,
    longitude: tree.longitude,
    accuracyM: null,
    source: 'MANUAL',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const moved =
    location !== null &&
    (location.latitude !== tree.latitude || location.longitude !== tree.longitude);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await apiFetch(`/api/trees/${tree.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          speciesId,
          condition,
          ageBand,
          fruitQuality,
          notes: notes.trim() || null,
          ...(canModerate ? { status } : {}),
          ...(moved ? { latitude: location.latitude, longitude: location.longitude } : {}),
          // Only send an address override when the fields were actually
          // changed: sending them unchanged would mark a good geocode MANUAL.
          ...(city !== (tree.city ?? '') || region !== (tree.region ?? '')
            ? { addressOverride: { city: city || null, region: region || null } }
            : {}),
        }),
      });
      setSaved(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm('Remove this tree? A reviewer can restore it later.')) return;
    try {
      await apiFetch(`/api/trees/${tree.id}`, { method: 'DELETE' });
      router.push('/my-trees');
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'Could not delete');
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="text-2xl font-bold">Edit tree</h1>

      <section className="card p-4">
        <SpeciesPicker species={species} value={speciesId} onChange={setSpeciesId} />
      </section>

      <section className="card space-y-5 p-4">
        <ChoiceGroup legend="Condition" options={CONDITIONS} value={condition} onChange={setCondition} />
        <ChoiceGroup
          legend="Fruit quality"
          options={FRUIT_QUALITIES}
          value={fruitQuality}
          onChange={setFruitQuality}
        />
        <ChoiceGroup legend="Age" options={AGE_BANDS} value={ageBand} onChange={setAgeBand} />
      </section>

      <section className="card space-y-4 p-4">
        <h2 className="text-lg font-bold">Position</h2>
        <LocationStep value={location} onChange={setLocation} />
        {moved ? (
          <p className="text-sm text-amber-800">
            The pin moved — the address will be looked up again when you save.
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">City</span>
            <input className="field-input" value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label className="block">
            <span className="field-label">Region</span>
            <input
              className="field-input"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="card space-y-4 p-4">
        <label className="block">
          <span className="field-label">Notes</span>
          <textarea
            className="field-input min-h-24"
            value={notes}
            maxLength={2000}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        {canModerate ? (
          <label className="block">
            <span className="field-label">Status</span>
            <select
              className="field-input"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {TREE_STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      {error ? (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      ) : null}
      {saved ? <p className="text-sm text-emerald-800">Saved.</p> : null}

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-ghost ml-auto text-red-700 hover:bg-red-50"
          onClick={remove}
        >
          Remove tree
        </button>
      </div>
    </div>
  );
}
