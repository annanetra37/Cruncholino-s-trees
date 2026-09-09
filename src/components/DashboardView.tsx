'use client';

/**
 * T5.1–T5.7 — the dashboard.
 *
 * Filter state is the URL. Every fetch derives from it, and `router.replace`
 * keeps it in sync without adding a history entry per keystroke — so the back
 * button still means "the previous view", and copying the address bar into a
 * new tab reproduces exactly what is on screen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TreeMap, type Bbox } from '@/components/TreeMap';
import { FilterPanel, type Filters } from '@/components/FilterPanel';
import { MapLegend } from '@/components/MapLegend';
import { StatsBar } from '@/components/StatsBar';
import { TreeDetailPanel } from '@/components/TreeDetailPanel';
import { TreeListView } from '@/components/TreeListView';
import { apiFetch } from '@/lib/client/api';
import type {
  LocationFilters,
  SpeciesOption,
  TreeFeatureCollection,
  TreeListResponse,
  TreeStats,
} from '@/lib/client/types';

const EMPTY_COLLECTION: TreeFeatureCollection = {
  type: 'FeatureCollection',
  clustered: false,
  total: 0,
  features: [],
};

function filtersFromParams(params: URLSearchParams): Filters {
  const multi = (key: string) => {
    const raw = params.get(key);
    return raw ? raw.split(',').filter(Boolean) : [];
  };
  return {
    species: multi('species'),
    age_band: multi('age_band'),
    condition: multi('condition'),
    fruit_quality: multi('fruit_quality'),
    city: params.get('city') ?? '',
    region: params.get('region') ?? '',
    q: params.get('q') ?? '',
  };
}

function filtersToQuery(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
    } else if (value) {
      params.set(key, value);
    }
  }
  return params;
}

export function DashboardView({
  species,
  photoBaseUrl,
  canExport,
}: {
  species: SpeciesOption[];
  photoBaseUrl: string;
  canExport: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => filtersFromParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const filterQuery = useMemo(() => filtersToQuery(filters).toString(), [filters]);

  const view = searchParams.get('view') === 'list' ? 'list' : 'map';
  const selectedId = searchParams.get('tree');
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1;
  const sort = searchParams.get('sort') ?? 'created_at:desc';

  const [features, setFeatures] = useState<TreeFeatureCollection>(EMPTY_COLLECTION);
  const [list, setList] = useState<TreeListResponse | null>(null);
  const [stats, setStats] = useState<TreeStats | null>(null);
  const [locations, setLocations] = useState<LocationFilters | null>(null);
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const setParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      router.replace(params.size ? `/dashboard?${params}` : '/dashboard', { scroll: false });
    },
    [router, searchParams],
  );

  const onFiltersChange = useCallback(
    (next: Filters) => {
      setParams((params) => {
        for (const key of ['species', 'age_band', 'condition', 'fruit_quality', 'city', 'region', 'q']) {
          params.delete(key);
        }
        for (const [key, value] of filtersToQuery(next)) params.set(key, value);
        params.delete('page'); // A new filter invalidates the current page number.
      });
    },
    [setParams],
  );

  useEffect(() => {
    apiFetch<{ items: LocationFilters['cities'] } & LocationFilters>('/api/filters/locations')
      .then(setLocations)
      .catch(() => setLocations(null));
  }, []);

  // The map layer: viewport-scoped, refetched when the box or the filters move.
  const requestId = useRef(0);
  useEffect(() => {
    if (view !== 'map' || !bbox) return;
    const id = ++requestId.current;

    const params = new URLSearchParams(filterQuery);
    params.set('bbox', `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`);
    params.set('zoom', bbox.zoom.toFixed(1));

    setLoading(true);
    apiFetch<TreeFeatureCollection>(`/api/trees/geojson?${params}`)
      .then((response) => {
        // Out-of-order responses: a slow pan must not overwrite a fast one.
        if (id === requestId.current) setFeatures(response);
      })
      .catch((cause: Error) => {
        if (id === requestId.current) setError(cause.message);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [bbox, filterQuery, view]);

  // The list view: same filters, server-paginated.
  useEffect(() => {
    if (view !== 'list') return;
    const params = new URLSearchParams(filterQuery);
    params.set('page', String(page));
    params.set('sort', sort);
    params.set('page_size', '50');

    setLoading(true);
    apiFetch<TreeListResponse>(`/api/trees?${params}`)
      .then(setList)
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setLoading(false));
  }, [filterQuery, page, sort, view]);

  // Stats follow the filters, not the viewport: "how many apricots are in
  // Gyumri" should not change because the map drifted a little west.
  useEffect(() => {
    setStats(null);
    apiFetch<TreeStats>(`/api/trees/stats?${filterQuery}`)
      .then(setStats)
      .catch(() => setStats(null));
  }, [filterQuery]);

  const onSelect = useCallback(
    (treeId: string) => setParams((params) => params.set('tree', treeId)),
    [setParams],
  );

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col">
      <StatsBar stats={stats} loading={loading} />

      {error ? (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
          <button type="button" className="btn-ghost ml-2" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-2">
        <div className="flex rounded-lg border border-stone-300 p-0.5" role="tablist">
          {(['map', 'list'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={view === option}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                view === option ? 'bg-emerald-700 text-white' : 'text-stone-600'
              }`}
              onClick={() => setParams((params) => params.set('view', option))}
            >
              {option}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn-ghost lg:hidden"
          onClick={() => setPanelOpen((value) => !value)}
        >
          Filters
        </button>

        {canExport ? (
          <a className="btn-ghost ml-auto" href={`/api/export?format=csv&${filterQuery}`}>
            Export CSV
          </a>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          className={`${
            panelOpen ? 'fixed inset-x-0 bottom-0 top-32 z-20 bg-white' : 'hidden'
          } w-full lg:relative lg:inset-auto lg:block lg:w-80 lg:shrink-0 lg:border-r lg:border-stone-200`}
        >
          <FilterPanel
            filters={filters}
            species={species}
            locations={locations}
            resultCount={stats?.total ?? null}
            onChange={onFiltersChange}
          />
          <div className="border-t border-stone-200 p-3 lg:hidden">
            <button type="button" className="btn-primary w-full" onClick={() => setPanelOpen(false)}>
              Show {stats ? stats.total.toLocaleString() : ''} results
            </button>
          </div>
        </div>

        <div className="relative min-w-0 flex-1">
          {view === 'map' ? (
            <>
              <TreeMap
                data={features}
                onViewportChange={setBbox}
                onSelect={onSelect}
                selectedId={selectedId}
              />
              <div className="pointer-events-none absolute bottom-4 left-4 z-10">
                <MapLegend />
              </div>
              {features.clustered ? (
                <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-stone-900/80 px-3 py-1.5 text-xs text-white">
                  Showing clusters — zoom in for individual trees
                </div>
              ) : null}
            </>
          ) : (
            <TreeListView
              data={list}
              loading={loading}
              sort={sort}
              page={page}
              onSortChange={(next) => setParams((params) => params.set('sort', next))}
              onPageChange={(next) => setParams((params) => params.set('page', String(next)))}
              onSelect={onSelect}
            />
          )}
        </div>

        {selectedId ? (
          <div className="fixed inset-y-0 right-0 z-30 w-full max-w-md sm:w-96 lg:relative lg:z-auto">
            <TreeDetailPanel
              treeId={selectedId}
              photoBaseUrl={photoBaseUrl}
              onClose={() => setParams((params) => params.delete('tree'))}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
